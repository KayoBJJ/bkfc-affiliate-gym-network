#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Offline disposable database; never accepts a remote DB URL or reuses an existing container.
image="${BKFC_TEST_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.165}"
container="bkfc-v11-test-${RANDOM}-${RANDOM}"
docker image inspect "$image" >/dev/null
cleanup() {
 local result=$?
 if [ "$result" -ne 0 ]; then docker logs --tail 80 "$container" >&2 || true; fi
 docker stop "$container" >/dev/null 2>&1 || true
 return "$result"
}
trap cleanup EXIT
docker run -d --rm --name "$container" --network none -e POSTGRES_PASSWORD=local-test-only "$image" >/dev/null
ready=false
# The image starts a temporary socket-only server during initialization, then
# shuts it down. TCP readiness waits for the final server, inside the container;
# no port is published and --network none remains in effect.
for attempt in {1..120}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -p 5432 -U supabase_admin >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
if [ "$ready" != true ]; then echo 'Local PostgreSQL did not start.' >&2; exit 1; fi
apply_sql() { docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$1"; }
apply_sql tests/database/bootstrap.sql
for migration in supabase/migrations/*.sql; do
 if [[ "${migration##*/}" < "20260914000000" ]]; then apply_sql "$migration"; fi
done
apply_sql tests/bkfc-integration-db-rehearsal.sql
for migration in supabase/migrations/20260914*.sql; do apply_sql "$migration"; done
apply_sql tests/bkfc-subscription-db-rehearsal.sql
apply_sql tests/bkfc-gym-control-db-rehearsal.sql
echo 'All BKFC PostgreSQL migration and behavior rehearsals passed.'
