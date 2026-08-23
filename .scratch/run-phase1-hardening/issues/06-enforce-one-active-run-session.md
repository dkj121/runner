# 06: Enforce one Active Run Session

**What to build:** A Runner can start one Personal Run, while repeated taps, multiple tabs, or an unresolved Active or Pending Completion produce a clear conflict instead of another Run Session.

**Blocked by:** 05: Expand the canonical Run model

**Status:** resolved

- [x] Starting a Personal Run creates one Active Run Session for the authenticated Runner.
- [x] A second start attempt while an Active or Pending Completion exists returns a conflict and creates nothing.
- [x] Concurrent start attempts cannot bypass the single-session rule.
- [x] The client remains idle on ordinary creation failure and shows a resolvable state on conflict.
- [x] Another Runner's Active Run Session does not block the authenticated Runner.
- [x] Public API and public Hook behavior tests cover success, repeated taps, conflict, and authentication.

## Answer

Added a Runner-scoped nullable unique session key through a new forward migration, populated it for Active Runs, and release it only on completion. The create API maps database uniqueness races to a stable 409 conflict, while the Hook coalesces repeated taps and exposes retryable ordinary/conflict errors in the Run UI. Prisma generation, ESLint, TypeScript, all 20 tests, and the production build pass.
