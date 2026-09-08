import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const root = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
test("permissions are limited to explicit tab access and injection", () => {
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting"]);
  for (const key of ["host_permissions", "optional_permissions", "optional_host_permissions", "content_scripts", "externally_connectable", "web_accessible_resources", "update_url"])
    assert.equal(manifest[key], undefined, key);
  assert.deepEqual(manifest.background, { service_worker: "background.js", type: "module" });
});
test("extension pages deny outbound connections and remote assets", () => {
  const policy = manifest.content_security_policy.extension_pages;
  for (const rule of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "frame-src 'none'", "script-src 'self'", "object-src 'none'"])
    assert.ok(policy.split(";").map(x => x.trim()).includes(rule), rule);
});
test("all packaged scripts lack network, persistence and dynamic code APIs", async () => {
  // Regression tripwire, not a proof against obfuscated or future exfiltration.
  for (const name of await readdir(root)) {
    if (!/\.(js|html|css)$/.test(name)) continue;
    const source = await readFile(new URL(name, root), "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\beval\s*\(|new\s+Function|localStorage|sessionStorage|indexedDB|chrome\.storage|document\.cookie|innerHTML\s*=/, name);
    const urls = source.match(/https?:\/\/[^"'\s<>]+/g) ?? [];
    assert.ok(urls.every(url => name === "xlsx.js" && url.startsWith("http://schemas.openxmlformats.org/")), name + ": unexpected endpoint");
  }
});
test("popup and background reference packaged assets", async () => {
  const html = await readFile(new URL("popup.html", root), "utf8");
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g))
    assert.ok((await readFile(new URL(asset, root))).length);
  assert.ok((await readFile(new URL(manifest.background.service_worker, root))).length);
});
