# 19: Harden Run controls and recovery

Type: task
Status: resolved
Blocked by: 17

## Behavior

The Run control lock prevents accidental application interaction until the Runner holds the same control for 1.5 seconds, and an existing Active or Pending Completion Run Session restores enough local state to continue or retry safely.

## Acceptance

- The lock overlay remains above global navigation and blocks browser back navigation.
- Lock state survives a page refresh in the current browser session.
- Unlock requires a continuous 1.5-second hold and shows progress.
- Active recovery restores distance, last Valid Track Point, Track Segment index, event sequence, and the 15-second upload schedule.
- Pending Completion recovery rebuilds the immutable retry snapshot.

## Comments

## Answer

The run-control lock now persists in session storage, covers global navigation, traps browser back navigation, and requires a continuous 1.5-second hold to unlock. Active recovery restores distance accumulation, the last Valid Track Point, Track Segment and sequence state, upload scheduling, and Pending Completion retry snapshots. All 63 tests, TypeScript, targeted ESLint, Prettier, and the production build pass.
