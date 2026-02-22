import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const lines = [];
    let header = null;
    let buffer = '';
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
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        fields.push(current.trim());
        if (!header) {
          header = fields;
        } else {
          const row = {};
          header.forEach((col, i) => { row[col] = (fields[i] || '').replace(/^"|"$/g, '').trim(); });
          lines.push(row);
        }
      }
      resolve(lines);
    });
    stream.on('error', reject);
  });
}

export async function importMasterDataset() {
  const csvPath = join(__dirname, '../../data/master_dataset.csv');
  console.log(`[Import] Reading CSV from: ${csvPath}`);

  const rows = await parseCSV(csvPath);
  console.log(`[Import] Parsed ${rows.length} rows`);

  const insertDrug = db.prepare(`
    INSERT OR IGNORE INTO drugs (app_no, brand_name, generic_name, app_type)
    VALUES (?, ?, ?, ?)
  `);
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (drug_id, app_no, product_no, strength, route, approval_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertPatent = db.prepare(`
    INSERT OR IGNORE INTO patents (drug_id, app_no, product_no, patent_number, patent_expiry_date, days_until_expiry)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getDrugId = db.prepare(`SELECT id FROM drugs WHERE app_no = ?`);

  db.exec('BEGIN');
  let drugsInserted = 0, productsInserted = 0, patentsInserted = 0;

  try {
    for (const row of rows) {
      insertDrug.run(row.app_no, row.brand_name, row.generic_name, row.app_type || 'N');

      const drug = getDrugId.get(row.app_no);
      if (!drug) { console.warn(`[Import] Could not find drug for app_no=${row.app_no}`); continue; }
      drugsInserted++;

      insertProduct.run(drug.id, row.app_no, row.product_no, row.strength, row.route, row.approval_date);
      productsInserted++;

      insertPatent.run(
        drug.id, row.app_no, row.product_no, row.patent_number,
        row.patent_expiry_date, parseInt(row.days_until_expiry) || null
      );
      patentsInserted++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`[Import] ✅ Done!`);
  console.log(`         Drugs inserted:    ${drugsInserted}`);
  console.log(`         Products inserted: ${productsInserted}`);
  console.log(`         Patents inserted:  ${patentsInserted}`);
}