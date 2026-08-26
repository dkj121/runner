# Personal Run automated acceptance

Date: 2026-08-23

## Browser story

The repeatable browser script is `scripts/verify-personal-run-browser.js`. It runs at a 390×844 viewport with controlled geolocation and mocked public HTTP boundaries.

Start a dev server on the isolated verification port:

```powershell
node node_modules/next/dist/bin/next dev --turbopack -p 3010
```

Run the story:

```powershell
playwright-cli open --mobile
playwright-cli run-code --filename scripts/verify-personal-run-browser.js
playwright-cli close
```

The story asserts one start, pause, resume, stop, Pending Completion transition, completion, canonical summary render, confirmed deletion, no document 5xx response, and final navigation back to `/run`. The localhost-only `personalRunBrowserTest=1` entry sets a development verification cookie; it is unavailable on non-localhost hosts and production layouts.

## Automated coverage

| Risk                                                   | Verification                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| GPS quality control and permission denial              | `src/hooks/use-gps-tracking.test.ts`, `src/hooks/use-run-tracker.test.ts`                     |
| Repeated start taps and unresolved session conflict    | `src/hooks/use-run-tracker.test.ts`, `src/app/api/runs/routes.test.ts`                         |
| Upload failure, lost response, repeated batches, retry | `src/hooks/use-run-tracker.test.ts`, `src/lib/gps-cache.test.ts`                               |
| Pause-safe segments and no pause connector             | `src/hooks/use-run-tracker.test.ts`, `src/lib/run-timeline.test.ts`                            |
| Point filtering and canonical calculations             | `src/lib/track-point-validation.test.ts`, `src/lib/confirmed-run.test.ts`                      |
| Pending Completion and completion retry                | `src/app/api/runs/pending-completion-route.test.ts`, `src/app/api/runs/complete-route.test.ts` |
| Owner-only route access                                | `src/app/api/runs/points-route.test.ts`, `src/app/api/runs/routes.test.ts`                     |
| Completed-only history and leaderboard                 | `src/app/api/runs/routes.test.ts`, `src/app/api/playgrounds/leaderboard-route.test.ts`         |
| Aggregate contribution and rollback                    | `src/app/api/runs/complete-route.test.ts`                                                      |
| Confirmed deletion and reversal                        | `src/app/(dashboard)/summary/page.test.tsx`, `src/app/api/runs/routes.test.ts`                 |
| Twelve-hour timeout and twenty-four-hour cleanup       | `src/lib/run-lifecycle.test.ts`, `src/lib/gps-cache.test.ts`                                   |

## Result

- Browser story: passed on Chromium mobile emulation at 390×844.
- Public API and persistence seams: passed through route tests with transaction assertions.
- Run correctness and location-data findings from the Phase 1 review are covered by the automated suite.
- Real Android Chrome and iOS Safari evidence remains ticket 16.
