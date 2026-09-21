import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
try {
  for (const line of readFileSync(
    new URL("../.env", import.meta.url),
    "utf8",
  ).split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  /* Prisma reports missing DATABASE_URL clearly. */
}
const action = process.argv[2];
if (action !== "push") throw new Error("Supported action: push");
const result = spawnSync("yarn", ["workspace", "@devmarket/database", "push"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
