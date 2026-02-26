# API Contract Snapshot

Generated: 2026-02-21

This file freezes existing `src/app/api/**` response contracts during migration. Existing endpoint shapes are treated as immutable; only additive routes are introduced for sync/local-first migration.

| Method | Route |
|---|---|
| POST | /api/auth/host |
| POST | /api/auth/magic-link |
| POST | /api/comments |
| DELETE | /api/comments/[id] |
| GET | /api/groups |
| POST | /api/groups |
| GET | /api/groups/[id] |
| POST | /api/groups/[id]/join |
| POST | /api/groups/[id]/leave |
| GET | /api/groups/[id]/manage |
| GET | /api/groups/[id]/plugins |
| POST | /api/groups/[id]/plugins |
| DELETE | /api/groups/[id]/plugins/[pluginKey] |
| PATCH | /api/groups/[id]/plugins/[pluginKey] |
| GET | /api/groups/[id]/requests |
| PATCH | /api/groups/[id]/requests/[requestId] |
| GET | /api/groups/invite/[code] |
| GET | /api/notifications |
| PATCH | /api/notifications/[id] |
| POST | /api/notifications/read |
| POST | /api/pins |
| DELETE | /api/pins/[id] |
| PATCH | /api/pins/[id] |
| DELETE | /api/pins/[id]/reactions |
| POST | /api/pins/[id]/reactions |
| POST | /api/pins/[id]/resolve |
| GET | /api/profile/settings |
| PATCH | /api/profile/settings |
| POST | /api/push/subscribe |
| POST | /api/push/unsubscribe |
| POST | /api/reports |
| PATCH | /api/reports/[id] |
| GET | /api/sessions |
| POST | /api/sessions |
| POST | /api/sessions/[id]/end |
| GET | /api/sessions/[id]/pins |
| DELETE | /api/users/[id]/block |
| POST | /api/users/[id]/block |
| POST | /api/vicarious/guest-pin |
| POST | /api/vicarious/sessions |
| PATCH | /api/vicarious/sessions/[id] |


