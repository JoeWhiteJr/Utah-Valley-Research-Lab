---
id: UVRL-T001
title: Infrastructure prep before Effort Justification study launch
status: open
created: 2026-06-05
priority: high
blocks: EJ study public launch
assigned-team: TBD
---

## Problem

The EJ study (`/study/effort-justification` — Treasure Hunt, Career Choice, Pattern Memory)
will be taken by many participants on production. Current EC2 infrastructure has
known limits that will cause participant-facing failures at scale.

Today (2026-06-05):
- Root EBS volume is 6.8 GB, currently **86% used / 998 MB free** after cleanup.
- Postgres data lives on the same root volume (`/var/lib/docker/volumes/.../postgres_data`).
- Per-participant DB cost ≈ 200–400 KB (assignment row + final JSONB payload + autosave snapshots + Postgres overhead).
- **Hard cap: ~1,500–3,000 completed participants** before disk crosses 95% and Postgres refuses writes — at which point `/study/start` and `/study/save` return 500.

Secondary risks under load:
- WAL bursts during concurrent finishes (100–300 MB transient).
- Docker container logs grow unbounded by default (~50–100 MB/day at modest traffic).
- DB backups may dump locally before S3 upload (need to verify); a local dump is ~2× DB size.

## Acceptance criteria

- [ ] Root EBS resized from 8 GB → 20 GB (volume + partition + filesystem).
- [ ] `df -h /` reports < 50% used after resize.
- [ ] CloudWatch alarm on root volume `DiskSpaceUtilization > 80%` with email/SMS notification.
- [ ] Docker daemon configured with log rotation (50 MB max-size, 3 max-file per container).
- [ ] Backup script verified to stream to S3 without staging full dump on local disk (or rotated within 24h).
- [ ] Load test simulating 100 concurrent participants completes without 5xx errors (k6 or autocannon).
- [ ] Backup restore tested end-to-end from S3 → fresh DB.
- [ ] Replace `TODO_LAB_EMAIL@uvu.edu` and `TODO_IRB_EMAIL@uvu.edu` in `Consent.jsx` + `Debrief.jsx` with the real IRB-approved contacts.

## Notes / Why this matters

The EJ study's storage profile is favorable (text-only JSONB, no audio/video/file uploads
from participants), so the main risk is infrastructure size, not the app itself.
Resize is a permanent fix; cleanup alone is not — logs and Docker images will repopulate
the freed space within weeks.

Cert auto-renewal hooks are already in place (2026-06-04) so the SSL outage that
prompted this work won't recur. Renewal hooks live at:
- `/etc/letsencrypt/renewal-hooks/pre/stop-docker.sh`
- `/etc/letsencrypt/renewal-hooks/post/start-docker.sh`

## Retrospective

_To fill in after merge._
