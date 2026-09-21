import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const data = `${root}.local/postgres`;
const action = process.argv[2];
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
      "devmarket",
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
      "-h 127.0.0.1 -p 5433 -k /tmp",
      "start",
    ]);
  const exists = spawnSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "5433",
      "-U",
      "devmarket",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname='devmarket'",
    ],
    { encoding: "utf8" },
  );
  if (exists.status !== 0) {
    console.error(exists.stderr);
    process.exit(1);
  }
  if (exists.stdout.trim() !== "1")
    run("createdb", [
      "-h",
      "127.0.0.1",
      "-p",
      "5433",
      "-U",
      "devmarket",
      "devmarket",
    ]);
  console.log(
    "DevMarket PostgreSQL ready at 127.0.0.1:5433. Local trust authentication; do not expose this instance.",
  );
} else {
  console.error("Usage: node scripts/local-postgres.mjs start|stop");
  process.exit(1);
}
