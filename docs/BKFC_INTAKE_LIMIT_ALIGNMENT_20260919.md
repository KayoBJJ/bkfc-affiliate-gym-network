# BKFC intake limit alignment — 19 September 2026

Prepared locally; not deployed.

AJ supplied the official form limits during the fresh staging retest. The EU O1 validator now accepts gymName up to 200 characters, phone up to 50, and disciplinesOffered up to 2,000 total input characters without the previous 100-character-per-item or 20-item restrictions. Other advertised text length limits already match. Required integration fields (plan, consent and identity headers) remain required.

Website values without a scheme gain https://. Instagram accepts a bare handle, @handle or Instagram URL. Existing explicit URLs retain their canonical representation. Unsafe schemes, URL credentials and non-Instagram profile URLs remain rejected.

Disciplines retain existing split/normalization behavior and canonical array hashing. Persistence joins these entries with comma-space; that rendered value can be longer than the original input through inserted spaces or Unicode normalization. The database stores it as text without a length constraint; the advertised 2,000-character limit applies to the incoming field. Previously accepted inputs retain their canonical payload hash.

## File-upload limitation still pending

Initial O1 multipart logos remain limited to 3 MiB, PNG/JPEG/WebP. This does NOT yet match AJ's 10 MB form limit. Vercel's function request-body limit is 4.5 MB (https://vercel.com/docs/functions/limitations), so raising the validator limit alone cannot solve it. The separate gym-control logo upload flow is not an initial-application upload contract.

To support 10 MB originals, agree an initial-submission direct-storage upload and authenticated upload-reference contract with AJ, including ownership, expiration, content validation and abandoned-file cleanup. An alternative is for AJ to resize/compress logos below the existing transport limit before forwarding. Do not advertise 10 MB O1 support or silently truncate text.

## Validation

- Six focused validation/canonicalization/boundary tests pass.
- TypeScript check passes; git diff whitespace check passes.
- Full suite rerun with localhost network permission: 193/193 pass. Production build also passes. The earlier sandbox-only EPERM failure is resolved.
- No database migration is needed for these text changes. No hosted settings, application records, deployment or production rollout changed.

Next: stage the text update and retry AJ's same failed source application, then complete the initial-logo transport agreement before claiming full form compatibility.
