# CLAUDE.md — bfd-support-hub

## What this is
Multi-brand customer support hub (working name: RelayDesk). Full spec: PROJECT.md.

## Four-agent pattern
Every significant change follows this flow:
1. **Architect** — reads PROJECT.md + CLAUDE.md, designs the change, writes a plan to `/plans/<name>.md`. Never writes production code.
2. **Worker** — implements exactly what the plan says. Never designs from memory. Ambiguity → stop and ask.
3. **Reviewer** — diffs against PROJECT.md contracts. Rejects: logic in /web or /mcp, untested paths, spec deviations, Resend/Firestore calls written from memory.
4. **Memory** — maintains SESSION.md at repo root: phase status, key decisions, open questions. Updated after every phase.

## Live docs (mandatory)
Before writing ANY integration code for these services, look up current API signatures:
- **Context7** (`resolve_library_id` → `get_library_docs`): `resend` Python SDK, `fastapi`, `google-cloud-firestore`, `google-cloud-tasks`, Vertex AI SDK
- **Firebase MCP**: Firestore security rules syntax, Cloud Tasks queue config

Do NOT write Resend, Firestore, or Vertex code from training memory. APIs change.

## Layout
- `/api` — Python/FastAPI — ALL business logic here
- `/web` — React+Vite+TS+Tailwind — thin HTTP client only (Phase 3)
- `/mcp` — MCP server — thin wrappers over /api (Phase 3)
- `/infra` — Firestore rules, indexes, deployment config

## Hard constraints (PROJECT.md §2)
- O365 is never touched. Per-brand support subdomains only. Apex MX stays on O365.
- No SMTP relay, no Graph API. Resend sends and receives everything.
- All business logic in /api. /web and /mcp are thin clients, zero logic.
- Resend signature verified on every inbound webhook before any processing.
- `privacy_request` intents: never answered by LLM free-form — human or fixed template only.

## Phase status
See SESSION.md.

## Testing
- Tests in `api/tests/`. Run: `cd api && pytest`
- Nothing merges without green tests.
- Unit/integration tests use in-memory repos injected via FastAPI dependency overrides.
