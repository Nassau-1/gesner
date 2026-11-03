# Changelog

## Unreleased — 2026-11-03

- Correct confirmed HKCU policy access denial with SYSTEM/HKLM deployment, validated machine ownership and safe uninstall; replace the old User-context Intune app.
- Embed reviewed code and identity/version in generated detection; require four machine policies and an enabled extension in a registered user profile, without executing AppData code.
- Add isolated registry install/retry/detection/repair/uninstall tests and installer-only staging without rebuilding the signed CRX.
- Diagnostic revision 2 persisted the failing phase, exception type and message without changing policies/detection; its pilot log established the permission failure corrected above.
- Test invalid configuration and unavailable log directory without touching production browser policies.

## 1.0.1 — 2026-11-02

- Internal MCI CRX3 packaging with a stable private signing key, HTTPS update manifest and vendor-specific browser policies.
- User-context Intune installer restricted to MCI Entra-joined devices. Preserve other extensions and remove only owned policy entries.
- Detect enabled, versioned browser installation instead of a web link or marker; document Edge and other browser limits.
- Extraction behavior and runtime permissions remain unchanged. Browser-managed internal-channel update traffic is documented separately.

## 1.0.0 — 2026-09-08
First stable release of Gesner by Enzo Terrier (Nassau-1).

- Vector brand assets, Chrome toolbar icons and store listing artwork.
- Detect visible records inside boxless CSS wrappers and ignore empty list separators.

- Automatic HTML-table and repeated-list detection.
- Compact light spreadsheet workspace, column editing and row filtering.
- Bounded pagination and infinite scrolling with cancellation.
- Local CSV, XLSX and clipboard exports with formula protection.
- Local-date and source-page-title export filenames.
- Temporary page permissions, no telemetry, and no runtime network service.
- Synthetic screenshots, contributor guidance and documented privacy boundaries.
- Free personal/business use, no software monetization, and source-sharing redistribution terms.
