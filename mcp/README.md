# mcp — Phase 3 stub

MCP server exposing thin wrappers over `/api` for Claude Cowork.

This directory contains **zero business logic** — it only calls FastAPI endpoints.

## Status
Phase 3 — not yet implemented.

## Planned tools
- `list_threads(brand?, status?, query?)`
- `get_thread(thread_id)` — full thread + messages + customer history
- `draft_reply(thread_id, guidance?)`
- `send_reply(thread_id, body)`
- `escalate_thread(thread_id)`
- `assign_thread(thread_id, agent_id)`
- `snooze_thread(thread_id, until)`
- `close_thread(thread_id)`
- `list_kb_gaps(brand?)`
- `approve_kb_gap(gap_id)`
- `get_voice_profile(brand)`
