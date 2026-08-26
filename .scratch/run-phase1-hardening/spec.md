# Run Phase 1 Completion

Status: ready-for-agent

## Problem Statement

The Runner project has an end-to-end Personal Run implementation, but Phase 1 cannot yet be considered complete. A Run Session can currently appear finished even when persistence fails, client-selected GPS behavior can diverge from actual tracking, the service trusts client-calculated measurements, paused movement can contaminate the route, incomplete records can leak into history, and the existing data model uses ambiguous units and formatted Pace strings. The team needs a precise internal-test release bar that protects run correctness, privacy, retry behavior, statistics, and real-device usability without pulling Phase 2 capabilities into scope.

## Solution

Deliver a reliable Personal Run lifecycle in which each Runner has at most one Active Run Session, location data is accepted only as ordered and plausible Valid Track Points, pauses create separate Track Segments, and stopping produces a Pending Completion until the service validates and retains a Confirmed Run Result. The service becomes authoritative for measurements, completion is immutable and idempotent, incomplete work stays out of history and statistics, and a Runner can retry, abandon, review, or delete their own runs. Phase 1 is released for internal testing only after automated checks and Android Chrome and iOS Safari device verification pass.

## User Stories

1. As a Runner, I want to start a Personal Run without creating a PlayGround, so that I can record an individual activity directly.
2. As a Runner, I want the app to prevent a second Active Run Session, so that concurrent tabs or repeated taps cannot create conflicting runs.
3. As a Runner, I want a clear conflict response when an older Active or Pending Completion exists, so that I can resolve it before starting again.
4. As a Runner, I want denied location permission to produce a clear explanation and retry action, so that I understand why tracking cannot start.
5. As a Runner, I want tracking quality controlled automatically, so that I do not need to understand or configure GPS sampling parameters before a run.
6. As a Runner, I want only Valid Track Points to enter my route, so that inaccurate or impossible GPS observations do not corrupt it.
7. As a Runner, I want inaccurate points beyond the accepted accuracy threshold rejected, so that weak GPS signals do not inflate distance.
8. As a Runner, I want repeated points closer than the accepted movement threshold ignored, so that stationary GPS noise does not accumulate distance.
9. As a Runner, I want physically impossible jumps rejected, so that GPS teleportation does not create false distance or Pace.
10. As a Runner, I want accepted points ordered consistently even after network retries, so that my final route remains chronological.
11. As a Runner, I want point-batch retries to be idempotent, so that a lost response cannot duplicate parts of my route.
12. As a Runner, I want my active duration to update while running, so that I can see current progress.
13. As a Runner, I want to pause a Run Session, so that rest time does not count toward active duration or Pace.
14. As a Runner, I want movement during a pause excluded, so that walking, driving, or GPS drift while paused does not affect results.
15. As a Runner, I want resuming to begin a new Track Segment, so that the map does not draw a false line from the pre-pause position.
16. As a Runner, I want average and current Pace shown during the run, so that I can adjust my effort.
17. As a Runner, I want kilometer splits shown during and after the run, so that I can compare performance across the route.
18. As a Runner, I want Estimated Calories clearly labelled as an estimate, so that I do not mistake it for a medical measurement.
19. As a Runner, I want the app to flush pending points when I stop, so that the latest route data is considered for completion.
20. As a Runner, I want a Run Session shorter than ten seconds or with fewer than two Valid Track Points abandoned rather than completed, so that accidental starts do not pollute my history.
21. As a Runner, I want stopping to enter Pending Completion before showing success, so that an onscreen finished state never precedes persistence.
22. As a Runner, I want failed point uploads to retain their batches, so that retrying does not silently lose route data.
23. As a Runner, I want failed completion to show an explicit reason, so that I know the run has not been retained.
24. As a Runner, I want to retry a Pending Completion using the same snapshot and Run Session identity, so that measurements do not change between attempts.
25. As a Runner, I want repeated completion requests to return the same Confirmed Run Result, so that retries cannot duplicate statistics.
26. As a Runner, I want a conflicting completion payload rejected after a run is complete, so that confirmed measurements cannot be overwritten.
27. As a Runner, I want to abandon a Pending Completion with confirmation, so that I can intentionally discard an unsaved run.
28. As a Runner, I want the service to calculate final distance, active duration, Pace, splits, and Estimated Calories, so that client previews cannot corrupt authoritative results.
29. As a Runner, I want the summary to show the Confirmed Run Result, so that displayed metrics match retained data.
30. As a Runner, I want a visible notice when service-confirmed distance differs materially from the preview, so that GPS corrections are understandable.
31. As a Runner, I want only Completed Runs in history and recent-run views, so that active, pending, and abandoned work stays hidden.
32. As a Runner, I want only Completed Runs included in lifetime totals, so that my statistics are trustworthy.
33. As a Runner, I want a Completed Run to contribute to statistics exactly once, so that repeated requests cannot inflate totals.
34. As a Runner, I want to delete my own Completed Run, so that I control retention of my location history.
35. As a Runner, I want deletion to remove the route and reverse all aggregate and leaderboard contributions, so that derived data remains consistent.
36. As a Runner, I want other users blocked from reading my Personal Run route, so that my location history stays private.
37. As a Runner, I want leaderboard consumers to receive aggregate metrics rather than routes, so that participation does not expose GPS history.
38. As a Runner, I want a long Run Session to remain active for up to twelve hours, so that marathon and endurance activities are supported.
39. As a Runner, I want an overlong Run Session moved to Pending Completion, so that abandoned trackers do not remain active indefinitely.
40. As a Runner, I want stale incomplete server records hidden and cleaned after their retention window, so that they cannot pollute product data.
41. As a Runner, I want the map to render my route in the correct location on AMap, so that coordinate-system differences do not shift it.
42. As a Runner, I want the Run interface usable on a 390px mobile viewport, so that the map, metrics, and controls remain accessible.
43. As a Runner, I want the dark map and visual feedback to remain consistent with the application, so that the Run flow feels integrated.
44. As an internal tester, I want failure modes such as denied permission, interrupted network, repeated batches, and conflicting sessions to be reproducible, so that Phase 1 reliability can be verified.
45. As an internal tester, I want device, route, distance error, screenshots, and conclusions recorded, so that release evidence can be reviewed later.

## Implementation Decisions

- Phase 1 targets internal-test quality for Personal Run only. Personal Run is independent of PlayGround.
- A Run Session follows `ACTIVE → PENDING_COMPLETION → COMPLETED`. It may instead be abandoned. The previous ambiguous finished state is removed.
- Each Runner may have at most one Active or Pending Completion. Attempts to start another return a conflict rather than creating a second session.
- Starting, pausing, resuming, and stopping produce ordered Run Events. Active duration is the sum of event-defined active intervals, not the first-to-last GPS timestamp.
- Pausing closes the current Track Segment. Resuming opens a new segment at the first subsequent Valid Track Point. Segments are never connected for distance or map display.
- A GPS observation becomes a Valid Track Point only when its coordinates are finite and legal, its timestamp is ordered, accuracy is at most 15 meters, movement from the prior accepted point exceeds both 5 meters and the combined uncertainty of the two observations, and implied speed is at most 8 meters per second. The first legal point is accepted without a movement check.
- The browser always requests fresh high-accuracy observations while recording. Every observation may update the current-position marker and accuracy circle, but only Valid Track Points enter Track Segments, measurements, uploads, and retained results.
- Browser GPS verification uses an HTTPS secure context. A non-secure LAN address is rejected before requesting location and explains that Chrome requires an HTTPS test URL.
- Starting first enters a locating state. The first observation eligible to become a Valid Track Point creates the Run Session and starts active time; a Runner may explicitly start despite weak signal, in which case active time begins while the route still waits for a Valid Track Point.
- Valid Track Points and Run Events carry a monotonically increasing Run Session-local sequence. Replayed uploads are deduplicated by Run Session and sequence.
- Active data is stored temporarily in Redis in sequence order. Upload occurs every 15 seconds or 20 accumulated points, whichever happens first; stopping flushes immediately. Failed batches remain queued and use backoff retry.
- Active data has a 24-hour retention window. A Run Session may last at most 12 hours, after which it moves to Pending Completion.
- Completion requires at least ten active seconds and two Valid Track Points. Runs below that threshold are abandoned.
- Stopping creates an immutable local completion snapshot and enters Pending Completion. Retrying reuses the same Run Session identity, events, points, and stop time. The Runner may retry or abandon but may not resume running.
- Completion uses a dedicated one-way service operation rather than a general record update. The first valid completion creates the Confirmed Run Result. Identical retries return it; conflicting retries are rejected.
- The service is authoritative for distance, active duration, Pace, Track Segments, splits, and Estimated Calories. Client calculations are previews only.
- Distance is represented in meters, duration in seconds, and Pace numerically as seconds per kilometer. Formatted Pace strings and kilometer conversion exist only at presentation boundaries.
- Live current Pace uses the latest 30 seconds of Valid Track Points once the window contains more than 10 meters and 10 seconds of movement. Pace values use the conventional `5'30"` display with `/km` shown as a separate unit label.
- Confirmed kilometer splits interpolate time at exact kilometer boundaries. A final partial split of at least 100 meters is retained with its normalized Pace so the summary accounts for the meaningful remainder of the route.
- Persisted coordinates and distance calculations use WGS-84. GCJ-02 conversion occurs only in the AMap display layer and is never written back into run data.
- Estimated Calories use configured Runner weight when available and a 70kg fallback otherwise. The value is explicitly approximate.
- On successful completion, the service validates and normalizes Redis data into canonical Track Segments stored as JSON with the Completed Run, then clears active Redis data.
- Completion, lifetime-total contribution, and any leaderboard contribution occur in one database transaction. Deletion removes the Completed Run and reverses those contributions in one transaction.
- Only Completed Runs appear in history, summaries, recent-run queries, totals, and leaderboards. Incomplete records remain hidden and are cleaned after the retention window.
- Confirmed measurements are immutable. Descriptive metadata such as notes may be edited separately; measurement changes require deleting the entire Completed Run.
- Personal Run routes are owner-only. Aggregate consumers never receive complete GPS tracks.
- The existing summary route may remain for Phase 1. It must load the Confirmed Run Result rather than trusting navigation state or client preview data.
- The mobile layout is responsive rather than tied to a fixed map height. At 390px width, map, metrics, Pending Completion feedback, and controls must remain usable without critical overlap.
- The active map uses separate current-position and Track Segment layers. It follows the current position by default, enters free camera mode after a Runner gesture, offers a return-to-position action, and uses an overview only for a finished route. Map loading failure never stops Run Session recording.
- Returning to the Run page or refreshing it restores an Active or Pending Completion Run Session, including measurements, the last Valid Track Point, Track Segment index, upload scheduling, event sequence, and immutable completion snapshot.
- The run-control lock blocks application controls and navigation, survives refresh for the browser session, and requires a 1.5-second hold on the same control to unlock.
- Existing database migration files remain immutable. A new forward migration introduces explicit status and canonical measurement fields, converts existing kilometer values to meters, initializes status from prior completion data, and removes formatted Pace storage only after all readers are migrated.
- Existing completed data becomes Completed; records without an end time become Active and remain hidden unless resolved or cleaned.
- Completed Run deletion is required for Phase 1 because retained routes contain sensitive location history.
- A server-confirmed distance difference above 5% from the preview produces a correction notice while still using the Confirmed Run Result.

## Testing Decisions

- Tests assert observable behavior through public seams. They must not reach into refs, Redis key layouts, private helpers, or ORM calls merely to prove implementation details.
- The primary automated seam is the public Run API. It covers authentication, ownership, single-session conflicts, ordered Run Events, point validation and deduplication, state transitions, minimum completion rules, server calculations, idempotent completion, conflicting completion, deletion, aggregate transactions, and completed-only queries.
- The client seam is the public run-tracking Hook. It covers browser GPS interaction, automatic quality filtering, locating and weak-signal start behavior, pause and resume behavior, Track Segment boundaries, upload retention and retry, active recovery, Pending Completion, immutable retry snapshots, abandonment, and user-visible state transitions.
- Pure track calculations retain a small supplementary test suite using independently worked examples for Haversine distance, duration, Pace, validation thresholds, split boundaries, and coordinate handling. These tests support fast diagnosis but do not replace public-seam tests.
- Client regression tests verify that ordinary movement inside the rolling window produces a current Pace, and summary tests cover compact route layout, historical split compatibility, and final partial-split presentation.
- Existing Hook, calculation, and Run API authorization tests provide prior art for style and test setup.
- Browser verification covers the complete Personal Run workflow with controlled geolocation and network failures before real-device testing.
- Real-device acceptance runs on at least one Android device using Chrome and one iOS device using Safari.
- GPS accuracy acceptance begins with a known outdoor route of 300–500 meters. Final service-confirmed distance must remain within ±10%, and the rendered path must not contain obvious cross-block jumps or pause-connection lines. A one-kilometer route remains the release-confidence follow-up.
- Failure verification includes permission denial and retry, upload failure, completion failure, repeated batches after lost responses, duplicate start attempts, multi-tab conflict, overlong session handling, abandonment, deletion, and aggregate reversal.
- Verification records device and OS, browser version, reference route and distance, measured distance, error percentage, permission behavior, pause and retry behavior, screenshots, and pass/fail conclusions.
- Release validation requires the full automated test suite, type checking, linting, formatting, and production build to pass.

## Out of Scope

- Group Run real-time position, Pace, heart-rate, or voice sharing
- PlayGround membership, invitation, scheduling, and Location Picker behavior
- Background GPS tracking while the browser is suspended
- Recovery after process termination or long offline periods
- Heart rate, cadence, elevation gain, elevation loss, and external-device metrics
- Public or shareable Run summary links
- Medical or health-grade calorie claims
- Manual editing of Confirmed Run measurements
- Strict fixed-pixel replication of the Pencil map height

## Further Notes

- The domain glossary defines Runner, Run Session states, Valid Track Point, Track Segment, Run Event, Confirmed Run Result, Estimated Calories, and Pace. Future work should use these terms rather than reverting to ambiguous record or finished terminology.
- Accepted ADRs establish the Redis-to-MariaDB track boundary and canonical units and coordinate systems.
- Phase 1 is complete only when automated checks pass, both target mobile browsers complete the workflow, the known-route tolerance is met, required failure scenarios pass, Pending Completion and deletion are usable, no Run correctness or location-data P0/P1 issues remain, and verification evidence is recorded.
- After this spec is accepted, use `/to-tickets` to split it into blocking tracer-bullet implementation tickets. Existing resolved hardening tickets should be treated as prior work rather than recreated.
