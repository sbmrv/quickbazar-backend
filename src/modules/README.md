# Modules

Feature modules are added in later phases. Each module uses `routes.js`, `controller.js`, `service.js`, `validation.js`, and `model.js` as needed.

Planned modules: auth, users, addresses, serviceAreas, categories, sellers, stores, products, discovery, geo, cart, checkout, orders, shipments, payments, riders, tracking, coupons, reviews, notifications, ledger, payouts, admin, settings, uploads.

Implemented: `health` (`GET /api/v1/health`), `auth` (OTP, admin login, refresh, roles), `categories`, `serviceAreas`, `settings`, `audit`, `uploads`, `sellers`, `stores`, `products`, and `admin` (`/api/v1/admin`).
