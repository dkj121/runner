# 12: Delete a Completed Run consistently

**What to build:** A Runner can permanently delete their own Completed Run and its sensitive route while all derived totals and leaderboard contributions are reversed consistently.

**Blocked by:** 11: Count only Completed Runs

**Status:** resolved

- [x] A Runner can initiate deletion from a Completed Run summary or history detail and must confirm it.
- [x] Only the owner can delete a Personal Run.
- [x] Deletion removes the Completed Run, canonical Track Segments, and retained location data.
- [x] Lifetime totals and any leaderboard contribution are reversed in the same database transaction.
- [x] Transaction failure leaves both the run and its aggregate contributions unchanged.
- [x] Deleted runs disappear from summaries, history, totals, and aggregates.
- [x] API and browser tests cover authorization, confirmation, successful reversal, and rollback.
