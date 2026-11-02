# Gesner — internal MCI browser deployment

Prepared 2026-11-02. Import/assignment and target-device installation must be recorded separately from package validation.

## Why the old portal item did not install Gesner

The Intune item `7d461f23-e492-4990-bb1f-f2c19c2fed7e` is a web link to GitHub. A web link cannot load an extension into a browser. The replacement is a Win32 installer plus a signed, browser-managed CRX3 channel.

## Scope

Windows devices joined to the MCI Entra tenant, requesting user's profile. Vivaldi, Chrome, Brave and Chromium each have their own registry policy root. Policies also apply when a supported browser is installed later. No browser is installed by this package. Other Chromium browsers are not automatically supported merely because they share an engine. Edge self-hosting is excluded on Entra-only devices ([Microsoft limitation](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-manage-extensions-webstore)).

The extension retains `activeTab` and `scripting`; no permanent page permissions. Managed updates are downloaded by the browser from the existing public GitHub repository. Internal deployment does not make the public source or CRX confidential.

## Build

1. Run `npm ci --ignore-scripts`, `npm run check`, `npm run test:browser` and `powershell.exe -NoProfile -File deployment/mci/Test-Package.ps1`.
2. Review `channel.json` and bump the version before every changed CRX release. Maintain a stable update URL and signing key.
3. Run `node scripts/package-managed.mjs <chromium.exe> <private-key.pem outside repo> <output-dir>`. A missing key is generated once. On Windows, restrict the key directory ACL to its owner and SYSTEM before generating it. Keep a private backup.
4. Run `node scripts/verify-managed.mjs <output.crx> <output-config.json>`.
5. Use Microsoft's IntuneWinAppUtil with source `<output-dir>/intune`, setup `Install.ps1`, and a separate output directory. Never include the signing key, browser profiles, test outputs or source `node_modules`.
6. Publish the versioned CRX and exact source before making `gesner-mci-updates.xml` available at the stable channel URL. Verify the public bytes and XML identity/version/codebase before assigning Intune.

## Intune settings

- Name: **Gesner — Extension navigateurs MCI**; publisher/developer: Enzo Terrier; version: 1.0.1.
- App type: Windows app (Win32), x64, Windows 11 24H2 minimum.
- Install behavior: **User**, not SYSTEM. User must be logged on; no elevation needed.
- Install command: `%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File Install.ps1`.
- Uninstall command: `%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File Uninstall.ps1`.
- Custom detection: upload the **generated** `intune/Detect.ps1`, 64-bit, no signature enforcement. The source detector is a template and cannot be uploaded as-is.
- Return codes: 0 success; 1618 retry; 1603 failure. No device restart.
- Assignment: available to enrolled MCI users, voluntary through Company Portal. Avoid required broad deployment before the pilot has verified browser installation.
- Description: installs the managed extension in Vivaldi/Chrome/Brave/Chromium. Open/restart a supported browser if the installation is pending. Edge not included.

The installer adds a free numeric `ExtensionInstallForcelist` entry in each of these HKCU roots, preserving all other entries: `Software\Policies\Vivaldi`, `Software\Policies\Google\Chrome`, `Software\Policies\BraveSoftware\Brave`, `Software\Policies\Chromium`. An explicit existing Gesner ExtensionSettings policy or conflicting channel fails before changes. Machine/cloud policies can override HKCU; browser policy status is the authority.

## Detection and pilot verification

Policies alone do not count as installed. Detection also requires the expected identity/version in an enabled extension entry in at least one local browser profile. No browser has to be closed by the installer. It waits up to 150 seconds, then returns retry if the browser has not confirmed installation. Open or restart the browser normally and retry from Company Portal. Detection does not certify every dormant profile or every browser.

On Enzo's pilot:

1. Install the new **Extension navigateurs MCI** item, not the old guide web link.
2. Open `vivaldi://policy`, reload policies and verify `ExtensionInstallForcelist` is OK and references the generated extension ID and HTTPS update URL. Inspect policy conflicts if installation fails.
3. Open `vivaldi://extensions`, verify Gesner 1.0.1 is enabled and managed. Pin its toolbar action if desired.
4. Click Gesner on a synthetic table page, detect rows and export CSV/XLSX.
5. Check the new Company Portal status after detection. Repeat in Chrome or other supported browsers used by colleagues, including update and uninstall checks before broad required rollout.

Uninstall removes only exactly matching force-list entries recorded by this package. The browser removes the extension after policy refresh. It never rewrites browser preferences or deletes extension folders. Existing manual Gesner copies have a different identity and are not silently removed.

See [distribution decision](../../docs/decisions/ADR-004-managed-distribution.md).
