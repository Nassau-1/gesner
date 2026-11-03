# Roadmap
v1.0.1 adds a signed internal MCI deployment channel to the existing local extraction features.

Managed deployment follow-up:
- Publish MCI.4 detection follow-up to the existing SYSTEM app and confirm portal status. MCI.3 pilot log proves successful HKLM policy writes; Enzo confirms Gesner present in Vivaldi. Legacy-only state detection caused a reproducible false negative with modern Chromium fixtures; target profile contents were not inspected.
- Confirm force-install and update on the MCI pilot in Vivaldi, then Chrome/Brave/Chromium as used. Package tests do not prove delivery.
- Edge on Entra-only Windows needs a separate supported Store channel; do not advertise universal Chromium deployment.
- Back up the private MCI signing key to an approved private secret store; never attach it to a release or commit it.

Future improvements:
- Better handling of complex multi-row headers and optional list fields.
- User-selected row containers.
- Explicitly scoped support for frames, shadow DOM and virtualized lists.
- Broader synthetic browser compatibility fixtures.
- Automated GitHub CI when workflow upload authorization is configured.

New features must preserve local processing, explicit user control and zero telemetry. Persistent sessions would require a separate privacy review and an explicit user choice.
