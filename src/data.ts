import type { Field, Row, Snapshot } from "./types.js";
export interface Column extends Field { name: string; enabled: boolean }
export class Dataset {
  columns: Column[] = [];
  rows: Row[] = [];
  private keys = new Set<string>();
  private characters = 0;
  limited = false;
  merge(snapshot: Snapshot): number {
    for (const field of snapshot.fields) {
      if (!this.columns.some(x => x.key === field.key)) {
        if (this.columns.length >= 60) { this.limited = true; continue; }
        this.columns.push({ ...field, name: field.label, enabled: true });
      }
    }
    let added = 0;
    for (const source of snapshot.rows) {
      const row: Row = {};
      for (const field of this.columns) if (source[field.key] !== undefined) row[field.key] = source[field.key]!;
      const key = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
      if (this.keys.has(key)) continue;
      if (this.rows.length >= 10000 || this.characters + key.length > 20000000) { this.limited = true; break; }
      this.keys.add(key); this.rows.push(row); this.characters += key.length; added++;
    }
    return added;
  }
  matrix(filter = ""): string[][] {
    const columns = this.columns.filter(x => x.enabled);
    const query = filter.toLocaleLowerCase();
    const selected = this.rows.map(row => columns.map(col => row[col.key] ?? ""));
    return [columns.map(x => x.name), ...selected.filter(row => !query || row.some(cell => cell.toLocaleLowerCase().includes(query)))];
  }
}
export function safeCell(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
}
export function exportFilename(pageTitle: string, extension: "csv" | "xlsx", date = new Date()): string {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(".");
  const name = pageTitle.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, 150).replace(/[. ]+$/g, "") || "Untitled page";
  return day + "_" + name + "." + extension;
}
export function delimited(matrix: string[][], delimiter = ","): string {
  return matrix.map(row => row.map(value => '"' + safeCell(value).replace(/"/g, '""') + '"').join(delimiter)).join("\r\n");
}
