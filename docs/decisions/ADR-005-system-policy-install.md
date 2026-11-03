# ADR-005 — MCI system-context installation

- Date: 2026-11-03
- Status: accepted for corrective pilot; target installation not yet verified

## Evidence and objective

Pilot install.log at 2026-11-03T11:38:31+01:00 and 11:39:26 shows UnauthorizedAccessException writing HKCU Software/Policies/Vivaldi/ExtensionInstallForcelist. The user-context package cannot write managed policy. Keep the signed extension identity/version, voluntary Company Portal installation, four vendor roots and local-only runtime unchanged.

## Decision and plan

1. Run installation/uninstallation as SYSTEM, guard the MCI Entra join and administrator token, and write HKLM policies for all users of the requesting device. Never change registry ACLs or browser preferences.
2. Store ownership in an administrator-controlled HKLM key. Preserve other entries and reject conflicting Gesner channels. Uninstall validates the complete ownership record before deleting only exact matching entries.
3. Generate self-contained detection containing reviewed Core code and embedded identity/version. Never execute a script from user-writable AppData. Require all four machine policies plus an enabled versioned extension in at least one registered non-service Windows profile; this does not certify all profiles.
4. Keep diagnostics under Windows/Logs/Gesner-MCI. No browsing content, identity secrets or telemetry. Keep the 150-second browser wait and retry result.
5. Run synthetic package tests, installer failure fixtures, isolated registry lifecycle tests and npm check; inspect the generated detector and Intune container. Publish only after these checks.

Intune's existing app exposes install behavior as disabled. Create a replacement SYSTEM app and remove the failing app's Available assignment only after the replacement is saved. Preserve the old object for rollback; no forced uninstall or broad Required assignment.

## Risks, containment and rollback

Machine policies also affect other users on that PC. The assignment remains voluntary; the CRX permissions remain activeTab/scripting. SYSTEM enumerates only registered profile paths and reads extension manifests/settings needed for detection. A browser may still reject off-store delivery or need policy refresh; package tests cannot prove browser acceptance. Verify Vivaldi policy and enabled extension on the MCI pilot before claiming success.

Use Company Portal uninstall to remove only owned HKLM entries; let browsers refresh normally. To stop new requests, remove the new Available assignment. Retain prior packages and source; reverting to the user-context package restores its known permission failure and is not a functional repair.

Rejected: weakening HKCU ACLs, arbitrary per-user hive loading, running user-writable detection code as SYSTEM, replacing browser preferences, claiming policy-only success, changing the signed CRX unnecessarily.

## 2026-11-03 — modern browser detection follow-up

Pilot log confirms successful HKLM writes followed by two 1618 retries; Enzo confirms Gesner is present in Vivaldi. Code review found detection requires the obsolete `state=1` preference. Current Chromium derives disabled status from `disable_reasons`, with no state field. Objective: recognize modern registered, versioned extensions while still rejecting disabled, blocklisted, externally uninstalled or unknown entries. No policy, assignment, CRX or permission change.

Plan: add a failing synthetic modern-profile regression; implement backward-compatible preference reading with registration and blocklist checks; exercise both the packaged installer and generated detector with modern profiles; rebuild installer-only MCI.4 and update the existing SYSTEM app/detection. Verify tests, generated PowerShell and persisted Intune properties. Rollback: retain MCI.3 package/detector; known risk is false-negative detection, not failed policy writing. Target portal status remains a separate verification step.

Upstream sources: [Chromium extension preferences](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/extensions/browser/extension_prefs.cc), [blocklist preferences](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/extensions/browser/blocklist_extension_prefs.cc). These establish the format bug; target profile contents were not inspected and the precise pilot false-negative cause remains inferred.
