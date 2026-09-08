import { pageTask } from "./page.js";
import { Dataset, delimited, exportFilename } from "./data.js";
import { workbook } from "./xlsx.js";
import type { Candidate, Command, Reply, Snapshot } from "./types.js";
const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing UI element: " + id);
  return node as T;
};
const input = (id: string): HTMLInputElement => el<HTMLInputElement>(id);
const button = (id: string): HTMLButtonElement => el<HTMLButtonElement>(id);
const selector = el<HTMLSelectElement>("candidate"), mode = el<HTMLSelectElement>("mode");
const tabParam = new URLSearchParams(location.search).get("tab");
const tabId = tabParam !== null ? Number(tabParam) : NaN;
let origin = "", candidates: Candidate[] = [], selected: Candidate | undefined;
let pageTitle = "";
let data = new Dataset(), pages = 0, busy = false, controller: AbortController | undefined;
let lastSnapshot = "", capped = false;
let generation = 0;
function message(text: string, error = false): void { el("status").textContent = text; el("status").classList.toggle("error", error); }
function controls(): void {
  for (const id of ["detect","another","pick","start"]) button(id).disabled = busy || (id !== "detect" && !selected);
  selector.disabled = busy || !candidates.length; mode.disabled = busy;
  for (const id of ["next","delay","wait","limit"]) input(id).disabled = busy;
  button("stop").disabled = !busy;
  for (const id of ["csv","xlsx","copy"]) button(id).disabled = !data.rows.length || !data.columns.some(x => x.enabled);
  button("pick").disabled ||= mode.value === "scroll";
}
async function run(command: Command): Promise<Reply> {
  const startedGeneration = generation;
  if (!origin || !Number.isInteger(tabId)) throw new Error("Open this window using the extension toolbar icon on a website.");
  const result = await chrome.scripting.executeScript({ target: { tabId }, world: "ISOLATED", func: pageTask, args: [command] });
  const reply = result[0]?.result;
  if (startedGeneration !== generation) throw new Error("Session cleared.");
  if (!reply) throw new Error("The page did not respond. It may be navigating or restricted.");
  if (reply.error) throw new Error(reply.error);
  return reply;
}
function render(): void {
  const matrix = data.matrix(input("filter").value), count = Math.max(0, matrix.length - 1);
  el("stats").textContent = data.rows.length + " rows · " + pages + " pages";
  const head = document.createElement("thead"), hr = document.createElement("tr");
  const corner = document.createElement("th"); corner.className = "row-number"; corner.scope = "col"; corner.textContent = "#"; hr.append(corner);
  for (const name of matrix[0] ?? []) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = name; hr.append(cell); }
  head.append(hr);
  const body = document.createElement("tbody");
  for (const [index, row] of matrix.slice(1, 201).entries()) {
    const tr = document.createElement("tr");
    const number = document.createElement("th"); number.className = "row-number"; number.scope = "row"; number.textContent = String(index + 1); tr.append(number);
    for (const value of row) { const cell = document.createElement("td"); cell.textContent = value; cell.title = value; tr.append(cell); }
    body.append(tr);
  }
  el("preview").replaceChildren(head, body); el("empty").hidden = count > 0;
  el("empty").textContent = data.rows.length ? "No rows match the filter." : "Nothing collected yet.";
  el("preview-note").textContent = count + " matching rows. Preview shows up to 200; export includes all matches." + (capped || data.limited ? " Collection limits reached; some page data was omitted." : "");
  controls();
}
function renderColumns(): void {
  el("columns").replaceChildren();
  data.columns.forEach((column, index) => {
    const label = document.createElement("div"); label.className = "column";
    const check = document.createElement("input"); check.type = "checkbox"; check.checked = column.enabled; check.setAttribute("aria-label", "Include column " + (index + 1));
    const name = document.createElement("input"); name.value = column.name; name.maxLength = 200; name.setAttribute("aria-label", "Column " + (index + 1) + " name");
    check.addEventListener("change", () => { column.enabled = check.checked; render(); });
    name.addEventListener("input", () => { column.name = name.value; render(); });
    label.append(check, name); el("columns").append(label);
  });
}
function absorb(snapshot: Snapshot): number {
  const previous = data.columns.length, added = data.merge(snapshot);
  capped ||= snapshot.truncated;
  lastSnapshot = JSON.stringify(snapshot.rows);
  if (data.columns.length !== previous) renderColumns();
  return added;
}
async function choose(): Promise<void> {
  selected = candidates[Number(selector.value)];
  if (!selected) return;
  const reply = await run({ action: "extract", origin, candidate: selected });
  if (reply.snapshot) { data = new Dataset(); pages = 1; capped = false; absorb(reply.snapshot); renderColumns(); render(); message("Ready. Review columns, export, or start a bounded crawl."); }
}
async function task(work: (signal: AbortSignal) => Promise<void>): Promise<void> {
  if (busy) return;
  const taskGeneration = generation;
  busy = true; controller = new AbortController(); controls();
  try { await work(controller.signal); } catch (error) { if (taskGeneration === generation) message(error instanceof Error ? error.message : "Operation failed.", true); }
  finally { busy = false; controller = undefined; controls(); }
}
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = (): void => { clearTimeout(timer); signal.removeEventListener("abort", cancel); reject(new Error("Stopped. Collected rows remain available for export.")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel();
  });
}
async function crawl(signal: AbortSignal): Promise<void> {
  if (!selected) return;
  const delay = Number(input("delay").value) * 1000, wait = Number(input("wait").value) * 1000, limit = Number(input("limit").value);
  if (!Number.isFinite(delay) || delay < 500 || delay > 30000 || !Number.isFinite(wait) || wait <= delay || wait > 60000 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Use a delay of 0.5–30 seconds, max wait greater than delay (up to 60 seconds), and 1–100 steps.");
  const next = input("next").value.trim();
  if (mode.value === "next" && !next) throw new Error("Locate Next or enter its CSS selector first.");
  if (data.limited || capped) throw new Error("Collection limits reached. Export or choose a smaller structure.");
  for (let step = 0; step < limit; step++) {
    if (signal.aborted) throw new Error("Stopped.");
    await run(mode.value === "scroll" ? { action: "scroll", origin, candidate: selected } : { action: "next", origin, selector: next });
    message("Waiting for page changes · step " + (step + 1) + " of " + limit + "…");
    const started = Date.now(); let stable = "", stableSince = 0, result: Snapshot | undefined;
    await pause(delay, signal);
    while (Date.now() - started < wait) {
      if (signal.aborted) throw new Error("Stopped.");
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || new URL(tab.url).origin !== origin) throw new Error("Source access changed. Stop and reopen the extension on the source page.");
      if (tab.status !== "loading") {
        try {
          const reply = await run({ action: "extract", origin, candidate: selected });
          if (reply.snapshot?.rows.length) {
            const fingerprint = JSON.stringify(reply.snapshot.rows);
            if (fingerprint !== lastSnapshot) {
              if (fingerprint !== stable) { stable = fingerprint; stableSince = Date.now(); }
              else if (Date.now() - stableSince >= 500) { result = reply.snapshot; break; }
            }
          }
        } catch (error) {
          if (Date.now() - started > wait - 600) throw error;
        }
      }
      await pause(300, signal);
    }
    if (signal.aborted) throw new Error("Stopped. Collected rows remain available for export.");
    if (!result) { message("No changed rows appeared within max wait. Finished; increase max wait if the site loads slowly."); return; }
    const added = absorb(result); pages++; render();
    if (!added) { message("No new unique rows. Crawling finished."); return; }
    if (data.limited || capped) { message("Collection limit reached. Export the collected rows."); return; }
  }
  message("Step limit reached. Export or explicitly start another crawl.");
}
function download(content: BlobPart, type: string, extension: "csv" | "xlsx"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = exportFilename(pageTitle, extension);
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
button("detect").addEventListener("click", () => void task(async () => {
  message("Finding tables and repeated lists…");
  const reply = await run({ action: "discover", origin });
  candidates = reply.candidates ?? []; selector.replaceChildren(); selected = undefined;
  candidates.forEach((candidate, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = candidate.label + " (" + candidate.count + " rows)"; selector.append(option); });
  if (!candidates.length) { message("No supported rows found in the loaded page. Let the page finish loading, scroll to the data, then try Detect tables again.", true); return; }
  selector.value = "0"; await choose();
}));
selector.addEventListener("change", () => void task(choose));
button("another").addEventListener("click", () => void task(async () => { selector.value = String((Number(selector.value) + 1) % candidates.length); await choose(); }));
button("pick").addEventListener("click", () => void task(async () => {
  message("Click the Next link or button on your source page. Escape cancels; selection expires after 30 seconds.");
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true }); await chrome.windows.update(tab.windowId, { focused: true });
  const reply = await run({ action: "pick", origin });
  input("next").value = reply.selector ?? ""; message("Next control selected. Start crawl will activate it.");
  const current = await chrome.windows.getCurrent(); if (current.id !== undefined) await chrome.windows.update(current.id, { focused: true });
}));
button("start").addEventListener("click", () => void task(crawl));
button("stop").addEventListener("click", () => { controller?.abort(); void run({ action: "cancel", origin }).catch(() => {}); });
button("clear").addEventListener("click", () => {
  generation++;
  controller?.abort(); void run({ action: "cancel", origin }).catch(() => {});
  data = new Dataset(); pages = 0; capped = false; selected = undefined; candidates = []; selector.replaceChildren(); input("next").value = ""; input("filter").value = ""; renderColumns(); render(); message("Session cleared.");
});
mode.addEventListener("change", controls);
input("filter").addEventListener("input", render);
button("reset").addEventListener("click", () => { data.columns.forEach(x => { x.name = x.label; x.enabled = true; }); renderColumns(); render(); });
button("csv").addEventListener("click", () => download("\uFEFF" + delimited(data.matrix(input("filter").value)), "text/csv;charset=utf-8", "csv"));
button("xlsx").addEventListener("click", () => download(workbook(data.matrix(input("filter").value)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"));
button("copy").addEventListener("click", () => {
  // Invoke clipboard synchronously from the user gesture; no clipboard permission requested.
  void navigator.clipboard.writeText(delimited(data.matrix(input("filter").value), "\t")).then(() => message("Copied matching rows to the clipboard."), () => message("Clipboard access was denied. Use CSV export instead.", true));
});
window.addEventListener("beforeunload", () => { controller?.abort(); if (origin) void run({ action: "cancel", origin }).catch(() => {}); });
async function initialize(): Promise<void> {
  try {
    if (!Number.isInteger(tabId)) throw new Error("Open the extension from its toolbar icon on the page you want to scrape.");
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url ?? "");
    if (!["https:","http:"].includes(url.protocol)) throw new Error("Open a regular HTTP(S) website first. Browser settings and extension-store pages cannot be scraped.");
    origin = url.origin; pageTitle = tab.title?.trim() || url.hostname; el("source").textContent = url.hostname; el("source").title = origin; controls();
  } catch (error) { message(error instanceof Error ? error.message : "Source tab unavailable.", true); button("detect").disabled = true; }
}
// Keep secondary controls in dismissible panels without moving the data grid.
document.addEventListener("click", (event) => {
  for (const panel of document.querySelectorAll<HTMLDetailsElement>(".popover[open]"))
    if (event.target instanceof Node && !panel.contains(event.target)) panel.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") for (const panel of document.querySelectorAll<HTMLDetailsElement>(".popover[open]")) {
    panel.open = false; panel.querySelector("summary")?.focus();
  }
});
render(); void initialize();
