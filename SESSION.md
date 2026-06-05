# SESSION.md

## Phase status
- [x] Phase 0 — Foundations
- [x] Phase 1 — Transactional + threaded send
- [ ] Phase 2 — AI triage (BLOCKED — awaiting owner review)
- [ ] Phase 3 — UI + MCP
- [ ] Phase 4 — Brand onboarding + voice
- [ ] Phase 5 — KB + RAG + earned autonomy

## Key decisions
- Resend inbound webhook delivers metadata only; full email body fetched via `resend.Emails.Receiving.get(email_id)`. This is the authoritative approach per Resend docs.
- Repository pattern (base.py abstract + memory_repo.py + firestore_repo.py) enables testing without the Firestore emulator.
- customerId = sha256(lower(email)) as per PROJECT.md §5.
- Thread resolution priority: (1) In-Reply-To, (2) References, (3) subject+customer, (4) new.
- Threading headers on reply: In-Reply-To = rootMessageId, References = full chain, subject stable.
- Cloud Tasks AI step is stubbed in Phase 0/1 (logs + returns task_id).
- Seed brand: TrustMatch / hey.trustmatch.io.
- Subdomain convention: `hey.` (selected from PROJECT.md §16 open decisions).

## Open questions for owner
- Resend tier / domain limits — confirm before adding more brands.
- GCS bucket name and Cloud Tasks queue name for the real deploy.
- Firebase project ID for deployment.
