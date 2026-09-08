# Project rules
- Keep implementation in TypeScript; respect the project license and contributor copyrights.
- Keep runtime processing local. No telemetry, cloud AI, analytics, remote assets, or outbound data transmission.
- Add permissions only for an implemented need, with a documented decision and privacy tests.
- Future extraction must require a user gesture; prefer activeTab plus scripting.
- Never commit scraped data, browser profiles, credentials, or exports.
- Render extracted values as text, not HTML; mitigate spreadsheet formula injection before CSV export.
- Run npm run check before delivery. Privacy scans are regression checks, not proof against all exfiltration.
- Update README, CHANGELOG, TODO and relevant ADRs when boundaries change.
