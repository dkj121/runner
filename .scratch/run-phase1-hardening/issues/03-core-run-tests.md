# Add core run behavior coverage

Type: task
Status: resolved
Blocked by: 01, 02

## Behavior

Protect distance, duration, pace, splits, authentication, and RunRecord ownership behavior with automated tests.

## Acceptance

- Track calculations use worked examples with known expected results.
- Run lifecycle covers start, pause, resume, and stop.
- Run APIs reject unauthenticated and non-owner requests.

## Comments

## Answer

Added worked-example coverage for distance, duration, and pace; public `useRunTracker` coverage for failed creation, pause/resume timing, reliable stop, GPS retries, and sampling density; and public Run API coverage for unauthenticated creation and non-owner access.
