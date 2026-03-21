import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BATCH_SIZE = 500; // insert 500 rows at a time

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let header = null;
    const lines = [];

    const stream = createReadStream(filePath, 'utf8');

    stream.on('data', chunk => { buffer += chunk; });

    stream.on('end', () => {
      const rawLines = buffer.split('\n');

      for (const raw of rawLines) {
        const line = raw.trim().replace(/\r$/, '');
        if (!line) continue;

        const fields = [];
        let inQuote = false;
        let current = '';

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuote = !inQuote;
          } else if (ch === ',' && !inQuote) {
            fields.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        fields.push(current.trim());

        if (!header) {
          header = fields;
        } else {
          const row = {};
          header.forEach((col, i) => {
            row[col] = (fields[i] || '').replace(/^"|"$/g, '').trim();
          });
          lines.push(row);
        }
      }
      resolve(lines);
    });

    stream.on('error', reject);
  });
}

// ─── Batch insert helper ──────────────────────────────────────────────────────
// Splits a large array into chunks and inserts each chunk separately.
// Why: PostgreSQL has a limit on query size. Inserting 21k rows in one
// query would exceed it. 500 rows at a time is safe and still very fast.
async function batchInsert(trx, table, rows, conflictTarget) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    chunks.push(rows.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    await trx(table)
      .insert(chunk)
      .onConflict(conflictTarget)
      .ignore();
  }
}

// ─── Main import function ─────────────────────────────────────────────────────
export async function importMasterDataset() {
  const csvPath = join(__dirname, '../../data/master_dataset.csv');
  console.log(`[Import] Reading CSV from: ${csvPath}`);

  const rows = await parseCSV(csvPath);
  console.log(`[Import] Parsed ${rows.length} rows`);

  // Skip if data already exists
  const existing = await db('drugs').count('id as count').first();
  if (parseInt(existing.count) > 0) {
    console.log(`[Import] Data already exists (${existing.count} drugs). Skipping.`);
    return;
  }

  console.log('[Import] Starting batch import...');

  await db.transaction(async (trx) => {

    // ── Step 1: Insert all unique drugs ──────────────────────────────────────
    const drugRows = [];
    const seenAppNos = new Set();

    for (const row of rows) {
      if (!seenAppNos.has(row.app_no)) {
        seenAppNos.add(row.app_no);
        drugRows.push({
          app_no:       row.app_no,
          brand_name:   row.brand_name,
          generic_name: row.generic_name,
          app_type:     row.app_type || 'N',
        });
      }
    }

    await batchInsert(trx, 'drugs', drugRows, 'app_no');
    console.log(`[Import] ✅ Drugs inserted: ${drugRows.length}`);

    // ── Step 2: Fetch all drug IDs from DB in one query ───────────────────────
    // Why: products and patents need drug_id (the DB-generated integer ID).
    // We fetch all at once and build a lookup map so we never query in a loop.
    const allDrugs = await trx('drugs').select('id', 'app_no');
    const drugIdMap = {};
    for (const drug of allDrugs) {
      drugIdMap[drug.app_no] = drug.id;
    }
    console.log(`[Import] ✅ Drug ID map built: ${allDrugs.length} entries`);

    // ── Step 3: Insert all products ───────────────────────────────────────────
    const productRows = [];
    const seenProducts = new Set();

    for (const row of rows) {
      const key = `${row.app_no}__${row.product_no}`;
      if (!seenProducts.has(key) && drugIdMap[row.app_no]) {
        seenProducts.add(key);
        productRows.push({
          drug_id:       drugIdMap[row.app_no],
          app_no:        row.app_no,
          product_no:    row.product_no,
          strength:      row.strength,
          route:         row.route,
          approval_date: row.approval_date || null,
        });
      }
    }

    await batchInsert(trx, 'products', productRows, ['app_no', 'product_no']);
    console.log(`[Import] ✅ Products inserted: ${productRows.length}`);

    // ── Step 4: Insert all patents ────────────────────────────────────────────
    const patentRows = [];
    const seenPatents = new Set();

    for (const row of rows) {
      const key = `${row.app_no}__${row.product_no}__${row.patent_number}`;
      if (!seenPatents.has(key) && drugIdMap[row.app_no]) {
        seenPatents.add(key);
        patentRows.push({
          drug_id:            drugIdMap[row.app_no],
          app_no:             row.app_no,
          product_no:         row.product_no,
          patent_number:      row.patent_number,
          patent_expiry_date: row.patent_expiry_date || null,
        });
      }
    }

    await batchInsert(trx, 'patents', patentRows, ['app_no', 'product_no', 'patent_number']);
    console.log(`[Import] ✅ Patents inserted: ${patentRows.length}`);

  });

  console.log('\n[Import] 🎉 All done!');
}