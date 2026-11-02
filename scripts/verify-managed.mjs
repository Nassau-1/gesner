import { readFile } from "node:fs/promises";
import { createHash, createPublicKey, verify } from "node:crypto";
import assert from "node:assert/strict";

const [filename, configFile] = process.argv.slice(2);
const crx = await readFile(filename);
const config = JSON.parse(await readFile(configFile, "utf8"));
assert.equal(crx.toString("ascii", 0, 4), "Cr24");
assert.equal(crx.readUInt32LE(4), 3);
function varint(bytes, offset) {
  let n = 0, shift = 0;
  while (true) {
    const b = bytes[offset++];
    assert.notEqual(b, undefined);
    n += (b & 127) * 2 ** shift;
    if (!(b & 128)) return [n, offset];
    shift += 7; assert.ok(shift < 35);
  }
}
function fields(bytes) {
  const result = new Map();
  for (let offset = 0; offset < bytes.length;) {
    let tag, length;
    [tag, offset] = varint(bytes, offset);
    assert.equal(tag & 7, 2);
    [length, offset] = varint(bytes, offset);
    assert.ok(offset + length <= bytes.length);
    result.set(tag >> 3, bytes.subarray(offset, offset + length));
    offset += length;
  }
  return result;
}
const size = crx.readUInt32LE(8);
assert.ok(size > 0 && size < crx.length - 12);
const header = fields(crx.subarray(12, 12 + size));
const proof = fields(header.get(2));
const publicKey = proof.get(1);
const signedHeader = header.get(10000);
const rawId = fields(signedHeader).get(1);
assert.deepEqual(rawId, createHash("sha256").update(publicKey).digest().subarray(0, 16));
const id = [...rawId].flatMap(b => [b >> 4, b & 15]).map(n => String.fromCharCode(97 + n)).join("");
assert.equal(id, config.extensionId);
const length = Buffer.alloc(4); length.writeUInt32LE(signedHeader.length);
const signedData = Buffer.concat([Buffer.from("CRX3 SignedData\0"), length, signedHeader, crx.subarray(12 + size)]);
const key = createPublicKey({ key: publicKey, type: "spki", format: "der" });
assert.ok(verify("sha256", signedData, key, proof.get(2)), "signature");
const tampered = Buffer.from(signedData); tampered[tampered.length - 1] ^= 1;
assert.equal(verify("sha256", tampered, key, proof.get(2)), false, "tamper rejection");
assert.equal(createHash("sha256").update(crx).digest("hex"), config.crxSha256);
console.log(`CRX3 verified: ${id}; identity, RSA signature, tamper rejection and SHA256 verified.`);
