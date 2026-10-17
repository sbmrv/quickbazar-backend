# Jobs

BullMQ queues and workers (assignment, expiry, cleanup, payouts) are added in later phases.

Use `createBullConnection()` from `config/redis.js`. That client sets `maxRetriesPerRequest: null`.
