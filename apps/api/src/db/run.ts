import type { Statement } from "./statements";

function prepare(db: D1Database, { sql, params }: Statement): D1PreparedStatement {
  return db.prepare(sql).bind(...params);
}

export async function run(db: D1Database, statement: Statement): Promise<void> {
  await prepare(db, statement).run();
}

/** Runs the statements as one batch, which D1 executes as a single transaction. */
export async function runBatch(db: D1Database, statements: readonly Statement[]): Promise<void> {
  await db.batch(statements.map((statement) => prepare(db, statement)));
}
