# Middlewares

- `errorHandler.js` — response envelope and `AppError` / Zod mapping (Phase 0)
- `validate.js` — Zod body/query/params helper (Phase 0)
- `requireAuth.js` — access-token cookie (Phase 1)
- `requireRole.js` — role check (Phase 1)
- `rateLimit.js` — auth limiter and public read limiter (Phases 1–2)

Added in a later phase: `idempotency.js`.
