# Reliable run completion

Type: task
Status: resolved

## Behavior

Stopping a run must not mark it finished or navigate to its summary when GPS flushing or final persistence fails. The caller must receive a failure it can surface or retry.

## Acceptance

- A failed GPS flush retains queued points.
- A failed final PATCH leaves the run outside the `finished` state.
- A successful flush and PATCH returns the completed run ID and marks the run finished.
- Behavior is covered through the public `useRunTracker` interface.

## Comments

## Answer

`useRunTracker.stop()` now keeps the run active when queued GPS points or the final RunRecord fail to persist. Failed point batches remain queued and scheduled uploads retry them. Three public-hook behavior tests cover final PATCH failure, stop-time point retry, and scheduled point retry.
