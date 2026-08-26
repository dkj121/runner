# 14: Expire abandoned server state

**What to build:** Overlong and forgotten Run Sessions stop occupying the active-session slot and are hidden and cleaned according to the agreed twelve-hour and twenty-four-hour lifecycle limits.

**Blocked by:** 09: Introduce Pending Completion; 10: Produce an authoritative Confirmed Run Result

**Status:** resolved

- [x] An Active Run Session reaches Pending Completion after twelve hours rather than continuing indefinitely.
- [x] Active Redis events and points remain available for up to twenty-four hours.
- [x] Unresolved incomplete database records stay hidden from every user-facing query.
- [x] Records and temporary data beyond the retention window are cleaned without touching Completed Runs.
- [x] Cleanup releases the Runner's active-session slot.
- [x] Cleanup can be retried safely and is observable when it fails.
- [x] Time-controlled tests cover twelve-hour transition, twenty-four-hour retention, retry, and completed-data safety.
