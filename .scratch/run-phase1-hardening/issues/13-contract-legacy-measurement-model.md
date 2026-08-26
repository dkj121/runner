# 13: Contract the legacy measurement model

**What to build:** Complete the expand-contract migration by moving every remaining consumer to canonical meters, seconds, numeric Pace, explicit status, and WGS-84 data, then safely remove obsolete measurement representations.

**Blocked by:** 10: Produce an authoritative Confirmed Run Result; 11: Count only Completed Runs; 12: Delete a Completed Run consistently

**Status:** resolved

- [x] All API, UI, summary, aggregate, logging, and documentation consumers use explicit canonical measurement names and units.
- [x] No business comparison or sorting uses formatted Pace strings.
- [x] A new forward migration converts existing kilometer values to meters and initializes status from prior completion data.
- [x] Existing migration files remain byte-for-byte unchanged.
- [x] Legacy measurement fields are removed only after no reader or writer depends on them.
- [x] Existing Completed Runs retain equivalent displayed measurements after conversion.
- [x] Type checking, tests, linting, formatting, and production build remain green after contraction.
