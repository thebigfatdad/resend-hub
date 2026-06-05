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
- Seed brands: TrustMatch (subdomain TBD), PersonIQ (app.personiq.io ✓ live), WhosCalling (app.whoscalling.io ✓ live).
- Subdomain convention: **per-brand, decided at setup time** — no fixed prefix. `app.` is used for PersonIQ and WhosCalling; TrustMatch and future brands use whatever subdomain is verified in Resend.

## Live brands (Resend already verified)
| Brand | Support subdomain | Support sender | No-reply sender | Secret env var |
|---|---|---|---|---|
| PersonIQ | app.personiq.io | support@app.personiq.io | no-reply@app.personiq.io | RESEND_WEBHOOK_SECRET_PERSONIQ |
| WhosCalling | app.whoscalling.io | support@app.whoscalling.io | no-reply@app.whoscalling.io | RESEND_WEBHOOK_SECRET_WHOSCALLING |
| TrustMatch | TBD | TBD | TBD | RESEND_WEBHOOK_SECRET_TRUSTMATCH |

All three brands share one webhook signing secret — one Resend account, one webhook endpoint.
Webhook endpoint URL: webhook.site placeholder for now; update to Cloud Run URL at deploy time.

## Open questions for owner
- Resend tier / domain limits — confirm before adding more brands.
- GCS bucket name and Cloud Tasks queue name for the real deploy.
- Firebase project ID for deployment.
