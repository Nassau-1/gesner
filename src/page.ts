import type { Candidate, Command, Field, Reply, Row } from "./types.js";

// Serialized by chrome.scripting: keep all runtime helpers inside this function.
export async function pageTask(command: Command): Promise<Reply> {
  if (location.origin !== command.origin) return { error: "The source page changed origin. Reopen the extension on that page." };
  const state = window as Window & { __privateScraperCancel?: () => void };
  let clipped = false;
  const excluded = "script,style,noscript,template,input,textarea,select,option,[contenteditable]:not([contenteditable='false']),[hidden],[aria-hidden='true']";
  const visible = (el: Element): boolean => {
    if (el.closest(excluded)) return false;
    const css = getComputedStyle(el);
    if (css.display === "none" || css.visibility === "hidden" || (css.display !== "contents" && !el.getClientRects().length)) return false;
    // display:contents has no box of its own, but its text and children can be visible.
    for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.opacity === "0" || style.display === "none") return false;
    }
    return true;
  };
  const text = (el: Element): string => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let length = 0, visited = 0;
    while (walker.nextNode() && visited++ < 3000 && length < 2000) {
      const node = walker.currentNode;
      if (node.parentElement && visible(node.parentElement)) {
        const value = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        parts.push(value); length += value.length;
      }
    }
    if (length > 2000 || visited >= 3000) clipped = true;
    return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 2000);
  };
  const selectorFor = (el: Element): string => {
    if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) return "#" + CSS.escape(el.id);
    const parts: string[] = [];
    let current: Element | null = el;
    while (current && current !== document.documentElement) {
      const parent: Element | null = current.parentElement;
      const tag = current.tagName.toLowerCase();
      const siblings = parent ? Array.from(parent.children).filter(x => x.tagName === current?.tagName) : [];
      parts.unshift(tag + (siblings.length > 1 ? ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")" : ""));
      current = parent;
    }
    return parts.join(" > ");
  };
  const children = (el: Element, tag: string): Element[] => Array.from(el.children).filter(x => x.tagName.toLowerCase() === tag && visible(x) && text(x));
  const safeUrl = (raw: string | null): string => {
    if (!raw) return "";
    try { const url = new URL(raw, location.href); return ["http:", "https:"].includes(url.protocol) ? url.href.slice(0, 2000) : ""; }
    catch { return ""; }
  };
  const find = (selector: string): Element | null => {
    try { return document.querySelector(selector); } catch { return null; }
  };
  if (command.action === "cancel") { state.__privateScraperCancel?.(); return {}; }
  if (command.action === "pick") {
    state.__privateScraperCancel?.();
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout>;
      let hovered: HTMLElement | null = null;
      let priorOutline = "", priorPriority = "";
      const restore = (): void => {
        if (hovered) {
          if (priorOutline) hovered.style.setProperty("outline", priorOutline, priorPriority);
          else hovered.style.removeProperty("outline");
        }
        hovered = null;
      };
      const cleanup = (): void => {
        clearTimeout(timer); restore();
        document.removeEventListener("click", click, true);
        document.removeEventListener("mouseover", hover, true);
        document.removeEventListener("keydown", key, true);
        delete state.__privateScraperCancel;
      };
      const cancel = (): void => { cleanup(); resolve({ error: "Selection cancelled." }); };
      const hover = (event: MouseEvent): void => {
        restore();
        const target = event.target instanceof Element ? event.target.closest("a,button,[role='button']") : null;
        if (target instanceof HTMLElement) {
          hovered = target; priorOutline = target.style.getPropertyValue("outline"); priorPriority = target.style.getPropertyPriority("outline");
          target.style.setProperty("outline", "3px solid #12856a", "important");
        }
      };
      const click = (event: MouseEvent): void => {
        event.preventDefault(); event.stopImmediatePropagation();
        const target = event.target instanceof Element ? event.target.closest("a,button,[role='button']") : null;
        if (!target) return;
        const selector = selectorFor(target); cleanup(); resolve({ selector });
      };
      const key = (event: KeyboardEvent): void => { if (event.key === "Escape") { event.preventDefault(); cancel(); } };
      document.addEventListener("click", click, true);
      document.addEventListener("mouseover", hover, true);
      document.addEventListener("keydown", key, true);
      state.__privateScraperCancel = cancel;
      timer = setTimeout(cancel, 30000);
    });
  }
  if (command.action === "next") {
    const target = find(command.selector);
    if (!(target instanceof HTMLElement) || !visible(target)) return { error: "Next control not found. Crawling finished." };
    if (target.matches(":disabled,[aria-disabled='true']")) return { error: "Next control is disabled. Crawling finished." };
    if (target instanceof HTMLButtonElement && target.form && target.type !== "button") return { error: "Form submission controls cannot be used for pagination." };
    if (target instanceof HTMLAnchorElement) {
      const url = safeUrl(target.getAttribute("href"));
      if (!url || new URL(url).origin !== location.origin || target.download || (target.target && target.target !== "_self")) return { error: "Next must be a same-origin link in this tab." };
    } else if (!target.matches("button,[role='button']")) return { error: "Choose a link or a button." };
    // Return the acknowledgment before a normal full-page navigation destroys this context.
    setTimeout(() => target.click(), 0);
    return {};
  }
  if (command.action === "scroll") {
    const target = find(command.candidate.selector);
    if (!target) return { error: "Selected structure is no longer present." };
    let container: Element | null = target;
    while (container && !(container.scrollHeight > container.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(container).overflowY))) container = container.parentElement;
    const scrolling = container ?? document.scrollingElement;
    if (!scrolling) return { error: "No scrolling area found." };
    scrolling.scrollTop += Math.max(500, scrolling.clientHeight * 0.85);
    return {};
  }
  if (command.action === "discover") {
    const candidates: (Candidate & { score: number })[] = [];
    for (const table of Array.from(document.querySelectorAll("table")).slice(0, 100)) {
      if (!visible(table)) continue;
      const rows = Array.from(table.rows).filter(row => row.closest("table") === table && visible(row));
      if (rows.length >= 2) candidates.push({ selector: selectorFor(table), kind: "table", label: text(table.caption ?? rows[0] ?? table).slice(0, 80) || "HTML table", count: rows.length, rowTag: "tr", score: rows.length * 10 });
    }
    // Bound traversal on very large pages. Work on immediate repeated siblings.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let scanned = 0;
    while (walker.nextNode() && scanned++ < 12000) {
      const el = walker.currentNode as Element;
      if (el.closest("table,nav,header,footer," + excluded) || el.childElementCount < 3 || el.childElementCount > 2000 || !visible(el)) continue;
      const groups = new Map<string, Element[]>();
      for (const child of Array.from(el.children)) {
        if (!visible(child) || child.matches(excluded)) continue;
        const tag = child.tagName.toLowerCase();
        const group = groups.get(tag) ?? []; group.push(child); groups.set(tag, group);
      }
      for (const [tag, group] of groups) {
        if (group.length < 3 || group.length < el.childElementCount * 0.6) continue;
        // Empty separators and loading placeholders are not records.
        const populated = group.filter(x => text(x));
        if (populated.length < 3) continue;
        const sample = populated.slice(0, 4).map(x => text(x));
        if (new Set(sample).size < 2) continue;
        candidates.push({ selector: selectorFor(el), kind: "list", rowTag: tag, label: tag.toUpperCase() + " list · " + sample[0]?.slice(0, 65), count: populated.length, score: Math.min(populated.length, 200) * 2 + Math.min(populated[0]?.childElementCount ?? 0, 10) });
      }
    }
    return { candidates: candidates.sort((a,b) => b.score - a.score).slice(0, 20).map(({ score: _score, ...candidate }) => candidate) };
  }
  const candidate = command.candidate;
  const container = find(candidate.selector);
  if (!container || !visible(container)) return { error: "Selected structure is not present. Detect tables again." };
  const rowElements = candidate.kind === "table" && container instanceof HTMLTableElement
    ? Array.from(container.rows).filter(x => x.closest("table") === container && visible(x))
    : children(container, candidate.rowTag);
  const fields: Field[] = [], rows: Row[] = [];
  let truncated = rowElements.length > 1000, budget = 0;
  const add = (row: Row, key: string, label: string, value: string): void => {
    if (!value || budget >= 1000000) { if (budget >= 1000000) truncated = true; return; }
    if (!fields.some(x => x.key === key)) {
      if (fields.length >= 60) { truncated = true; return; }
      fields.push({ key, label });
    }
    const bounded = value.slice(0, 2000);
    if (bounded.length < value.length) truncated = true;
    row[key] = bounded; budget += bounded.length;
  };
  if (candidate.kind === "table") {
    const grid: { text: string; href: string; src: string; header: boolean }[][] = [];
    for (const [r, element] of rowElements.slice(0, 1000).entries()) {
      const line = grid[r] ?? []; grid[r] = line;
      if (!(element instanceof HTMLTableRowElement)) continue;
      let col = 0;
      for (const cell of Array.from(element.cells).filter(visible)) {
        while (line[col]) col++;
        if (col >= 60) { truncated = true; break; }
        const a = cell.querySelector("a[href]"), img = cell.querySelector("img[src]");
        const value = { text: text(cell), href: a && visible(a) ? safeUrl(a.getAttribute("href")) : "", src: img && visible(img) ? safeUrl(img.getAttribute("src")) : "", header: cell.tagName === "TH" };
        for (let dr = 0; dr < Math.min(cell.rowSpan || rowElements.length - r, 1000 - r); dr++) {
          const dest = grid[r + dr] ?? []; grid[r + dr] = dest;
          for (let dc = 0; dc < Math.min(cell.colSpan, 60 - col); dc++) dest[col + dc] = value;
        }
        col += Math.min(cell.colSpan, 60);
      }
    }
    const header = grid[0]?.length && grid[0].every(x => x.header) ? grid[0] : undefined;
    for (const line of grid.slice(header ? 1 : 0, rowElements.length)) {
      const row: Row = {};
      line.forEach((cell, index) => {
        const label = header?.[index]?.text || "Column " + (index + 1);
        add(row, "c" + index, label, cell.text);
        add(row, "c" + index + ":href", label + " URL", cell.href);
        add(row, "c" + index + ":src", label + " image URL", cell.src);
      });
      if (Object.keys(row).length) rows.push(row);
      if (budget >= 1000000) break;
    }
  } else {
    for (const element of rowElements.slice(0, 1000)) {
      const row: Row = {};
      let visited = 0;
      const walk = (el: Element, path: string, depth: number): void => {
        if (!visible(el) || depth > 10 || visited++ >= 300) return;
        const direct = Array.from(el.childNodes).filter(x => x.nodeType === Node.TEXT_NODE).map(x => x.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
        const label = el.getAttribute("aria-label") || (el.classList[0] ? el.classList[0].replace(/[-_]/g, " ") : el.tagName.toLowerCase());
        add(row, path + ":text", label, direct);
        if (el.matches("a[href]")) add(row, path + ":href", label + " URL", safeUrl(el.getAttribute("href")));
        if (el.matches("img[src]")) add(row, path + ":src", label + " image URL", safeUrl(el.getAttribute("src")));
        const counts = new Map<string, number>();
        for (const child of Array.from(el.children)) {
          const tag = child.tagName.toLowerCase(), n = (counts.get(tag) ?? 0) + 1; counts.set(tag, n);
          walk(child, path + "/" + tag + ":" + n, depth + 1);
        }
      };
      walk(element, "row", 0);
      if (Object.keys(row).length) rows.push(row);
      if (budget >= 1000000) break;
    }
  }
  return { snapshot: { fields, rows, truncated: truncated || clipped } };
}
