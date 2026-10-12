/**
 * Legal documents are plain data. Strings may contain a little inline markup, rendered by LegalPage:
 *   **bold**, `code`, [link text](/path), and [TO BE COMPLETED: what goes here] (shown as a visible placeholder).
 */
export type ListItem = string | { text: string; blocks: Block[] };

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: ListItem[] }
  | { type: 'ol'; items: ListItem[] }
  /** Two-column label/value list (for example the controller's details). */
  | { type: 'kv'; rows: [string, string][] }
  /** A plain table, for short tables that fit the reading column. */
  | { type: 'table'; head: string[]; rows: string[][] }
  /** A wide table shown as one entry per row: the first column is the title, the others are labelled by `head`. */
  | { type: 'entries'; head: string[]; rows: string[][] };

export type LegalSection = {
  /** Section number as in the source ("1", "2", ...). Used for the heading and the anchor `#s{n}`. */
  n: number;
  title: string;
  blocks: Block[];
};

export type LegalDoc = {
  /** Browser tab title and meta description. */
  metaTitle: string;
  metaDescription: string;
  /** Page h1. */
  title: string;
  /** Draft label, shown above the title. `null` once the text is in force. */
  draft: string | null;
  /** Version line, e.g. "Draft of October 9, 2026". */
  version: string;
  /** Source states a version date; shown as "Last updated". */
  lastUpdated: string;
  effective: string;
  intro?: Block[];
  sections: LegalSection[];
};
