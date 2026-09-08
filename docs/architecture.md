# Architecture
The Manifest V3 service worker opens a separate extension window when the user clicks the toolbar action. Chrome grants activeTab access to that source tab; no persistent host permissions or background scraping is used.

## Components
- background.ts: toolbar event and workspace creation.
- popup.ts: source-origin validation, UI state, Chrome injection calls, bounded crawl loop and explicit exports.
- page.ts: self-contained function serialized into the source top frame's ISOLATED execution world. Discovers repeated structures, extracts visible text/URLs, selects Next, activates a same-origin control or scrolls one increment.
- data.ts: schema alignment, deduplication, session size limits and formula-safe delimited output.
- xlsx.ts: dependency-free uncompressed ZIP/OOXML writer with CRC32 and explicit string cells.
- types.ts: typed command/reply and data shapes.

All data stays in workspace memory until explicit export. Closing the workspace discards it. No storage service, network service, runtime dependencies, remote code or analytics exists.

## Crawl behavior
An explicit start selects Next or scroll mode. Each step sends one page action, waits at least the configured delay, then polls for a changed snapshot that remains stable for at least 500ms. Stable changed data is merged and deduplicated. No changed data by max wait, exhausted/disabled controls, origin changes, limits, errors or cancellation stop the loop. Bounded DOM polling avoids webRequest permission.

Only source-origin HTTP(S) access is used; navigation across origins revokes access and stops collection. A selected website button may execute website code; no claim is made that native website traffic is blocked.

## Build and tests
tsc emits ES modules in dist; the build copies public assets. Only dist is loaded into Chrome. Development dependencies and tests are excluded. Browser integration tests use a synthetic localhost fixture and test-only host grant; production manifest denial is tested separately. CI configuration is a template pending workflow authorization.

Chrome documentation: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [extension CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).

See [decision](decisions/ADR-002-extraction.md) and [verification](verification.md).
