---
description: "Use when editing multiplayer room synchronization, room API/client wrappers, lobby polling, join/create errors, or room capacity limits. Covers app/api/room, lib/room.ts, and components/setup-screen.tsx."
applyTo: ["app/api/room/**", "lib/room.ts", "components/setup-screen.tsx"]
---

# Multiplayer Room Rules

- Keep the server API and client wrappers aligned: any change to room payloads, status values, or error shapes must be reflected in `lib/room.ts` and the lobby flow in `components/setup-screen.tsx`.
- Preserve room code normalization and validation. Treat room codes consistently in uppercase, and reject invalid or incomplete input with a clear PT-PT message.
- Enforce room capacity and status checks on the server first. The client may guide the user, but the API must remain the source of truth for `waiting` versus `playing` and for max-player limits.
- Keep join/create/start errors specific, user-facing, and in PT-PT. Prefer actionable messages over generic failures.
- When changing lobby synchronization, ensure polling, room refresh, and game start remain race-safe. Do not start the game before the room state confirms the final player list.
- If room behavior changes, update the host/joiner UX together so the lobby state, displayed counts, and automatic start behavior stay consistent.
