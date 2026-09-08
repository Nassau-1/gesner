import { cp, mkdir } from "node:fs/promises";
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await cp(new URL("../public/", import.meta.url), new URL("../dist/", import.meta.url), { recursive: true });
for (const name of ["LICENSE", "NOTICE", "PRIVACY.md"]) {
  await cp(new URL("../" + name, import.meta.url), new URL("../dist/" + name, import.meta.url));
}
console.log("Built unpacked Chrome extension in dist/");
