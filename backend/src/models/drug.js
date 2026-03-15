import db from '../config/database.js';

export function getAllDrugs() {
  return db.prepare(`
    SELECT
      d.id, d.app_no, d.brand_name, d.generic_name, d.app_type,
      COUNT(DISTINCT p.product_no)    AS product_count,
      COUNT(DISTINCT pt.patent_number) AS patent_count,
      MIN(pt.patent_expiry_date)      AS earliest_expiry,
      MAX(pt.patent_expiry_date)      AS latest_expiry,
      MIN(pt.days_until_expiry)       AS min_days_until_expiry
    FROM drugs d
    LEFT JOIN products p  ON p.app_no = d.app_no
    LEFT JOIN patents  pt ON pt.app_no = d.app_no
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all();
}

export function getDrugByAppNo(app_no) {
  const drug = db.prepare(`SELECT * FROM drugs WHERE app_no = ?`).get(app_no);
  if (!drug) return null;
  drug.products = db.prepare(`SELECT * FROM products WHERE app_no = ? ORDER BY product_no`).all(app_no);
  drug.patents  = db.prepare(`SELECT * FROM patents  WHERE app_no = ? ORDER BY patent_expiry_date`).all(app_no);
  return drug;
}

export function searchDrugs(query) {
  const q = `%${query.toUpperCase()}%`;
  return db.prepare(`
    SELECT
      d.id, d.app_no, d.brand_name, d.generic_name,
      MIN(pt.patent_expiry_date) AS earliest_expiry,
      MAX(pt.days_until_expiry)  AS max_days_until_expiry
    FROM drugs d
    LEFT JOIN patents pt ON pt.app_no = d.app_no
    WHERE UPPER(d.brand_name) LIKE ? OR UPPER(d.generic_name) LIKE ?
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all(q, q);
}

/**
 * Search drugs and return results shaped to match the frontend's expected format.
 * Returns: { id, name, generic_name, dosage_form, strength, patent_expired, patent_expiry? }
 */
export function searchDrugsForFrontend(query) {
  const q = `%${query.toUpperCase()}%`;

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
    WHERE UPPER(d.brand_name) LIKE ? OR UPPER(d.generic_name) LIKE ?
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all(q, q);

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

/**
 * Given an app_no, find other drugs sharing the same generic name (alternatives).
 * Returns the selected drug + its alternatives in frontend shape.
 */
export function getDrugAlternativesForFrontend(app_no) {
  const drug = db.prepare(`SELECT * FROM drugs WHERE app_no = ?`).get(app_no);
  if (!drug) return null;

  const q = `%${drug.generic_name.toUpperCase()}%`;

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
    WHERE UPPER(d.generic_name) LIKE ?
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all(q);

  const toCard = (r) => ({
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
  });

  const alternatives = rows
    .filter(r => r.app_no !== app_no)
    .map(toCard);

  return {
    active_ingredient: drug.generic_name,
    alternatives,
  };
}

const DISEASE_MAP = {
  'Diabetes':        ['JARDIANCE', 'OZEMPIC', 'VICTOZA', 'JANUVIA'],
  'Heart Disease':   ['XARELTO', 'BRILINTA', 'ELIQUIS SPRINKLE', 'ENTRESTO SPRINKLE'],
  'Hypertension':    ['ENTRESTO SPRINKLE'],
  'Anticoagulation': ['XARELTO', 'BRILINTA', 'ELIQUIS SPRINKLE'],
};

export function getDrugsByDisease(disease) {
  const brands = DISEASE_MAP[disease];
  if (!brands) return [];
  const placeholders = brands.map(() => '?').join(',');
  return db.prepare(`
    SELECT
      d.id, d.app_no, d.brand_name, d.generic_name,
      MIN(pt.patent_expiry_date) AS earliest_expiry,
      MAX(pt.patent_expiry_date) AS latest_expiry,
      MIN(pt.days_until_expiry)  AS days_until_expiry
    FROM drugs d
    LEFT JOIN patents pt ON pt.app_no = d.app_no
    WHERE d.brand_name IN (${placeholders})
    GROUP BY d.id
    ORDER BY d.brand_name
  `).all(...brands);
}

export function getExpiringPatents(withinDays = 365) {
  return db.prepare(`
    SELECT
      pt.patent_number, pt.patent_expiry_date, pt.days_until_expiry,
      d.brand_name, d.generic_name, d.app_no
    FROM patents pt
    JOIN drugs d ON d.app_no = pt.app_no
    WHERE pt.days_until_expiry BETWEEN 0 AND ?
    GROUP BY pt.patent_number, d.app_no
    ORDER BY pt.days_until_expiry ASC
  `).all(withinDays);
}

export function getPatentStatus(app_no) {
  const patents = db.prepare(`
    SELECT * FROM patents WHERE app_no = ? ORDER BY patent_expiry_date
  `).all(app_no);

  return patents.map(p => ({
    ...p,
    is_expired: p.days_until_expiry !== null && p.days_until_expiry < 0,
    expiry_label: p.days_until_expiry < 0
      ? 'Expired — Generic Available'
      : p.days_until_expiry === 0
        ? 'Expiring Today'
        : `Expires in ${p.days_until_expiry} days`,
  }));
}