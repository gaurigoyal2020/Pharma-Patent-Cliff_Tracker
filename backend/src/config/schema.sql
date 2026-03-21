CREATE TABLE IF NOT EXISTS drugs (
  id          SERIAL PRIMARY KEY,
  app_no      TEXT    NOT NULL UNIQUE,
  brand_name  TEXT    NOT NULL,
  generic_name TEXT   NOT NULL,
  app_type    TEXT    NOT NULL DEFAULT 'N'
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  drug_id       INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  app_no        TEXT    NOT NULL,
  product_no    TEXT    NOT NULL,
  strength      TEXT,
  route         TEXT,
  approval_date TEXT,
  UNIQUE(app_no, product_no)
);

CREATE TABLE IF NOT EXISTS patents (
  id                 SERIAL PRIMARY KEY,
  drug_id            INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  app_no             TEXT    NOT NULL,
  product_no         TEXT    NOT NULL,
  patent_number      TEXT    NOT NULL,
  patent_expiry_date TEXT,
  days_until_expiry  INTEGER,
  UNIQUE(app_no, product_no, patent_number)
);

CREATE INDEX IF NOT EXISTS idx_drugs_brand      ON drugs(brand_name);
CREATE INDEX IF NOT EXISTS idx_drugs_generic    ON drugs(generic_name);
CREATE INDEX IF NOT EXISTS idx_products_drug_id ON products(drug_id);
CREATE INDEX IF NOT EXISTS idx_patents_drug_id  ON patents(drug_id);
CREATE INDEX IF NOT EXISTS idx_patents_expiry   ON patents(patent_expiry_date);
CREATE INDEX IF NOT EXISTS idx_patents_days     ON patents(days_until_expiry);