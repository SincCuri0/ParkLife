# Vicarious Plugin

Adds a live game session mode on top of the existing group and map infrastructure.

## What this plugin does

When a group admin activates a Vicarious session:
- A `vicarious_sessions` record is created for their group
- Group members see incoming pins in real time as normal
- The admin sees `<HostControls />` - an overlay to manage pin states
- A public URL `/vicarious/[sessionCode]` lets guests participate without an account

## What this plugin does NOT do

It does not replace or modify the map, realtime pin subscription, group system,
auth, or any other core platform functionality. It adds a new database table and
mounts a UI overlay. That is all.

## What this plugin imports from core

- `createClient()` / `createServiceClient()` from `@/lib/supabase/`
- `Pin`, `Group`, `PinStatus` types from `@/lib/types`
- `PIN_COLOURS`, `MAP_DEFAULT_CENTER` from `@/lib/constants`
- `<LiveMap />` from `@/components/LiveMap` (used in public session view, not modified)

## What this plugin adds

- `vicarious_sessions` database table (one migration to run)
- `guest_name` and `vicarious_session_id` columns on `pins` (one migration to run)
- `SessionPanel` - admin UI to start/stop sessions and copy the public link
- `HostControls` - admin map overlay showing incoming pins with state controls
- `GuestNameEntry` - name input screen for public session participants
- `SessionEndScreen` - post-session group join prompt for guests
- `useVicariousSession` hook - reads active session state for a group
- API routes under `/api/vicarious/`
- Public routes `/vicarious` and `/vicarious/[sessionCode]`

## How to activate HostControls on the map

In `src/app/map/page.tsx`:

import { useVicariousSession } from '@/plugins/vicarious/hooks/useVicariousSession'
import HostControls from '@/plugins/vicarious/components/HostControls'

For each group the current user admins, call useVicariousSession(groupId).
If a session is active, render <HostControls session={session} groupId={groupId} />.

This is the only touch point between the core platform and the plugin.
