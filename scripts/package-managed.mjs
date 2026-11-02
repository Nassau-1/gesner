// Packaging only: the Chromium packer creates/signs CRX3; no new runtime dependency.
import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [chromium, signingKey, output] = process.argv.slice(2);
if (!chromium || !signingKey || !output) throw new Error("Usage: node scripts/package-managed.mjs <chromium.exe> <private-key.pem outside repo> <output-dir>");
const keyPath = path.resolve(signingKey);
if (!path.relative(root, keyPath).startsWith("..")) throw new Error("Signing key must stay outside the repository");
const channel = JSON.parse(await readFile(path.join(root, "deployment/mci/channel.json"), "utf8"));
for (const url of [channel.updateUrl, channel.crxUrl]) if (new URL(url).protocol !== "https:") throw new Error("HTTPS required");
await mkdir(path.dirname(keyPath), { recursive: true });
try { await access(keyPath); } catch {
  const pair = generateKeyPairSync("rsa", { modulusLength: 3072 });
  await writeFile(keyPath, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
}
const publicKey = createPublicKey(await readFile(keyPath)).export({ type: "spki", format: "der" });
const id = [...createHash("sha256").update(publicKey).digest().subarray(0, 16)]
  .flatMap(b => [b >> 4, b & 15]).map(n => String.fromCharCode(97 + n)).join("");
const out = path.resolve(output);
await mkdir(out, { recursive: true });
const stage = path.join(root, "work/mci/extension");
await mkdir(stage, { recursive: true });
await cp(path.join(root, "dist"), stage, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(stage, "manifest.json"), "utf8"));
manifest.update_url = channel.updateUrl;
manifest.key = publicKey.toString("base64");
await writeFile(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const packed = spawnSync(chromium, ["--headless=new", "--no-message-box", "--no-first-run", "--user-data-dir=" + path.join(root, "work/mci/packer-profile"), "--pack-extension=" + stage, "--pack-extension-key=" + keyPath], { encoding: "utf8", timeout: 60000, windowsHide: true });
if (packed.error || packed.status !== 0) throw new Error("Chromium packer failed: " + (packed.error?.message ?? packed.stderr));
const crx = await readFile(stage + ".crx");
if (crx.toString("ascii", 0, 4) !== "Cr24" || crx.readUInt32LE(4) !== 3) throw new Error("Expected CRX3");
const name = `gesner-${manifest.version}-mci`;
await writeFile(path.join(out, name + ".crx"), crx);
await writeFile(path.join(out, name + ".zip"), crx.subarray(12 + crx.readUInt32LE(8)));
await writeFile(path.join(out, "gesner-mci-updates.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0"><app appid="${id}"><updatecheck codebase="${channel.crxUrl}" version="${manifest.version}" /></app></gupdate>\n`);
const config = { ...channel, extensionId: id, version: manifest.version, crxSha256: createHash("sha256").update(crx).digest("hex") };
await writeFile(path.join(out, "config.json"), JSON.stringify(config, null, 2) + "\n");
await cp(path.join(root, "deployment/mci"), path.join(out, "intune"), { recursive: true });
await writeFile(path.join(out, "intune/config.json"), JSON.stringify(config, null, 2) + "\n");
const detector = await readFile(path.join(out, "intune/Detect.ps1"), "utf8");
await writeFile(path.join(out, "intune/Detect.ps1"), detector.replaceAll("__EXTENSION_ID__", id).replaceAll("__VERSION__", manifest.version));
console.log(JSON.stringify(config, null, 2));
