# 16: Complete real-device Phase 1 acceptance

**What to build:** Produce reviewable evidence that the completed Personal Run flow works on the supported mobile browsers and meets the agreed GPS accuracy and failure-handling release bar.

**Blocked by:** 15: Verify the automated Personal Run story

**Status:** ready-for-agent

- [ ] One Android device using Chrome completes the full Personal Run workflow.
- [ ] One iOS device using Safari completes the full Personal Run workflow.
- [ ] A known route of at least one kilometer produces a Confirmed Run distance within ±10% on each target platform.
- [ ] The route contains no obvious cross-block jumps or pause-connection lines.
- [ ] Permission denial and retry, pause movement, interrupted network, Pending Completion retry, abandonment, and deletion are exercised.
- [ ] The 390px mobile layout keeps map, measurements, feedback, and controls usable without critical overlap.
- [ ] Device, OS, browser, reference distance, measured distance, error, screenshots, and conclusions are recorded in the verification artifact.
- [ ] Phase 1 is marked accepted only when both devices pass or each failure has a blocking follow-up ticket.
