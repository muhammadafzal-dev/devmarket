import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const data = `${root}.local/postgres`;
const action = process.argv[2];
// Single source of truth: derive connection settings from .env DATABASE_URL so a
// host with a port conflict is resolved by editing .env once (no hardcoded port).
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    for (const line of readFileSync(`${root}.env`, "utf8").split("\n")) {
      const match = line.match(/^DATABASE_URL=(.*)$/);
      if (match) return match[1].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* Fall through to the documented default below. */
  }
  return "postgresql://devmarket:devmarket@127.0.0.1:5433/devmarket";
}
const url = new URL(databaseUrl());
const host = url.hostname || "127.0.0.1";
const port = url.port || "5433";
const dbUser = decodeURIComponent(url.username || "devmarket");
const dbName = decodeURIComponent(url.pathname.replace(/^\//, "")) || "devmarket";
const psqlArgs = ["-h", host, "-p", port, "-U", dbUser];
function run(command, args, allowFailure = false) {
  const r = spawnSync(command, args, { stdio: "inherit", cwd: root });
  if (r.error) throw r.error;
  if (r.status && !allowFailure) process.exit(r.status);
  return r.status;
}
if (action === "stop") {
  run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
} else if (action === "start") {
  mkdirSync(data, { recursive: true });
  if (!existsSync(`${data}/PG_VERSION`))
    run("initdb", [
      "-D",
      data,
      "-U",
      dbUser,
      "-A",
      "trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
  const status = spawnSync("pg_ctl", ["-D", data, "status"], {
    stdio: "ignore",
  });
  if (status.status !== 0)
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      `${root}.local/postgres.log`,
      "-o",
      `-h ${host} -p ${port} -k /tmp`,
      "start",
    ]);
  const exists = spawnSync(
    "psql",
    [...psqlArgs, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
    { encoding: "utf8" },
  );
  if (exists.status !== 0) {
    console.error(exists.stderr);
    process.exit(1);
  }
  if (exists.stdout.trim() !== "1")
    run("createdb", [...psqlArgs, dbName]);
  console.log(
    `DevMarket PostgreSQL ready at ${host}:${port}. Local trust authentication; do not expose this instance.`,
  );
} else {
  console.error("Usage: node scripts/local-postgres.mjs start|stop");
  process.exit(1);
}
