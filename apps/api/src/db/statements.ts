// A SQL statement with numbered parameters (?1, ?2, …), kept free of D1 types
// so scripts/seed.ts (Node) can share the exact SQL the Worker runs.

export type SqlValue = string | number | null;

export interface Statement {
  sql: string;
  params: SqlValue[];
}

function toLiteral(value: SqlValue | undefined): string {
  if (value === undefined) throw new Error("Statement is missing a parameter");
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot inline ${value} as SQL`);
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Renders a statement as one line of plain SQL with its parameters inlined as
 * literals, for `wrangler d1 execute`. Whitespace is collapsed before the
 * parameters go in, so values keep theirs; JSON parameters never contain raw
 * newlines, which keeps every statement on a single line.
 */
export function toSqlText({ sql, params }: Statement): string {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return `${oneLine.replace(/\?(\d+)/g, (_, n: string) => toLiteral(params[Number(n) - 1]))};`;
}
