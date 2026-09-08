# Security and privacy
Scope: Gesner v1.0.0 and its build/test tooling.

## Boundaries
Runtime data flow: explicit toolbar activation → workspace → isolated top-frame extraction → in-memory preview → explicit local download/clipboard copy. No analytics, cloud AI, remote assets, external endpoints, persistent identifiers, browser storage or runtime dependencies.

Permissions are limited to activeTab and scripting. There are no persistent host permissions or automatic content scripts. The background worker only opens the workspace. CSP applies to extension pages, not as a universal sandbox for injected code. Page code uses no network APIs; user-selected page actions may trigger the website's own traffic.

Extraction excludes hidden text, form-field values and editable content. It does not access cookies or storage. DOM selectors and strings are untrusted: previews use textContent, links are exported as strings, and spreadsheet-formula prefixes are neutralized. Same-origin link checks and refusal of submit buttons reduce accidental actions; custom website handlers cannot be classified reliably, so choose Next carefully.

Bounded traversal, snapshot/session sizes and crawl limits constrain resource use. Limits, structural heuristics and deduplication can omit data; inspect exports before relying on them.

## Development and release
Never commit browser profiles, scraped content, credentials, .env files, exports or test profiles. Use synthetic fixtures. If sensitive content is exposed, restrict access, rotate affected credentials and remove it from history where appropriate.

Build reviewed code using npm ci --ignore-scripts and npm run check; run browser tests after behavior changes. Review dependencies and lockfile changes. Build dependencies never ship in dist. Static privacy checks are regression tripwires, not proofs against every exfiltration technique.

Browser tests use an isolated extension copy with a localhost-only host grant; the production bundle is separately verified to deny ungranted access. Manual toolbar activation is part of the installation smoke check.

Report concerns privately to the repository owner without uploading sensitive page content. Stop/close the workspace to end collection. Remove the unpacked extension or revert the feature commit to roll back.
