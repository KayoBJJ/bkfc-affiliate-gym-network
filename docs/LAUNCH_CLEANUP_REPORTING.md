# Launch cleanup reporting

The admin dashboard excludes explicitly confirmed test application IDs from its pipeline, regional statistics, filters and intake table. Retained tests stay accessible under Test history and by their original detail URLs. Classification lives in `lib/admin/test-applications.ts`; add future test IDs only after explicit confirmation. No name, email or note matching is used. This is an initial fixed registry for the three retained launch tests, not a self-service classification workflow.

Detail pages label those tests and show confirmed remote delisting as Closed / Delisted. Review and payment records are not rewritten: labels distinguish recorded history from the stored BKFC state. The existing snapshot timestamp remains visible in Gym Controls. No refund callback or current subscription state is inferred from a test ID.

Activation-completed and archived states have their own explanatory text. Activation authorization remains unchanged. No migration, email enabling, billing action, or data update is required by this release.

Validation: 204 Node tests passed, including four focused cleanup tests; production build passed. Server-rendered dashboard check with all three retained tests confirmed zero operational applications and three history links; closed payment panel renders historical labels without a false activation-blocked message.
