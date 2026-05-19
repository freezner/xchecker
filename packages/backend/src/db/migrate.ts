import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from './client';

export async function runMigrations() {
  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    await db.query(sql);
  }
  console.log('[db] migrations complete');
}
