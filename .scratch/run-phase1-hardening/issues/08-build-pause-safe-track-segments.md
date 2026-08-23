# 08: Build pause-safe Track Segments

**What to build:** Starting, pausing, resuming, and stopping produce an ordered activity timeline whose active intervals and Track Segments exclude paused time and movement from calculations and map display.

**Blocked by:** 07: Ingest Valid Track Points idempotently

**Status:** resolved

- [x] Start, pause, resume, and stop are represented as ordered Run Events.
- [x] Active duration is the sum of event-defined active intervals rather than first-to-last GPS time.
- [x] Pausing closes the current Track Segment and resuming opens a new one at the next Valid Track Point.
- [x] Movement and elapsed wall time during a pause do not affect distance, duration, Pace, splits, or Estimated Calories.
- [x] The map renders separate Track Segments without a connecting pause line.
- [x] Invalid or conflicting event order is rejected without corrupting the active timeline.
- [x] Public API, Hook, and map behavior tests cover multiple pause and resume cycles.

## Answer

Added a shared-sequence Run Event timeline with validated START/PAUSE/RESUME/STOP transitions, Redis persistence, and an owner-protected events API. Track Points now carry segment indexes; duration, distance, Pace windows, splits, calories, live API results, and map polylines reset across pauses. Multiple-cycle Hook, API, timeline, validation, and segment grouping behavior is covered. ESLint, TypeScript, all 35 tests, and the production build pass.
