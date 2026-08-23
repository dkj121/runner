# Complete Phase 1 device verification

Type: task
Status: superseded
Blocked by: 01, 02, 03

## Behavior

Verify the complete run flow with real GPS, AMap, Redis, and MySQL on a mobile-sized viewport and record remaining spec decisions.

## Acceptance

- GPS permission, retry, pause/resume, offline failure, and stop flows are exercised.
- Track drift and sampling behavior are observed on a real device.
- Summary data matches the persisted RunRecord.
- Missing Phase 1 fields, location picker, summary route, and deferred device metrics are accepted or ticketed.

## Comments

Superseded by ticket 16 after the Phase 1 completion spec expanded the required lifecycle, persistence, and automated verification work.
