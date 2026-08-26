# 18: Rebuild the live Run map

Type: task
Status: resolved
Blocked by: 17

## Behavior

The live map renders the current GPS observation independently from accepted Track Segments, keeps WGS-84 as the recording coordinate system, and converts only display coordinates for AMap.

## Acceptance

- Raw current position moves the blue marker and updates an accuracy circle even when the observation is rejected from the route.
- The first Valid Track Point displays a start marker and the second begins a polyline.
- Paused Track Segments remain separate and are never joined visually.
- Camera behavior supports following, free viewing after a gesture, returning to position, and finished-route overview.
- AMap loading failure does not interrupt recording.

## Comments

## Answer

Kept AMap and separated raw current-position rendering from accepted Track Segments. The live map now updates a position marker and accuracy circle independently, draws an explicit start marker and segmented polylines, supports following/free/overview camera modes, and reports map failure without interrupting the recorder.
