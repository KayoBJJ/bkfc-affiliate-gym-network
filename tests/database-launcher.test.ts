import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("database launcher waits past the temporary socket-only initialization server", () => {
  const dir = mkdtempSync(join(tmpdir(), "bkfc-launcher-test-"));
  try {
    writeFileSync(join(dir, "docker"), `#!/usr/bin/env bash
set -eu
case "$*" in
 *pg_isready*)
  count=0
  if [ -f "$BKFC_LAUNCHER_FIXTURE/count" ]; then read -r count < "$BKFC_LAUNCHER_FIXTURE/count"; fi
  count=$((count+1))
  echo "$count" > "$BKFC_LAUNCHER_FIXTURE/count"
  case "$*" in
   *"-h 127.0.0.1"*) [ "$count" -ge 2 ] ;;
   *) exit 0 ;;
  esac
  ;;
 *psql*)
  read -r count < "$BKFC_LAUNCHER_FIXTURE/count"
  if [ "$count" -lt 2 ]; then echo 'FATAL: temporary server shutting down' >&2; exit 72; fi
  cat >/dev/null
  echo applied >> "$BKFC_LAUNCHER_FIXTURE/applied"
  ;;
 *) exit 0 ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(dir, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    const result = spawnSync("bash", [resolve("scripts/test-bkfc-database.sh")], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, BKFC_LAUNCHER_FIXTURE: dir }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, "count"), "utf8").trim(), "2");
    assert.ok(readFileSync(join(dir, "applied"), "utf8").trim().split("\n").length > 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
