# 17: Automate GPS quality control

Type: task
Status: resolved
Blocked by: 07

## Behavior

The Runner starts from a locating state without choosing a sampling density. Browser observations always update GPS feedback, while only observations accepted by the shared quality gate become Valid Track Points.

## Acceptance

- High-accuracy fresh positioning is always requested while locating or recording.
- The first eligible observation creates the Run Session and starts active time.
- Weak-signal manual start begins active time without admitting an invalid observation.
- Client preview and service ingestion use the same 15-meter accuracy, uncertainty-aware movement, and 8-meters-per-second plausibility rules.
- Rejected observations are not uploaded or persisted.

## Comments

## Answer

Removed sampling-density configuration and introduced an automatic locating state. `useGpsTracking` now emits every fresh high-accuracy browser observation, while `useRunTracker` and the service share the same eligibility and plausibility rules before creating Valid Track Points. Weak-signal manual start and automatic first-fix start are covered through the public Hook seam.

Real-device evidence on 2026-08-24 superseded the initial permissive thresholds: a run contained 349.2 retained meters while remaining within 53.3 meters of its origin. Replaying the redacted observations showed that a 15-meter accuracy cap, combined-uncertainty movement gate, and 8-meters-per-second speed cap reduced the same trace to 123.3 meters. A regression test retains the minimal stationary-drift pattern.

Chrome testing over a ZeroTier LAN address exposed the secure-context requirement: `http://10.x.x.x` cannot request Geolocation in Chrome. The Hook now rejects an explicitly insecure context with an HTTPS recovery message and reports browser callback failures as structured warnings instead of triggering the Next development error overlay.
