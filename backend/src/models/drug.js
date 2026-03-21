import db from '../config/database.js';

// ─── Shared helper ────────────────────────────────────────────────────────────
// Single source of truth for shaping a raw DB row into a frontend card.
// Used by search, alternatives, and disease queries.
export function toCard(r) {
  const daysUntilExpiry = r.earliest_expiry
    ? Math.floor((new Date(r.earliest_expiry) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    id:            r.id,
    app_no:        r.app_no,
    name:          r.brand_name,
    generic_name:  r.generic_name,
    dosage_form:   r.dosage_form || 'Oral',
    strength:      r.strength    || 'N/A',
    patent_expired: daysUntilExpiry === null || daysUntilExpiry < 0,
    ...(daysUntilExpiry !== null && daysUntilExpiry >= 0
      ? { patent_expiry: r.earliest_expiry }
      : {}),
  };
}

// ─── Base query fragment ──────────────────────────────────────────────────────
// Every search/list function needs the same JOIN + GROUP BY structure.
// We define it once here so it's never copy-pasted.
function baseDrugQuery() {
  return db('drugs as d')
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
    .groupBy('d.id', 'd.app_no', 'd.brand_name', 'd.generic_name', 'p.route', 'p.strength')
    .orderBy('d.brand_name');
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function getAllDrugs() {
  return db('drugs as d')
    .leftJoin('products as p', 'p.app_no', 'd.app_no')
    .leftJoin('patents as pt', 'pt.app_no', 'd.app_no')
    .select(
      'd.id', 'd.app_no', 'd.brand_name', 'd.generic_name', 'd.app_type',
      db.raw('COUNT(DISTINCT p.product_no) as product_count'),
      db.raw('COUNT(DISTINCT pt.patent_number) as patent_count'),
      db.raw('MIN(pt.patent_expiry_date) as earliest_expiry'),
      db.raw('MAX(pt.patent_expiry_date) as latest_expiry')
    )
    .groupBy('d.id', 'd.app_no', 'd.brand_name', 'd.generic_name', 'd.app_type')
    .orderBy('d.brand_name');
}

export async function getDrugByAppNo(app_no) {
  const drug = await db('drugs').where({ app_no }).first();
  if (!drug) return null;

  drug.products = await db('products')
    .where({ app_no })
    .orderBy('product_no');

  drug.patents = await db('patents')
    .where({ app_no })
    .orderBy('patent_expiry_date');

  return drug;
}

export async function searchDrugsForFrontend(query) {
  const q = `%${query.toUpperCase()}%`;

  const rows = await baseDrugQuery()
    .whereRaw('UPPER(d.brand_name) LIKE ?', [q])
    .orWhereRaw('UPPER(d.generic_name) LIKE ?', [q]);

  return rows.map(toCard);
}

export async function getDrugAlternativesForFrontend(app_no) {
  const drug = await db('drugs').where({ app_no }).first();
  if (!drug) return null;

  const q = `%${drug.generic_name.toUpperCase()}%`;

  const rows = await baseDrugQuery()
    .whereRaw('UPPER(d.generic_name) LIKE ?', [q]);

  return {
    active_ingredient: drug.generic_name,
    alternatives: rows
      .filter(r => r.app_no !== app_no)
      .map(toCard),
  };
}

export async function getExpiringPatents(withinDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  return db('patents as pt')
    .join('drugs as d', 'd.app_no', 'pt.app_no')
    .select(
      'pt.patent_number',
      'pt.patent_expiry_date',
      'd.brand_name',
      'd.generic_name',
      'd.app_no'
    )
    .where('pt.patent_expiry_date', '>=', new Date().toISOString().split('T')[0])
    .where('pt.patent_expiry_date', '<=', cutoffDate.toISOString().split('T')[0])
    .groupBy('pt.patent_number', 'pt.patent_expiry_date', 'd.app_no', 'd.brand_name', 'd.generic_name')
    .orderBy('pt.patent_expiry_date', 'asc');
}

export async function getPatentStatus(app_no) {
  const patents = await db('patents')
    .where({ app_no })
    .orderBy('patent_expiry_date');

  return patents.map(p => {
    const daysUntilExpiry = p.patent_expiry_date
      ? Math.floor((new Date(p.patent_expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...p,
      is_expired: daysUntilExpiry !== null && daysUntilExpiry < 0,
      expiry_label: daysUntilExpiry === null
        ? 'No expiry data'
        : daysUntilExpiry < 0
          ? 'Expired — Generic Available'
          : daysUntilExpiry === 0
            ? 'Expiring Today'
            : `Expires in ${daysUntilExpiry} days`,
    };
  });
}