# 07: Ingest Valid Track Points idempotently

**What to build:** A running client can upload sequenced GPS batches that the service validates, orders, deduplicates, and retains for retry without allowing inaccurate or physically impossible points into the active route.

**Blocked by:** 05: Expand the canonical Run model; 06: Enforce one Active Run Session

**Status:** resolved

- [x] Each submitted point has a Run Session-local monotonic sequence and the required accuracy metadata.
- [x] Illegal coordinates, regressing timestamps, accuracy above 50 meters, movement below 5 meters, and implied speed above 12 meters per second are rejected from the valid route.
- [x] The first legal point is accepted without a movement check.
- [x] Replaying an accepted sequence does not duplicate a point or change its order.
- [x] The client uploads after 15 seconds or 20 queued points, whichever occurs first, and flushes when stopping.
- [x] Failed batches remain queued and retry with backoff.
- [x] Only the owning Runner can upload or read active points.
- [x] API and Hook tests cover validation, ordering, lost responses, repeated batches, and retry.

## Answer

Added sequenced GPS points with accuracy and altitude metadata, pure Valid Track Point filtering, ordered Redis storage with atomic sequence deduplication, owner-and-status API guards, 15-second/20-point client flushing, and exponential retry while retaining failed batches. Lost-response replays, invalid boundaries, ownership, ordering, batch thresholds, and retries are covered. ESLint, TypeScript, all 27 tests, and the production build pass.
