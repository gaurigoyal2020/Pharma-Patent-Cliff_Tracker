import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';
import { importMasterDataset } from '../services/importData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('=== Patent Cliff Tracker — DB Migration ===\n');

try {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

  // Split schema into individual statements and run each one
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await db.raw(statement);
  }

  console.log('[Migrate] Tables created ✅\n');

  await importMasterDataset();

  console.log('\n[Migrate] Migration complete ✅');
} catch (err) {
  console.error('\n[Migrate] ❌ Error:', err);
} finally {
  await db.destroy();
  process.exit(0);
}