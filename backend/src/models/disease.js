import db from '../config/database.js';
import { toCard } from './drug.js';

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

export function getAllDiseases() {
  return Object.keys(DISEASE_INGREDIENT_MAP).sort();
}

export async function getDrugsByDiseaseForFrontend(disease) {
  const keywords = DISEASE_INGREDIENT_MAP[disease];
  if (!keywords) return null;

  const rows = await db('drugs as d')
    .leftJoin('products as p', 'p.app_no', 'd.app_no')
    .leftJoin('patents as pt', 'pt.app_no', 'd.app_no')
    .select(
      'd.id',
      'd.app_no',
      'd.brand_name',
      'd.generic_name',
      'p.route as dosage_form',
      'p.strength',
      db.raw('MIN(pt.patent_expiry_date) as earliest_expiry')
    )
    .where(function () {
      keywords.forEach((keyword, i) => {
        const method = i === 0 ? 'whereRaw' : 'orWhereRaw';
        this[method]('UPPER(d.generic_name) LIKE ?', [`%${keyword}%`]);
      });
    })
    .groupBy('d.id', 'd.app_no', 'd.brand_name', 'd.generic_name', 'p.route', 'p.strength')
    .orderBy('d.brand_name');

  return rows.map(toCard);
}