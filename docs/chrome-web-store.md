# Chrome Web Store submission

Prepared 2026-09-08. Gesner has not been submitted or approved.

## Files

- Upload the built extension ZIP, with `manifest.json` at its root. Do not upload the source ZIP or a development test extension.
- Icon: `public/icons/icon-128.png`.
- Small promotional image: `docs/brand/store-small-440x280.png`.
- Screenshots: `docs/images/store-workspace.png` and `docs/images/store-columns.png` (1280 × 800, actual extension UI with synthetic example data).

## Listing copy

**Name:** Gesner

**Summary:** Extract web tables and lists into Excel or CSV. Free, local, and without telemetry.

**Description:**

Turn web pages into spreadsheets.

Gesner finds tables and repeated lists in your current tab. Preview the results, rename or hide columns, and export to Excel or CSV. Follow pagination or infinite scroll to collect more rows.

No account, API key, subscription, or telemetry. Extraction runs in your browser. Your exports stay on your computer.

Made by Enzo Terrier.

**Homepage:** https://github.com/Nassau-1/gesner

**Privacy policy:** https://github.com/Nassau-1/gesner/blob/main/PRIVACY.md

## Privacy and permissions

Single purpose: extract user-selected web tables and lists into local spreadsheets.

- `activeTab`: access the current page only after the user clicks the extension toolbar button.
- `scripting`: run local detection, extraction and user-requested pagination in that page.
- No remote code, analytics, cloud processing, or transmission to the developer.
- Page contents and URLs are processed locally. Review the dashboard's current definitions when completing its data-use declarations; local processing is described in the privacy policy.

Reviewer steps: open a regular web page containing an HTML table, click the toolbar icon, choose Detect tables, preview the results and export CSV or Excel. Browser-internal pages cannot be scraped. No login to Gesner is needed.

## Publication

1. Register a developer account, pay Google's one-time registration fee, and complete required account verification.
2. Upload the extension ZIP in the developer dashboard.
3. Fill in the listing, privacy declarations, permission justifications, distribution and any required developer/trader details accurately.
4. Preview the listing and submit for review. Publication depends on Google's decision.

Official references: [registration](https://developer.chrome.com/docs/webstore/register), [publishing](https://developer.chrome.com/docs/webstore/publish), [image specifications](https://developer.chrome.com/docs/webstore/images), [program policies](https://developer.chrome.com/docs/webstore/program-policies/policies).
