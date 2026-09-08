# Usage guide

## Choose a table
Open the extension from the website you want to scrape and click **Detect tables**.
Choose a detected structure, or use **Next table** to try another one.

## Collect multiple pages
Choose **Locate Next** and click the website's pagination control. Return to the
workspace, set the delay and step limit, and click **Start crawl**. For feeds that
load as you scroll, select **Infinite scroll** instead.

**Stop** prevents additional steps. It cannot undo a page action already sent.
Crawling stops if the source changes origin, no new data appears, or a limit is reached.

## Edit and export
Use **Columns** to rename or hide fields. The search box filters collected rows.
CSV, Excel and clipboard exports include the visible columns and matching rows.

Filenames use YYYY.MM.DD_[page title], with your local date and the source title
from when the workspace opened. Invalid filename characters are replaced.

Excel values are text. Formula-like values receive a protective apostrophe.
Exact duplicate rows are removed.

## Session and updates
Closing the workspace or choosing **Clear session** discards its in-memory data.
Export anything you want to keep.

To update, replace the installed files, click **Reload** on Chrome's extensions
page, and reopen the workspace.

## Limits
Supported: top-frame HTTP(S) pages and same-origin pagination. Detection is
heuristic; iframe content, shadow DOM, virtualized lists and complex multi-row
headers are not fully supported.

- Up to 20 detected candidates.
- Up to 1,000 source rows, 60 fields and approximately one million text characters per snapshot.
- Up to 2,000 characters per cell.
- Up to 10,000 unique rows or 20 million serialized characters per session.
- Preview: 200 rows. Exports include all matching collected rows.
- Crawl limit: 20 steps by default, at most 100 per explicit start.

The extension runs locally, but a website may still make its own requests when
you navigate or scroll. See [Privacy](../PRIVACY.md).

## Window controls
The workspace opens in Chrome popup mode. The browser's address bar and window
controls are managed by Chrome.
