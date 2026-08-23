# 10: Produce an authoritative Confirmed Run Result

**What to build:** A dedicated completion operation validates the frozen Run Session, computes authoritative measurements, persists one immutable Completed Run, and returns the same result for safe retries.

**Blocked by:** 09: Introduce Pending Completion

**Status:** resolved

- [x] Completion is a dedicated one-way Active or Pending to Completed transition.
- [x] The service computes distance, active duration, Pace, Track Segments, splits, and Estimated Calories from accepted server data.
- [x] Distance is retained in meters, duration in seconds, coordinates in WGS-84, and Pace as a numeric derivation rather than formatted storage.
- [x] Successful completion stores canonical Track Segments as the Completed Run route and clears temporary active data.
- [x] Identical completion retries return the existing Confirmed Run Result without duplicate effects.
- [x] A conflicting payload cannot overwrite an existing Confirmed Run Result.
- [x] The summary displays only the Confirmed Run Result and reports material correction above 5% from the client preview.
- [x] API and browser tests cover calculations, idempotency, immutability, authorization, and correction feedback.

## Answer

Added a dedicated one-way completion endpoint that reads accepted Redis events and WGS-84 Track Segments, computes canonical meters, active seconds, numeric Pace, server splits, and Estimated Calories, and atomically transitions the Run plus lifetime totals. Identical retries return the retained Confirmed Run Result without repeating aggregate effects; changed stop or preview payloads return conflict. Completed routes retain canonical segments, the Hook consumes only the confirmed response, and Summary reports server correction above five percent. ESLint, TypeScript, all 44 tests, and the production build pass.
