import { run } from "./run";
import { insertUserStatement } from "./writes";

async function findUserId(db: D1Database, email: string): Promise<string | null> {
  return db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<string>("id");
}

/**
 * The id of the user bound to `email`, creating the user on first sight.
 * Costs one read once the user exists.
 */
export async function ensureUser(db: D1Database, email: string): Promise<string> {
  const existing = await findUserId(db, email);
  if (existing) return existing;
  // ON CONFLICT DO NOTHING: a concurrent first request may have bound it already.
  await run(db, insertUserStatement(crypto.randomUUID(), email));
  const id = await findUserId(db, email);
  if (!id) throw new Error(`Failed to create a user for ${email}`);
  return id;
}
