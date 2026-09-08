export interface Candidate { selector: string; kind: "table" | "list"; label: string; count: number; rowTag: string }
export interface Field { key: string; label: string }
export type Row = Record<string, string>;
export interface Snapshot { fields: Field[]; rows: Row[]; truncated: boolean }
export type Command =
  | { action: "discover"; origin: string }
  | { action: "extract"; origin: string; candidate: Candidate }
  | { action: "pick"; origin: string }
  | { action: "cancel"; origin: string }
  | { action: "next"; origin: string; selector: string }
  | { action: "scroll"; origin: string; candidate: Candidate };
export interface Reply { candidates?: Candidate[]; snapshot?: Snapshot; selector?: string; error?: string }
