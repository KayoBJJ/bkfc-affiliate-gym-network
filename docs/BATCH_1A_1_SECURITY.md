# Batch 1A.1 security operations

## Current security state

The local `.env.local` file was previously tracked and configured server credentials are present in repository history. Its local working copy must remain on the developer machine, but the path is now ignored and removed from the current Git index. This does not invalidate credentials already exposed through Git. Rotation is mandatory before any staging or production release.

Never copy credential values into issues, chat, commits, logs, screenshots, build artifacts, or this document. Use `.env.example` only as a variable-name inventory. Store real values in the approved deployment secret store, with separate Development, Preview, and Production scope.

## Required configuration

Required before controlled staging or production testing:

- `NEXT_PUBLIC_SUPABASE_URL`: public project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public browser key.
- `SUPABASE_SERVICE_ROLE_KEY`: rotated, server-only privileged key.
- `RATE_LIMIT_HASH_SECRET`: independent random secret of at least 32 characters; never derive it from or reuse the service-role key.
- `RESEND_API_KEY`: rotated, server-only provider key if any email capability is expected.
- `APPLICANT_EMAIL_DELIVERY_ENABLED=false`: preserve controlled test mode.
- `APPLICANT_EMAIL_TEST_RECIPIENT`: approved controlled recipient for the applicant template.
- `APPLICANT_EMAIL_FROM`: approved and provider-verified sender identity.
- `INTERNAL_NOTIFICATION_RECIPIENT`: approved internal notification recipient.
- `TRUSTED_PROXY_PROVIDER`: leave unset on Vercel; use `cloudflare` only when Cloudflare is the verified, non-bypassable ingress.

Required only after HQ approves production applicant delivery:

- `APPLICANT_EMAIL_DELIVERY_ENABLED=true`.
- `APPLICANT_EMAIL_FROM`: HQ-approved sender on a verified domain.
- `APPLICANT_EMAIL_REPLY_TO`: HQ-approved reply-to address.
- `INTERNAL_NOTIFICATION_RECIPIENT`: HQ-approved internal destination.
- `RESEND_API_KEY`: approved active provider credential.

Applicant delivery fails closed when the enabled production configuration is incomplete. In test mode, a missing test recipient skips only the applicant-template test send. A missing internal recipient skips only the internal notification. Neither condition removes or invalidates a successfully stored application.

## Credential rotation runbook

Use this no-downtime order for every affected credential: create a replacement, store it in the approved secret manager/deployment environment, verify it in staging, deploy compatible code during the later approved release, revoke the old credential, verify the old credential no longer works, and record the date and responsible owner.

Review and rotate:

1. Supabase service-role key. Also review management/access tokens, database password, admin credentials, and any session, webhook, cron, or internal API secret for evidence of Git exposure. Rotate the Supabase JWT secret only if exposure is established and its broad session/key implications are understood. The anon key is intentionally public; verify project consistency rather than treating it as confidential.
2. Resend API key. Verify approved sender domains, inspect provider activity for unexpected use, and revoke the old key only after replacement verification.
3. Create a new independent `RATE_LIMIT_HASH_SECRET`. Changing it intentionally breaks continuity with historical limiter hashes; old rate-limit rows expire under the existing retention policy.
4. Review Vercel Development, Preview, and Production variables. Replace affected values in every scope and remove old values. Do not trigger deployment until the release window is approved.
5. Review GitHub repository and environment secrets, Actions variables/artifacts, collaborator access, deployment keys, and personal access tokens if evidence indicates exposure.

## Optional Git history remediation

Rotation is required even if history is rewritten. Prefer `git filter-repo`; BFG is an alternative. Rewriting changes commit hashes, requires a coordinated force push, requires collaborators to re-clone or carefully reset, and may require open pull requests to be recreated. Forks, old clones, cached views, Actions artifacts, Vercel logs, release archives, and copied build bundles may retain old data.

Run only after approval, from a fresh mirror clone, using placeholders:

```sh
git clone --mirror <repository-url> <mirror-directory>
cd <mirror-directory>
git filter-repo --path .env.local --invert-paths
git for-each-ref --format='%(refname)'
git push --force --mirror <approved-remote>
```

If a value was committed outside `.env.local`, prepare a replacement map locally without committing it, then run:

```sh
printf 'literal:<EXPOSED_CREDENTIAL_VALUE>==>REMOVED_CREDENTIAL\n' > <absolute-path-to-redacted-replacement-map>
git filter-repo --replace-text <absolute-path-to-redacted-replacement-map>
```

The replacement map must use the tool's literal/regex syntax with a placeholder replacement such as `REMOVED_CREDENTIAL`; do not paste real values into tickets or review output. Perform local verification without printing matched lines:

```sh
git rev-list --all | while read -r commit; do git grep -l '<credential-marker>' "$commit"; done
git for-each-ref --format='%(refname)' refs/heads refs/remotes refs/tags
```

Then review GitHub cached views and Actions artifacts, Vercel build logs, release archives, and copied deployment bundles. Force pushing and history rewriting are explicitly outside Batch 1A.1.

## Release gate

Before staging: complete credential rotation, populate all required test-mode values, verify the independent rate-limit secret, confirm proxy trust, and re-run type-check, tests, production build, and secret-fragment scans. Keep applicant delivery disabled until HQ approves the sender, domain, reply-to, internal recipient, and production confirmation policy.
