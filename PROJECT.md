# PROJECT.md — bfd-support-hub

**Working name:** RelayDesk *(placeholder — rename freely)*
**Repo:** `bfd-support-hub`
**Owner:** Big Fat Dad LLC
**Vendorable to:** PeopleFinders (same pattern as RingServe)
**Status:** Spec — pre-Phase-0

---

## 1. What this is

A lightweight, multi-tenant support hub that gives every B2C app its own branded
support email experience — transactional sends, AI-drafted first-response, human
escalation, customer/thread tracking, a self-building knowledge base — across an
unlimited number of brands on **one** Resend account and **one** Cloud Run service.

It replaces Zendesk multibrand. Zendesk charges a premium per brand and bolts AI on
top; here, brands are just rows, AI is native, and the agent surfaces are a thin React
console plus Claude Cowork over a shared backend.

### Why it works
Resend now does inbound as well as outbound. One account, every brand's support
subdomain verified on it, inbound routed by the `to` field. Cost is ~Resend Pro +
Cloud Run + Gemini tokens (tens of dollars/month across all brands) versus hundreds for
Zendesk multibrand. Trade: we own deliverability, uptime, and spam handling; no vendor SLA.

---

## 2. Hard constraints from the email design (read first)

These are settled decisions, not options:

- **O365 is entirely out of scope.** Existing Outlook mailboxes (invoices, billing,
  vendor mail, internal business comms) are never touched. The hub uses **net-new
  addresses on a dedicated support subdomain per brand.**
- **Per brand: a support subdomain** (e.g. `hey.textdrop.app`, `mail.getlumis.ai`) with
  its **own MX** pointing at Resend. The apex domain's MX stays on O365, untouched.
- **Send and receive on the same identity.** A two-way support address must be receivable
  at the exact address it sends from, because customer replies go to the `From`. Keep the
  whole conversational stream on the subdomain.
- **No SMTP relay, no Graph API, no Exchange.** Microsoft is sunsetting SMTP AUTH Basic
  (disabled by default end of 2026) and explicitly steers transactional/external mail off
  that rail. Resend sends and receives everything.
- **The subdomain's DNS is a clean slate.** Resend's SPF/DKIM/DMARC live on the subdomain
  as their own self-contained set. No merging with O365's apex records, no SPF 10-lookup
  juggling.

---

## 3. Architecture

```
Customer ──▶ help@hey.brandX  (MX → Resend, per brand)
                │
                ▼
        Resend Inbound  ──(email.received webhook)──▶  Cloud Run / FastAPI
                                                          │ verify signature
                                                          │ resolve brand by `to`
                                                          │ upsert customer
                                                          │ append message to thread
                                                          ▼
                                            Gemini (Vertex) classify + draft
                                                          │  ▲
                                          Brand KB (Firestore vector) ─┘ RAG
                                                          ▼
                                          Gate: intent bucket + grounding + sentiment
                                          ├─ auto-eligible + grounded + ok ─▶ Resend Send (support@, thread headers) ─▶ Customer
                                          └─ low / sensitive / privacy ─────▶ Escalation queue (awaiting_human)
                                                                                      │
                                                          ┌───────────────────────────┴───────────────────────┐
                                                          ▼                                                     ▼
                                              React console (UI)                                   MCP server ─▶ Claude Cowork
                                              queue · thread · draft · send                        list/get/draft/send/close
                                                          │                                                     │
                                                          └──────────── both are thin clients of the same API ──┘

        Resolved escalation ──▶ KB gap (clustered) ──▶ draft article (approval queue) ──▶ KB ──▶ better grounding (flywheel)

        no-reply@hey.brandX  ◀── /transactional/send (receipts, resets, alerts; send-only)
```

Business logic lives **only** in the FastAPI backend. The React UI and the MCP server are
both thin clients calling the same endpoints — they can never drift.

---

## 4. Tech stack

| Layer | Choice |
|---|---|
| Email send + receive | Resend (one account, domain-per-brand) |
| Backend | Python / FastAPI on Cloud Run |
| Datastore | Firestore (native mode) |
| Vectors | Firestore vector search (upgrade to Vertex Vector Search only at scale) |
| AI | Gemini via Vertex AI |
| Attachments | Cloud Storage |
| UI | React + Vite + TypeScript + Tailwind on Firebase Hosting |
| Auth (agents) | Firebase Auth |
| Async work | Cloud Tasks (webhook → enqueue → process) |
| Agent console (delegated) | Claude Cowork via MCP server |
| Live docs in dev | Context7 + Firebase MCP (per CLAUDE.md convention) |

---

## 5. Data model (Firestore)

```
brands/{brandId}
  name, status: active|paused
  domains: { sendingDomain, supportSubdomain }     # e.g. "textdrop.app", "hey.textdrop.app"
  senders:  { support: "help@hey.textdrop.app", noReply: "no-reply@hey.textdrop.app" }
  resend:   { domainId, webhookSecretRef }
  voiceProfileId
  policy: {
    autoSendEnabled: false,                          # earned, not default
    confidenceThreshold: 0.75,
    retrievalThreshold: 0.70,
    sentimentFloor: -0.3,
    hardEscalateIntents: [billing_dispute, cancellation, refund, privacy_request, legal, complaint]
  }
  createdAt, updatedAt

brands/{brandId}/customers/{customerId}              # customerId = sha256(lower(email))
  email, name?, firstSeen, lastSeen, threadIds[], meta:{}

threads/{threadId}
  brandId, customerId
  subject, status: open|auto_replied|awaiting_human|snoozed|closed
  assignee?: agentId, snoozeUntil?
  rfc: { rootMessageId, references[] }               # threading
  intent?, sentiment?
  lastInboundAt, lastOutboundAt, createdAt, updatedAt

threads/{threadId}/messages/{messageId}
  direction: inbound|outbound
  from, to, subject
  bodyText, bodyHtml
  attachments: [{ id, filename, contentType, size, storagePath }]
  headers: { messageId, inReplyTo, references[] }
  ai: { intent?, confidence?, sentiment?, grounded?, retrievalHits[], draft? }
  sentVia?: resend, resendId?
  createdAt

voiceProfiles/{voiceProfileId}
  brandId, tone, style, do[], dont[], bannedPhrases[]
  greeting, signoff, signature, escalationVoice
  sampleReplies[], sourceRefs: { website, repo, interview }
  version, updatedAt

kb/{brandId}/articles/{articleId}
  title, slug, bodyMarkdown
  status: draft|published|archived
  source: manual|escalation_cluster
  tags[], embeddingRef, views, helpfulVotes, createdAt, updatedAt

kb/{brandId}/gaps/{gapId}
  questionCluster, exampleThreadIds[], proposedArticleDraft
  status: pending|approved|dismissed

agents/{agentId}
  email, name, role: owner|agent, brands[]
```

---

## 6. Inbound processing pipeline

1. `POST /webhooks/resend/inbound` — **verify Resend signature first** (reject if invalid).
2. Resolve `brandId` from the `to` address/subdomain. Unknown → dead-letter, alert.
3. Upsert `customer` (by email hash). Resolve or create `thread` using
   `In-Reply-To` / `References` → fall back to subject + customer match → else new thread.
4. Persist inbound `message` (text, html, attachments to Cloud Storage).
5. Enqueue Cloud Task → AI step (keep webhook fast; Resend stores redundantly anyway).
6. **AI step:** classify intent + sentiment, run RAG over brand KB, draft a reply in brand voice.
7. **Gate** (§7). Auto-send or queue.

---

## 7. Confidence gate & escalation policy

Do **not** trust raw model self-confidence as the sole signal. The gate is a composite:

- **Intent bucket** (classified): `general_question, account_help, how_to, feature_request,
  bug_report, billing_question, billing_dispute, cancellation, refund, privacy_request,
  legal, complaint, spam`.
- **Hard-escalate intents** (never auto-send, per-brand configurable): billing_dispute,
  cancellation, refund, **privacy_request**, legal, complaint.
- **Grounding:** run RAG. If top retrieval score < `retrievalThreshold`, mark *not grounded*
  → escalate **and** open a `kb/gaps` candidate.
- **Sentiment:** below `sentimentFloor` → escalate (route an unhappy customer to a human).
- **Auto-send only if:** `autoSendEnabled` AND intent is auto-eligible AND grounded AND
  sentiment ok AND draft passes a self-check. Otherwise → `awaiting_human`.

> **Compliance (non-negotiable):** `privacy_request` (CCPA/GDPR access or deletion) is
> **never** answered by an LLM free-form. It either routes to a human or emits a fixed,
> compliance-approved template. Given the consumer-data context this is a regulatory
> landmine, not a support ticket. Treat the same way for any data-subject request.

`autoSendEnabled` ships **false** for every brand. Auto-send is turned on per brand only
after the queue has proven the drafts are good (Phase 5).

---

## 8. Brand onboarding agent

Generalizes the Quill voice-interview pattern.

1. **Ingest:** crawl the brand website + read the repo (README, product copy, docs).
2. **Interview:** structured voice interview with the owner (tone, do/don't, signature,
   escalation phrasing, edge cases).
3. **Emit `voiceProfile`:** tone, style, do[], dont[], bannedPhrases[], greeting/signoff,
   sample replies, escalation voice. Versioned.
4. KB starts **empty** and grows from real tickets (§9).

`POST /brands/{id}/onboard { websiteUrl, repoUrl? }` kicks it off; result lands in
`voiceProfiles` for owner approval before it's used in live drafts.

---

## 9. Knowledge base & RAG flywheel

- KB articles live in `kb/{brandId}/articles`, embedded into Firestore vector search.
- Drafts are grounded: embed inbound question → retrieve top chunks → ground + cite.
- Weak retrieval → escalate **and** create a `kb/gaps` candidate.
- Resolved escalations are clustered into gap candidates → proposed article drafts →
  **approval queue** → published article → embedded → answerable next time.
- KB doubles as the public help-center source and the RAG grounding source.

Loop: escalations → articles → grounding → fewer escalations.

---

## 10. API surface (FastAPI)

```
# Webhook (signature-auth, not Firebase-auth)
POST   /webhooks/resend/inbound

# Threads / queue
GET    /threads?brandId=&status=&q=&assignee=
GET    /threads/{id}
POST   /threads/{id}/draft          { guidance? }      # (re)generate AI draft
POST   /threads/{id}/reply          { body }           # send via Resend + thread headers
POST   /threads/{id}/escalate
POST   /threads/{id}/assign         { agentId }
POST   /threads/{id}/snooze         { until }
POST   /threads/{id}/close

# Transactional (called by the apps)
POST   /transactional/send          { brandId, template, to, vars }   # no-reply, send-only

# Brands
GET    /brands
POST   /brands
PATCH  /brands/{id}
POST   /brands/{id}/onboard         { websiteUrl, repoUrl? }
GET    /brands/{id}/voice
PUT    /brands/{id}/voice

# KB
GET    /kb/{brandId}/articles
POST   /kb/{brandId}/articles
PATCH  /kb/{brandId}/articles/{id}
GET    /kb/{brandId}/gaps
POST   /kb/{brandId}/gaps/{id}/approve     # -> creates article draft
```

**Reply send rules:** `From` = brand `support` sender; set `In-Reply-To` + `References`
from `thread.rfc`; keep subject stable so replies thread back.

---

## 11. MCP server (Claude Cowork surface)

Thin wrappers over §10. Same logic, no duplication.

```
list_threads(brand?, status?, query?)        -> [{id, brand, subject, customer, status, snippet}]
get_thread(thread_id)                          -> full thread + messages + customer history
draft_reply(thread_id, guidance?)              -> ai draft (does not send)
send_reply(thread_id, body)                    -> sends via Resend, appends outbound, updates status
escalate_thread(thread_id)
assign_thread(thread_id, agent_id)
snooze_thread(thread_id, until)
close_thread(thread_id)
list_kb_gaps(brand?)                           -> pending gap candidates
approve_kb_gap(gap_id)                          -> creates article draft
get_voice_profile(brand)                        -> voice profile for drafting in-tone
```

Cowork is the delegation surface ("clear the queue, draft in brand voice, flag anything
about refunds"). The React console is the live triage surface. Both call the same backend.

---

## 12. Lightweight UI — "Zendesk superlight"

React + Vite + TS + Tailwind on Firebase Hosting; Firebase Auth for agents; Firestore
`onSnapshot` for live queue/thread updates; all mutations go through the FastAPI endpoints.

**Screens / components:**

- **Unified queue** — all threads, filterable by **brand** + **status**, with
  `awaiting_human` front and center. Brand switcher in one pane *is* the multibrand feature.
  Columns: customer, subject, brand chip, status, last activity, intent/sentiment badge.
- **Thread view** — full conversation timeline; right-hand **customer panel** (their other
  threads + history); **reply box pre-filled with the Gemini draft** + Regenerate + Send;
  attachment rendering.
- **Quick actions** — escalate, assign, snooze, close, canned responses.
- **KB tab** — list articles (draft/published); **gap-approval inbox** to turn escalation
  clusters into article drafts.
- **Brand settings** — senders, voice profile (view/approve), policy toggles incl.
  `autoSendEnabled` and thresholds.

States to design: empty queue, loading, send-in-flight, send-failure, no-draft-available,
escalated banner, snoozed, closed.

---

## 13. Per-brand DNS checklist (support subdomain)

For each brand, on the **subdomain** (e.g. `hey.textdrop.app`) — apex untouched:

- [ ] Verify the subdomain in Resend (send + receive).
- [ ] **MX** `hey.textdrop.app` → Resend inbound MX (per Resend dashboard).
- [ ] **SPF** TXT on subdomain: `v=spf1 include:<resend-send> ~all` (clean, self-contained).
- [ ] **DKIM** CNAME(s) provided by Resend, on the subdomain.
- [ ] **DMARC** TXT on subdomain: start `p=none`, tighten to `quarantine` as it warms.
- [ ] Configure Resend inbound webhook → `/webhooks/resend/inbound`; store signing secret.
- [ ] Apex `textdrop.app` MX/SPF/DKIM: **DO NOT TOUCH** (O365).
- [ ] Warm-up: don't blast a backlog day one.

---

## 14. Phased build plan

Everything escalates before anything auto-sends. Stop at each phase boundary for review.

**Phase 0 — Foundations.** Repo, FastAPI skeleton on Cloud Run, Firestore schema + security
rules, Resend account, verify ONE brand subdomain (send+receive), inbound webhook that
persists messages.
*Exit:* a real email to `help@hey.<brand>` lands as a thread in Firestore.

**Phase 1 — Transactional + threaded send.** `/transactional/send` (no-reply);
`/threads/{id}/reply` with correct `In-Reply-To`/`References`; outbound persisted.
*Exit:* you reply to a thread and the customer's reply threads back into it.

**Phase 2 — AI triage, escalate-only.** Gemini classify + sentiment + draft; the §7 gate
with `autoSendEnabled=false` so everything queues; hard-escalate intents wired.
*Exit:* every inbound gets a classified draft sitting in `awaiting_human`; nothing auto-sends.

**Phase 3 — UI + MCP.** React console (§12) on Firebase Hosting + Auth; MCP server (§11);
connect to Cowork.
*Exit:* you run real support from both the console and Cowork.

**Phase 4 — Brand onboarding + voice.** Onboarding agent (§8); drafts use the brand voice
profile.
*Exit:* a new brand onboarded end-to-end produces a usable, owner-approved voice profile.

**Phase 5 — KB + RAG + earned autonomy.** KB articles + Firestore vector search; RAG
grounding in drafts; gap flywheel from escalations; then flip `autoSendEnabled=true` per
brand for auto-eligible + grounded + positive cases.
*Exit:* high-confidence grounded replies auto-send; escalations generate KB candidates.

---

## 15. Security & compliance

- Verify Resend webhook signature on every inbound; webhook endpoint is signature-auth only.
- Firestore rules: agents read/write only `brands[]` they belong to; no public access.
- All agent API calls behind Firebase Auth.
- Attachments to Cloud Storage; size/type limits; scan; ephemeral handling where possible.
- PII minimization: store customer email + necessary fields only; never log message bodies
  in plaintext app logs.
- `privacy_request` routing per §7 — human or fixed template, never free-form LLM.
- One brand's DNS mistake can only affect that brand (subdomain isolation). Cut over one at a time.

---

## 16. Open decisions / defaults to confirm

- Default thresholds: `confidence 0.75`, `retrieval 0.70`, `sentiment floor -0.3` — tune in Phase 5.
- Resend tier: confirm current domain-count + inbound-volume limits per tier vs. brand count.
- Subdomain convention: pick one (`hey.`, `mail.`, `hello.`, `m.`) and standardize across brands.
- SLA/business-hours behavior: out of scope for v1 unless needed.
- Multi-agent: schema supports it; v1 may be single-agent (you).
