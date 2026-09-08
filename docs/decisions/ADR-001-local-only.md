# ADR-001: Local-only TypeScript architecture
- Status: Accepted
- Date: 2026-09-08

## Context
Users need a transparent way to extract page data without transmitting it to a scraping service.

## Decision
Use strict TypeScript, native HTML/CSS, Chrome Manifest V3 and no runtime dependencies. Distribute reviewed unpacked builds through GitHub. Keep data in session memory and export only on explicit action.

## Alternatives
Cloud extraction was rejected because it transfers page data. A UI framework and bundler add unnecessary runtime complexity for this compact workspace.

## Consequences
The code and built output remain small and reviewable. The tool does not control website traffic or other browser extensions. Persistent sessions are outside v1.0.

## Follow-up
Keep privacy checks and synthetic browser tests aligned with new features.
