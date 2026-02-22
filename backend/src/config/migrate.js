import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';
import { importMasterDataset } from '../services/importData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('=== Patent Cliff Tracker — DB Migration ===\n');

try {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('[Migrate] Tables created ✅\n');

  await importMasterDataset();

  console.log('\n[Migrate] Migration complete ✅');
  process.exit(0);
} catch (err) {
  console.error('\n[Migrate] ❌ Error:', err.message);
  process.exit(1);
}