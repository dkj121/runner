# 05: Expand the canonical Run model

**What to build:** Introduce the canonical Run lifecycle and measurement representation beside the legacy representation so later vertical slices can migrate safely without breaking the existing application or rewriting migration history.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Add explicit persisted Run statuses for Active, Pending Completion, and Completed Runs.
- [x] Add canonical distance-in-meters and duration-in-seconds representations beside existing measurement fields.
- [x] Add the ordered Run Event and sequenced track-point contracts needed by later slices.
- [x] Add only new forward migrations; do not edit or replace any existing migration.
- [x] Existing Run API and UI behavior remains green through a temporary compatibility boundary.
- [x] Characterization tests prove legacy readers and writers continue to work during expansion.

## Answer

Added the persisted Run lifecycle and canonical measurement fields through a new forward-only migration, introduced shared sequenced Run Event and track-point contracts, and kept legacy API readers and completion writers compatible while also populating canonical values. Prisma generation, ESLint, TypeScript, all 15 tests, and the production build pass.
