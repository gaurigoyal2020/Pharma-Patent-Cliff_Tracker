// src/services/importData.js
import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/database.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function categorizeDrug(genericName, brandName) {
  const name = (genericName || brandName || '').toLowerCase();
  if (/statin|atorva|rosuva|simva|lovasta/.test(name)) return 'cholesterol';
  if (/insulin|metformin|glipizide|sitagliptin|gluc/.test(name)) return 'diabetes';
  if (/apixaban|rivaroxaban|warfarin|heparin|dabigatran|ticagrelor/.test(name)) return 'anticoagulant';
  if (/adalimumab|etanercept|rituximab|infliximab/.test(name)) return 'immunosuppressant';
  if (/omeprazole|esomeprazole|pantoprazole|lansoprazole/.test(name)) return 'acid reflux';
  if (/amoxicillin|azithromycin|ciprofloxacin|doxycycline/.test(name)) return 'antibiotic';
  if (/ibuprofen|naproxen|celecoxib|diclofenac/.test(name)) return 'pain relief';
  if (/amlodipine|lisinopril|metoprolol|atenolol|losartan/.test(name)) return 'cardiovascular';
  return 'other';
}

function calculateStatus(expiryDate) {
  if (!expiryDate) return 'active';
  return new Date(expiryDate) < new Date() ? 'expired' : 'active';
}

async function importFromMasterDataset(csvPath) {
  console.log(`\n📊 Reading: ${csvPath}`);

  const drugs = new Map();
  const patents = [];

  // Read CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (row) => {
        const drugKey = `${row.app_no}_${row.product_no}`;

        if (!drugs.has(drugKey)) {
          drugs.set(drugKey, {
            generic_name: row.generic_name || 'Unknown',
            brand_name: row.brand_name || null,
            strength: row.strength || null,
            dosage_form: row.route || null,
            category: categorizeDrug(row.generic_name, row.brand_name),
            fda_application_number: row.app_no,
          });
        }

        if (row.patent_number && row.patent_expiry_date) {
          patents.push({
            drugKey,
            patent_number: row.patent_number,
            expiry_date: row.patent_expiry_date,
            status: calculateStatus(row.patent_expiry_date),
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`   Found ${drugs.size} drugs, ${patents.length} patents`);

  // Insert drugs (use a transaction for speed)
  const insertDrug = db.prepare(
    `INSERT INTO drugs (generic_name, brand_names, strength, dosage_form, category, fda_application_number)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const drugIdMap = new Map();

  const insertAllDrugs = db.transaction(() => {
    for (const [key, drug] of drugs) {
      const result = insertDrug.run(
        drug.generic_name,
        drug.brand_name ? JSON.stringify([drug.brand_name]) : JSON.stringify([]),
        drug.strength,
        drug.dosage_form,
        drug.category,
        drug.fda_application_number
      );
      drugIdMap.set(key, result.lastInsertRowid);
    }
  });

  insertAllDrugs();
  console.log(`✅ Imported ${drugs.size} drugs`);

  // Insert patents
  const insertPatent = db.prepare(
    `INSERT OR IGNORE INTO patents (drug_id, patent_number, patent_type, expiry_date, status)
     VALUES (?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const insertAllPatents = db.transaction(() => {
    for (const patent of patents) {
      const drugId = drugIdMap.get(patent.drugKey);
      if (!drugId) continue;
      const result = insertPatent.run(
        drugId,
        patent.patent_number,
        'substance',
        patent.expiry_date,
        patent.status
      );
      if (result.changes > 0) imported++;
    }
  });

  insertAllPatents();
  console.log(`✅ Imported ${imported} patents`);
  console.log('\n🎉 Import complete!');

  db.close();
}

const csvPath = process.argv[2] || path.join(__dirname, '../../data/master_dataset.csv');
importFromMasterDataset(csvPath)
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });