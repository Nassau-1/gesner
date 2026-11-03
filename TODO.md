# Roadmap
v1.0.1 adds a signed internal MCI deployment channel to the existing local extraction features.

Managed deployment follow-up:
- Completed 2026-11-03: SYSTEM/MCI.4 published; Enzo confirms Gesner present in Vivaldi and Company Portal now shows installed. Target preferences were not inspected; modern-format false-negative was reproduced and fixed in fixtures.
- Verify future extension update and actual uninstall on the Vivaldi pilot, then Chrome/Brave/Chromium as used. The current Vivaldi installation does not prove other browsers or the update/uninstall lifecycle.
- Edge on Entra-only Windows needs a separate supported Store channel; do not advertise universal Chromium deployment.
- Back up the private MCI signing key to an approved private secret store; never attach it to a release or commit it.

Future improvements:
- Better handling of complex multi-row headers and optional list fields.
- User-selected row containers.
- Explicitly scoped support for frames, shadow DOM and virtualized lists.
- Broader synthetic browser compatibility fixtures.
- Automated GitHub CI when workflow upload authorization is configured.

New features must preserve local processing, explicit user control and zero telemetry. Persistent sessions would require a separate privacy review and an explicit user choice.
