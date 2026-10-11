#!/usr/bin/env node
// Usage: npm run admin:hash   (prompts; nothing is echoed or stored)
import crypto from "node:crypto";
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
rl._writeToOutput = (s) => (s.includes("Password") ? process.stderr.write(s) : undefined);
rl.question("Password (min 12 chars): ", (pw) => {
  rl.close();
  if (pw.length < 12) {
    console.error("\nToo short — use at least 12 characters.");
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const [N, r, p] = [16384, 8, 1];
  const hash = crypto.scryptSync(pw, salt, 32, { N, r, p, maxmem: 128 * N * r * 2 });
  console.error("\nAdd this to your environment (quote it if your shell requires):\n");
  console.log(`ADMIN_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`);
});
