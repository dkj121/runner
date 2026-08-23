# 11: Count only Completed Runs

**What to build:** History, recent runs, lifetime totals, and eligible leaderboard aggregates use Completed Runs exclusively and receive each new contribution exactly once.

**Blocked by:** 10: Produce an authoritative Confirmed Run Result

**Status:** ready-for-agent

- [ ] Active, Pending Completion, abandoned, and stale incomplete records are absent from all history and summary queries.
- [ ] A newly Completed Run appears in the owning Runner's history and recent-run views.
- [ ] Completion and lifetime-total contribution occur atomically.
- [ ] Any eligible leaderboard contribution occurs in the same transaction and uses canonical numeric measurements.
- [ ] Completion retries do not add a second aggregate contribution.
- [ ] Personal Run routes remain owner-only and aggregate consumers receive no GPS track.
- [ ] API and integration tests cover completed-only filtering, transaction rollback, and retry safety.
