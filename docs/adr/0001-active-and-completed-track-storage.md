# Store active and completed tracks differently

Active Run Sessions store Valid Track Points temporarily in Redis, keyed and ordered by a Run Session-local sequence so batch retries are idempotent. When completion succeeds, the service validates and converts those points into canonical Track Segments stored as JSON with the Completed Run in MariaDB, then clears the Redis data. This keeps live writes inexpensive and retryable without introducing a permanent GPS-point table, while preserving the whole completed route as one retained result.
