# ADR-002: User-triggered extraction
- Status: Accepted
- Date: 2026-09-08

## Decision
Use only activeTab and scripting. A toolbar action opens the workspace; explicit detection runs a self-contained function in the source top frame's isolated world. The workspace owns session state, previews and exports.

## Constraints
No permanent host permissions, network observation, browser storage, backend or analytics. Restrict crawling to the source origin; bound traversal, snapshot sizes, session memory and steps. Exclude hidden and editable contents; render text safely and protect spreadsheet exports.

## Alternatives
Network-idle monitoring would require broader permissions. Bounded DOM polling is sufficient for the supported workflow. Persisted page histories and automatic site-wide execution are unnecessary.

## Verification
Use synthetic fixtures for extraction, pagination, picker cleanup, exports and permissions. Browser integration tests substitute a localhost-only test grant for toolbar activation; production permissions are checked separately.

## Consequences
Heuristic detection cannot support every layout. Page actions may cause the website's own requests. Stop prevents future steps but cannot undo a dispatched page action.
