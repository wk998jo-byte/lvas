import { hashPassword, verifyPassword } from "../lib/auth/password.ts";

const hash = await hashPassword("test-password");
const ok = await verifyPassword("test-password", hash);
const bad = await verifyPassword("wrong", hash);
const empty = await verifyPassword("test-password", null);

if (!hash.startsWith("scrypt:")) throw new Error("hash scheme");
if (!ok) throw new Error("verify should pass");
if (bad) throw new Error("wrong password should fail");
if (empty) throw new Error("null hash should fail");
if (hash.includes("test-password")) throw new Error("plaintext leaked");

console.log("password hashing: PASS");
