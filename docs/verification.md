# Verification — 2026-09-08
Version 1.0.0.

- Strict TypeScript compilation and extension build pass.
- Nine Node tests cover data alignment/deduplication/limits, formula-safe CSV, OOXML structure, permission allowlist, CSP, runtime API tripwires and packaged assets.
- Eighteen Playwright Chromium tests cover hidden/editable data exclusion, spans, repeated cards, empty/origin errors, large tables, Next picking and cancellation, unsafe Next controls, inner scrolling, workspace filters/column edits, CSV/XLSX/clipboard, full navigation and dynamic pagination, infinite-scroll deduplication, Stop, Clear, responsive layout, CSP fetch denial and production ungranted-injection denial.
- No external requests were observed during the synthetic detection/edit/export flow.
- An independent Python ZIP CRC and XML parser check passed on a generated XLSX.
- Compact light UI screenshots reviewed at 1366×768 and 620×600. A seventeenth browser test verifies no document overflow, on-screen collection/export controls, a usable grid height, and column panels that preserve grid size at 1366×768, 1120×680, 800×600 and 620×600.

## Limits of the evidence
Tests run in isolated Chromium with synthetic pages. Integration tests use a localhost-only host permission in a disposable extension copy to substitute for headless toolbar activation. That grant is absent from the production manifest. Actual manual toolbar activation in every user's Chrome profile and arbitrary real websites remain unverified. Excel desktop was not launched; ZIP/XML and string-cell serialization were tested.

Static API scans and a bounded runtime test do not prove all possible future code is safe. Page actions can trigger the website's own traffic. Test fixtures contain synthetic data only. A read-only inspection of a user-provided followers page confirmed 20 boxless record wrappers separated by empty elements; only layout counts were retained, not profile contents. GitHub CI is not active until workflow authorization is available.

- Export checks: verified local-date/title filenames for CSV and XLSX downloads, timing controls inside Collection, and removal of session labels. All 18 browser tests pass.

- Regression: display:contents lists with interleaved separators produce four synthetic rows while hidden, transparent and editable data remain excluded.
