# 09: Introduce Pending Completion

**What to build:** Stopping a Run Session freezes its local result and moves it into Pending Completion until the Runner successfully retries the same completion or explicitly abandons it.

**Blocked by:** 06: Enforce one Active Run Session; 07: Ingest Valid Track Points idempotently; 08: Build pause-safe Track Segments

**Status:** resolved

- [x] Stopping flushes queued points and enters Pending Completion rather than claiming success.
- [x] A session with fewer than ten active seconds or fewer than two Valid Track Points is abandoned instead of completed.
- [x] Pending Completion preserves one immutable stop time, event timeline, and point snapshot across retries.
- [x] Upload or completion failure shows an explicit reason and retry action.
- [x] A Pending Completion cannot resume recording.
- [x] Abandonment requires confirmation, removes local temporary data, and requests server cleanup.
- [x] Incomplete and abandoned work remains absent from history and statistics.
- [x] Hook and browser behavior tests cover retry, repeated stop, minimum thresholds, and abandonment.

## Answer

Stopping now freezes one immutable snapshot, stops GPS immediately, and enters Pending Completion before any success state. A server transition validates the STOP event, ten active seconds, and two Valid Track Points; sub-threshold runs are removed. Upload, event, transition, and completion failures remain retryable with explicit UI feedback, while confirmed abandonment requires browser confirmation and cleans server and local state. Run history now filters to Completed only. ESLint, TypeScript, all 38 tests, and the production build pass.
