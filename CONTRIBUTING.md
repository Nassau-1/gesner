# Contributing
Thanks for helping improve Gesner.

## Before you start
Read [LICENSE](LICENSE) and [licensing explained](docs/licensing.md). Submit only code you have the right to contribute. Contributions intentionally submitted for inclusion are offered under the project license; you retain your copyright. No copyright assignment is requested. Do not include code with incompatible third-party terms.

Open an issue for a substantial feature, then send a focused pull request describing the behavior, why it matters, and how it was verified. Bug reports should include browser/version, reproducible steps and a synthetic example where possible. Never attach personal scraped data, credentials or browser profiles.

## Local checks
Use Node.js 24+:
~~~sh
npm ci --ignore-scripts
npm run check
npx playwright install chromium
npm run test:browser
~~~

## Design boundaries
- No telemetry, analytics, uploads, cloud AI, remote assets or paid feature gates.
- Keep collection user-triggered and processing local.
- New permissions require a documented reason and tests.
- Render page values as text, protect spreadsheet exports, and bound resource usage.
- Use synthetic fixtures; keep exports, profiles and test artifacts out of Git.
- Keep the compact spreadsheet interface accessible and usable without page scrolling.
- Update the changelog and relevant docs when behavior changes.

Browser tests use an isolated profile. Their localhost-only host grant is test-only and must never enter the release manifest. The CI workflow template is provided for maintainers; local checks remain the current verification path.

## Review
Small fixes and documentation improvements are welcome. Larger detection changes should include a minimal fixture and regression test. Be constructive and respectful in issues and reviews. The maintainer is Enzo Terrier ([Nassau-1](https://github.com/Nassau-1)).
