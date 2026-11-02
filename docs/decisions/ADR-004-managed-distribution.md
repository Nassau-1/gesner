# ADR-004 — Signed internal MCI browser distribution

- Date: 2026-11-02
- Status: accepted; requested internal distribution

## Problem

The Intune Company Portal entry created as a web link only opens GitHub. Its installed status says nothing about a browser extension. The public ZIP is an unpacked extension, without a signed CRX or browser-managed update channel.

## Decision

Use Chromium's own packer to create a CRX3 with a durable private RSA key kept outside the repository and an embedded HTTPS update URL. Publish only the signed package, update XML and exact-version source on the existing public Gesner repository. Internal refers to the MCI assignment and deployment channel, not confidentiality of the already-public extension code.

An Intune Win32 installer runs as the requesting user on an MCI Entra-joined device, adding one numeric force-list entry under each supported vendor's HKCU policy root: Vivaldi, Chrome, Brave and Chromium. This covers browsers installed later without installing browsers. Other extension entries remain intact. Explicit conflicting Gesner policies fail before writes. The installer does not edit browser profiles, disable security controls or close browsers.

Detection requires the four policy entries and a versioned Gesner extension enabled in at least one browser profile. A marker or copied extension files alone cannot report success. A closed browser can delay installation until its next launch; return 1618 asks Intune to retry. This is not evidence that all profiles or all supported browsers have downloaded the extension.

## Limits and rejected options

- A rebuilt ZIP or another web link cannot install an extension silently.
- Store publication was offered; the user chose internal MCI distribution.
- No developer-mode deployment, profile preference modification or browser-command-line shortcut injection.
- Edge is excluded: Microsoft's documented self-hosted force-install route requires AD/hybrid join and does not work on Entra-only devices. Other Chromium derivatives require their own verified policy support; engine compatibility is insufficient.
- Vivaldi and other derivatives require an actual pilot check; Chromium policy compatibility is not proof of end-to-end success.

## Privacy and rollback

The default public build still has no update URL. The internal variant adds browser-controlled update checks; extension runtime permissions remain activeTab/scripting and CSP denies network access. Update requests can disclose extension ID/version and request metadata to GitHub; scraped page data is never sent. Uninstall removes only exactly matching policy entries recorded as owned by this installer. Browser policy refresh then removes the forced extension. Keep the private signing key secure and backed up privately; losing it requires a new identity.

## Validation

Run npm run check, synthetic browser tests, packaging tests, CRX signature/identity checks, and HTTP checks of the published XML/CRX. Verify the target pilot's policy page and actual enabled extension before claiming installation.

References: [Chromium policy definition](https://raw.githubusercontent.com/chromium/chromium/main/components/policy/resources/templates/policy_definitions/Extensions/ExtensionInstallForcelist.yaml), [packaging and update format](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux), [Edge restriction](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-manage-extensions-webstore).
