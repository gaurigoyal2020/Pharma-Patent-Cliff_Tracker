// src/models/disease.js
//
// Disease → generic ingredient keyword mappings.
// Each disease maps to a list of UPPER-CASE substrings that are matched against
// the generic_name column in the drugs table.  This is intentionally broad so
// that combination products (e.g. "METFORMIN HYDROCHLORIDE; SITAGLIPTIN") are
// captured by either keyword.
//
// Only diseases whose drugs actually exist in the patent_tracker.db dataset are
// listed here.  The list was derived from master_dataset.csv.

import db from '../config/database.js';

const DISEASE_INGREDIENT_MAP = {
  'Diabetes': [
    'METFORMIN', 'SITAGLIPTIN', 'EMPAGLIFLOZIN', 'DAPAGLIFLOZIN',
    'CANAGLIFLOZIN', 'ERTUGLIFLOZIN', 'SEMAGLUTIDE', 'LIRAGLUTIDE',
    'EXENATIDE', 'DULAGLUTIDE', 'PIOGLITAZONE', 'ALOGLIPTIN',
    'SAXAGLIPTIN', 'LINAGLIPTIN', 'GLIMEPIRIDE', 'INSULIN',
  ],
  'Heart Disease & Anticoagulation': [
    'APIXABAN', 'RIVAROXABAN', 'SACUBITRIL', 'VALSARTAN',
    'CLOPIDOGREL', 'ASPIRIN',
  ],
  'Hypertension': [
    'LISINOPRIL', 'LOSARTAN', 'AMLODIPINE', 'VALSARTAN',
    'TELMISARTAN', 'PERINDOPRIL', 'ALISKIREN', 'INDAPAMIDE',
  ],
  'High Cholesterol': [
    'ATORVASTATIN', 'ROSUVASTATIN', 'SIMVASTATIN', 'EZETIMIBE',
  ],
  'Asthma & COPD': [
    'FLUTICASONE', 'ALBUTEROL', 'BUDESONIDE', 'SALMETEROL',
    'FORMOTEROL', 'VILANTEROL', 'UMECLIDINIUM', 'GLYCOPYRROLATE',
    'IPRATROPIUM', 'CICLESONIDE',
  ],
  'GERD & Acid Reflux': [
    'ESOMEPRAZOLE', 'OMEPRAZOLE',
  ],
  'Migraine': [
    'SUMATRIPTAN', 'ERENUMAB', 'NAPROXEN',
  ],
  'ADHD': [
    'METHYLPHENIDATE', 'AMPHETAMINE', 'DEXTROAMPHETAMINE',
    'LISDEXAMFETAMINE', 'SERDEXMETHYLPHENIDATE',
  ],
  "Parkinson's Disease": [
    'LEVODOPA', 'CARBIDOPA', 'FOSCARBIDOPA', 'FOSLEVODOPA',
  ],
  "Alzheimer's Disease": [
    'DONEPEZIL', 'MEMANTINE',
  ],
  'Arthritis & Pain': [
    'CELECOXIB', 'ADALIMUMAB', 'PREGABALIN', 'TRAMADOL',
  ],
  'Psychiatry & Schizophrenia': [
    'ARIPIPRAZOLE', 'QUETIAPINE', 'LOXAPINE', 'DULOXETINE',
    'FLIBANSERIN',
  ],
  'Allergy & Rhinitis': [
    'FLUTICASONE FUROATE', 'AZELASTINE', 'KETOTIFEN',
  ],
  'Obesity': [
    'SEMAGLUTIDE', 'LIRAGLUTIDE',
  ],
  'Acne & Dermatology': [
    'MINOCYCLINE', 'CLINDAMYCIN', 'BENZOYL PEROXIDE', 'DAPSONE',
    'TRETINOIN', 'TAZAROTENE', 'ISOTRETINOIN', 'TRIFAROTENE',
    'RETAPAMULIN', 'AZELAIC ACID', 'ECONAZOLE',
  ],
};

/**
 * Returns a sorted array of disease names whose drugs exist in the DB.
 */
export function getAllDiseases() {
  return Object.keys(DISEASE_INGREDIENT_MAP).sort();
}

/**
 * Returns drugs for a given disease in frontend card format:
 *   { id, app_no, name, generic_name, dosage_form, strength,
 *     patent_expired, patent_expiry? }
 *
 * Multiple keyword hits for the same drug are deduplicated (by app_no).
 */
export function getDrugsByDiseaseForFrontend(disease) {
  const keywords = DISEASE_INGREDIENT_MAP[disease];
  if (!keywords) return null;          // unknown disease → 404

  // Build one big UNION-less query with OR conditions so we get one row per
  // drug even when multiple keywords match.
  const conditions = keywords
    .map(() => `UPPER(d.generic_name) LIKE ?`)
    .join(' OR ');

  const params = keywords.map(k => `%${k}%`);

  const rows = db.prepare(`
    SELECT
      d.id,
      d.app_no,
      d.brand_name,
      d.generic_name,
      p.route        AS dosage_form,
      p.strength,
      MIN(pt.patent_expiry_date) AS earliest_expiry,
      MIN(pt.days_until_expiry)  AS min_days_until_expiry
    FROM drugs d
    LEFT JOIN products p  ON p.app_no = d.app_no
    LEFT JOIN patents  pt ON pt.app_no = d.app_no
    WHERE ${conditions}
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all(...params);

  return rows.map(r => ({
    id:             r.id,
    app_no:         r.app_no,
    name:           r.brand_name,
    generic_name:   r.generic_name,
    dosage_form:    r.dosage_form  || 'Oral',
    strength:       r.strength     || 'N/A',
    patent_expired: r.min_days_until_expiry === null || r.min_days_until_expiry < 0,
    ...(r.min_days_until_expiry !== null && r.min_days_until_expiry >= 0
      ? { patent_expiry: r.earliest_expiry }
      : {}),
  }));
}
