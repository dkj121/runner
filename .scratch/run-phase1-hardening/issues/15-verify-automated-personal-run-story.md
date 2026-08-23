# 15: Verify the automated Personal Run story

**What to build:** A repeatable automated acceptance story proves the full Personal Run lifecycle across the browser, public API, persistence, and confirmed summary before real-device testing begins.

**Blocked by:** 12: Delete a Completed Run consistently; 13: Contract the legacy measurement model; 14: Expire abandoned server state

**Status:** ready-for-agent

- [ ] The automated story covers start, GPS capture, pause, resume, stop, Pending Completion, completion, summary, history, and deletion.
- [ ] Controlled geolocation verifies Track Segment breaks, filtering, canonical distance, Pace, and splits.
- [ ] Controlled failures cover permission denial, upload failure, completion failure, lost responses, repeated batches, and retry.
- [ ] Concurrency coverage includes repeated taps, multiple tabs, and an unresolved previous session.
- [ ] Authorization coverage proves Personal Run tracks remain owner-only.
- [ ] Completed-only queries, aggregate contribution, deletion reversal, timeout, and cleanup are verified end to end.
- [ ] The full test suite, type checking, linting, formatting, and production build pass.
- [ ] No Run correctness or location-data P0/P1 finding remains open.
