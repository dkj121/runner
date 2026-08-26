# 20: Fix live Pace and Completed Run summary

Type: task
Status: resolved
Blocked by: 18

## Behavior

The active Run interface reports a rolling current Pace with conventional formatting, while the Completed Run summary prioritizes confirmed measurements and presents scalable kilometer splits on mobile screens.

## Acceptance

- Ordinary valid movement over more than ten seconds and ten meters produces a current Pace.
- Average, current, and split Pace values share the `5'30"` presentation with `/km` shown separately.
- Confirmed splits interpolate exact kilometer boundaries instead of assigning an entire GPS interval to one kilometer.
- A final partial split of at least 100 meters is retained and normalized to Pace per kilometer.
- The summary shows confirmed distance and core metrics before a compact map.
- Kilometer splits use a vertical layout that remains readable for long runs and identifies the final partial distance.
- Historical splits without the new JSON fields remain readable.

## Comments

## Answer

Corrected a kilometer-versus-meter unit mismatch that prevented the 30-second rolling Pace window from ever updating. Pace formatting now uses one presentation helper. Confirmed splits interpolate boundary time and include a meaningful final partial split without changing the database schema or any migration. The summary now uses a compact route map, a single confirmed-result scoreboard, and vertically scalable split rows.
