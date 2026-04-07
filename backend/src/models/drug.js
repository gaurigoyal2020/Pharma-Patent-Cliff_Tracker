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

// ─── OCR drug matching ────────────────────────────────────────────────────────

/**
 * Words that appear on almost every medicine label and would produce
 * false-positive DB matches if we queried them naively.
 */
const OCR_STOP_WORDS = new Set([
  'for', 'the', 'and', 'use', 'only', 'oral', 'with', 'each',
  'vial', 'dose', 'once', 'take', 'store', 'keep', 'away', 'from',
  'this', 'that', 'your', 'not', 'per', 'day', 'not', 'see',
  'powder', 'solution', 'injection', 'injectable', 'intravenous',
  'suspension', 'tablet', 'capsule', 'topical', 'sterile',
  'protein', 'bound', 'particles', 'single', 'multiple',
  'corporation', 'pharmaceuticals', 'laboratories', 'pharma',
  'warning', 'caution', 'dosage', 'storage', 'directions',
  'contains', 'inactive', 'ingredients', 'distributed', 'manufactured',
]);

/**
 * Levenshtein distance between two strings.
 * Used as a fuzzy fallback for OCR misreads (e.g. ABR4XANE → ABRAXANE).
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * Given raw OCR text, find the best matching drug in the database.
 *
 * Three-pass strategy (stops at the first pass that finds something):
 *
 *  Pass 1 — Exact LIKE on single tokens (fast, no OCR noise assumed).
 *            Tokens are alpha-only, ≥ 4 chars, not in OCR_STOP_WORDS.
 *            Single tokens are tried before phrases because the drug name
 *            (e.g. "ABRAXANE") is almost always one word, while phrases
 *            like "abraxane paclitaxel" won't exist as a brand_name.
 *
 *  Pass 2 — Exact LIKE on 2-word phrases built from the same tokens.
 *            Catches generic names like "bayer aspirin" or multi-word brands.
 *
 *  Pass 3 — Fuzzy Levenshtein against every distinct brand_name in the DB.
 *            Handles OCR misreads: ABR4XANE, A8RAXANE, ABRAYANE → ABRAXANE.
 *            Threshold: edit distance ≤ 30% of the longer string's length,
 *            but capped so short tokens can't match completely different words.
 *            Only tokens ≥ 5 chars are fuzzied (avoids matching 3-letter noise).
 */
export async function matchDrugFromOCRText(rawText) {
  if (!rawText || !rawText.trim()) return null;

  // Tokenise: keep alpha words only (strips OCR digit-noise like "4", "8"),
  // but also keep alphanumeric tokens separately for fuzzy matching later.
  const rawTokens = rawText
    .toLowerCase()
    .split(/[\s\n\r,.()\[\]\/\\:;!?@#$%^&*+=|<>{}~`"'_\-®™°]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  // Clean tokens: pure alpha, ≥ 4 chars, not a stop word
  const tokens = rawTokens
    .map(t => t.replace(/[^a-z]/g, ''))   // strip embedded digits/symbols
    .filter(t => t.length >= 4 && !OCR_STOP_WORDS.has(t));

  // Fuzzy candidates: original (may contain digits), ≥ 5 chars
  const fuzzyTokens = rawTokens
    .filter(t => t.length >= 5 && !OCR_STOP_WORDS.has(t.replace(/[^a-z]/g, '')));

  // Deduplicate while preserving order
  const dedup = (arr) => [...new Set(arr)];
  const cleanTokens = dedup(tokens);

  // ── Pass 1: exact LIKE on single tokens ───────────────────────────────────
  for (const token of cleanTokens) {
    const hit = await db('drugs')
      .whereRaw('LOWER(brand_name) LIKE ?', [`%${token}%`])
      .orWhereRaw('LOWER(generic_name) LIKE ?', [`%${token}%`])
      .select('brand_name')
      .first();
    if (hit) return hit.brand_name;
  }

  // ── Pass 2: exact LIKE on 2-word phrases ──────────────────────────────────
  const phrases = dedup(
    cleanTokens.slice(0, -1).map((t, i) => `${t} ${cleanTokens[i + 1]}`)
  );
  for (const phrase of phrases) {
    const hit = await db('drugs')
      .whereRaw('LOWER(brand_name) LIKE ?', [`%${phrase}%`])
      .orWhereRaw('LOWER(generic_name) LIKE ?', [`%${phrase}%`])
      .select('brand_name')
      .first();
    if (hit) return hit.brand_name;
  }

  // ── Pass 3: fuzzy Levenshtein against all distinct brand names ─────────────
  // Pull brand names once — this is the only "expensive" query but only
  // runs when passes 1 & 2 both failed (i.e. OCR badly mangled the name).
  if (fuzzyTokens.length > 0) {
    const allNames = await db('drugs')
      .distinct('brand_name')
      .pluck('brand_name');

    for (const token of dedup(fuzzyTokens)) {
      const tokenClean = token.replace(/[^a-z]/g, '');
      let bestName = null;
      let bestRatio = Infinity;

      for (const name of allNames) {
        const nameLower = name.toLowerCase();
        const dist = levenshtein(tokenClean, nameLower);
        const ratio = dist / Math.max(tokenClean.length, nameLower.length);
        // Accept if within 30% edit distance, and the absolute distance ≤ 3
        // (prevents short tokens matching long unrelated names)
        if (ratio < bestRatio && ratio <= 0.3 && dist <= 3) {
          bestRatio = ratio;
          bestName = name;
        }
      }

      if (bestName) return bestName;
    }
  }

  return null;
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