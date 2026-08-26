# 11: Count only Completed Runs

**What to build:** History, recent runs, lifetime totals, and eligible leaderboard aggregates use Completed Runs exclusively and receive each new contribution exactly once.

**Blocked by:** 10: Produce an authoritative Confirmed Run Result

**Status:** resolved

- [x] Active, Pending Completion, abandoned, and stale incomplete records are absent from all history and summary queries.
- [x] A newly Completed Run appears in the owning Runner's history and recent-run views.
- [x] Completion and lifetime-total contribution occur atomically.
- [x] Any eligible leaderboard contribution occurs in the same transaction and uses canonical numeric measurements.
- [x] Completion retries do not add a second aggregate contribution.
- [x] Personal Run routes remain owner-only and aggregate consumers receive no GPS track.
- [x] API and integration tests cover completed-only filtering, transaction rollback, and retry safety.

## Answer

Centralized the Completed Run query predicate and applied it to owner history and PlayGround leaderboard reads. Leaderboards now select only canonical numeric measurements and public profile fields, never route JSON, and format Pace only at the response boundary. The existing completion transaction atomically exposes a Completed Run and updates lifetime totals; failed aggregate writes retain temporary data for safe retry, while completed retries remain effect-free. ESLint, TypeScript, all 47 tests, and the production build pass.
