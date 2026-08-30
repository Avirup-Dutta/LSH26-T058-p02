# Third-Party Material and AI Disclosure

List material frameworks, libraries, starters, templates, UI kits, fonts, icons and assets used in this repository.

| Name | Version or source URL | Licence | Used for |
|---|---|---|---|
| Chart.js | https://cdn.jsdelivr.net/npm/chart.js (v4.4.x) | MIT | Interactive 6-month expiring value risk forecast chart |
| Lucide Icons | https://unpkg.com/lucide@latest | ISC / MIT | Clean medical and navigation icons |
| Plus Jakarta Sans & JetBrains Mono | https://fonts.google.com/ | Open Font License (OFL) | Modern typography and monospace numbers |
| Python 3 Standard Library | https://www.python.org/ | PSF License | Multi-threaded backend HTTP server and SQLite3 database |

## AI tools

List each AI tool in `evaluation-manifest.json`, what it was used for and how the output was verified. Write `None` if no AI tool was used.

| AI Tool | Used For | How Output Was Verified |
|---|---|---|
| Antigravity AI Assistant | UI scaffolding, SQLite REST endpoints, and benchmark validation script | Verified via local browser testing at `http://localhost:8080` and automated Python test suite across all 25 benchmark cases in `P02_pharmacy_expiry_public.json`. |

## Original-work statement

Everything not declared in this file or `EVENT.md` was created by the registered team during the event window.
