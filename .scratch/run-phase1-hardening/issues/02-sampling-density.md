# Make sampling density effective

Type: task
Status: resolved
Blocked by: 01

## Behavior

The density selected before starting a run controls GPS point emission: high every 1 second, medium every 5 seconds, and low every 10 seconds.

## Acceptance

- Changing density before start updates the interval used by the GPS watcher.
- Each density has behavior coverage at the `useRunTracker` seam.

## Comments

## Answer

`useGpsTracking` now refreshes its interval from the density passed through `useRunTracker`. Public-hook tests verify high, medium, and low selections emit GPS points at 1, 5, and 10 second intervals.
