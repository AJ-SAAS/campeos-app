import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { CODE_LENGTH, codesMatch, docIdForEmail, generateCode, hashCode, isValidEmail, mintCustomToken, normalizeEmail } from "../lib/emailCode";

test("generateCode is always 6 digits", () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), new RegExp(`^\\d{${CODE_LENGTH}}$`));
});

test("a code only matches its own email and digits", () => {
  const h = hashCode("a@b.com", "123456", "s");
  assert.equal(codesMatch(h, "a@b.com", "123456", "s"), true);
  assert.equal(codesMatch(h, "A@B.com ", "123456", "s"), true);
  assert.equal(codesMatch(h, "a@b.com", "123457", "s"), false);
  assert.equal(codesMatch(h, "other@b.com", "123456", "s"), false);
  assert.equal(codesMatch(h, "a@b.com", "12345", "s"), false);
  assert.equal(codesMatch(h, "a@b.com", "abcdef", "s"), false);
});

test("email helpers", () => {
  assert.equal(normalizeEmail("  Me@X.com "), "me@x.com");
  assert.equal(docIdForEmail("Me@X.com"), docIdForEmail("me@x.com"));
  assert.equal(isValidEmail("me@x.com"), true);
  assert.equal(isValidEmail("me@x"), false);
  assert.equal(isValidEmail("nope"), false);
});

test("custom token is a valid RS256 JWT carrying the uid", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const sa = { client_email: "svc@proj.iam.gserviceaccount.com", private_key: pem, project_id: "proj" };
  const token = mintCustomToken("uid123", sa, 1_000_000);
  const [h, b, s] = token.split(".");
  const payload = JSON.parse(Buffer.from(b, "base64url").toString());
  assert.equal(payload.uid, "uid123");
  assert.equal(payload.iss, sa.client_email);
  assert.equal(payload.exp - payload.iat, 3600);
  const ok = createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url"));
  assert.equal(ok, true);
});
