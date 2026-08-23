# Runner

Runner records individual and group running activities so runners can review and compare their results.

## Language

**Runner**:
A person who uses Runner to participate in and record running activities.
_Avoid_: User, account

**Run Session**:
One running activity by a runner, including any pauses, from start until successful completion or abandonment.
_Avoid_: Run record, activity record

**Personal Run**:
A Run Session undertaken by one runner without group coordination or real-time sharing. It does not require a PlayGround.
_Avoid_: Private PlayGround, solo domain

**Paused Run Session**:
A Run Session that remains active while elapsed time and movement are excluded until tracking resumes.
_Avoid_: Stopped run

**Active Run Session**:
The single Run Session a Runner may currently be recording or attempting to complete.
_Avoid_: Current record, open run

**Valid Track Point**:
A location observation accepted into a Run Session because it is ordered, sufficiently accurate, and physically plausible.
_Avoid_: Raw GPS point, location update

**Track Segment**:
A continuous sequence of Valid Track Points recorded between starting or resuming and the next pause or stop. Separate Track Segments are never connected for distance or map display.
_Avoid_: Track, route section

**Run Event**:
An ordered start, pause, resume, or stop occurrence that defines the active intervals and Track Segments of a Run Session.
_Avoid_: GPS point, status update

**Pending Completion**:
A Run Session that has ended locally but whose required result has not yet been retained. It can be retried or abandoned, but is not complete.
_Avoid_: Failed run, completed run

**Completed Run**:
A Run Session whose required result has been accepted and retained. An onscreen finished state alone does not make a run complete.
_Avoid_: Finished run

**Confirmed Run Result**:
The authoritative metrics accepted by the service for a Completed Run. Client calculations are previews and never override it.
_Avoid_: Client snapshot, local result

**Estimated Calories**:
An explicitly approximate energy value derived from available Run Session and Runner data, not a medical measurement.
_Avoid_: Calories burned, measured calories

**Pace**:
The active duration required to cover one kilometer, derived from authoritative duration and distance measurements.
_Avoid_: Speed, formatted pace string

**Abandoned Run**:
A Run Session intentionally discarded because it did not meet completion rules or the runner chose not to retry a Pending Completion.
_Avoid_: Deleted completed run
