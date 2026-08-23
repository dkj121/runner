# Use canonical run measurements across storage and APIs

Run measurements use meters for distance, seconds for active duration, and WGS-84 for persisted coordinates and distance calculations. Pace is derived numerically as seconds per kilometer and formatted only at the UI boundary; GCJ-02 conversion exists only in the AMap display layer. Existing migration history remains immutable, so adopting these canonical representations requires a new forward migration rather than rewriting prior migrations.
