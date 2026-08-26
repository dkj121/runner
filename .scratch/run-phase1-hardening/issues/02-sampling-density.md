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

Superseded on 2026-08-24 by issue 17. Real-device feedback showed that exposing GPS sampling density creates a technical choice without giving the Runner a reliable quality guarantee. Phase 1 now requests high accuracy automatically and applies a shared quality gate.

## Answer

`useGpsTracking` now refreshes its interval from the density passed through `useRunTracker`. Public-hook tests verify high, medium, and low selections emit GPS points at 1, 5, and 10 second intervals.
