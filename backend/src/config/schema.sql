-- ============================================================
-- Patent Cliff Tracker - SQLite Schema
-- Generated from master_dataset.csv
-- Tables: drugs → products → patents (one-to-many relationships)
-- ============================================================

PRAGMA foreign_keys = ON;

-- Table 1: drugs
-- One row per brand-name drug (app_no is the FDA application number)
CREATE TABLE IF NOT EXISTS drugs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  app_no      TEXT    NOT NULL UNIQUE,   -- FDA NDA/BLA application number
  brand_name  TEXT    NOT NULL,
  generic_name TEXT   NOT NULL,
  app_type    TEXT    NOT NULL DEFAULT 'N'  -- N = New Drug Application
);

-- Table 2: products
-- A drug can have multiple products (different strengths / dosage forms)
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id     INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  app_no      TEXT    NOT NULL,           -- denormalized for easy querying
  product_no  TEXT    NOT NULL,
  strength    TEXT,
  route       TEXT,
  approval_date TEXT,
  UNIQUE(app_no, product_no)
);

-- Table 3: patents
-- Each product row in the CSV has one patent; multiple patents per drug/product
CREATE TABLE IF NOT EXISTS patents (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id          INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  app_no           TEXT    NOT NULL,      -- denormalized for easy querying
  product_no       TEXT    NOT NULL,
  patent_number    TEXT    NOT NULL,
  patent_expiry_date TEXT,
  days_until_expiry  INTEGER,
  UNIQUE(app_no, product_no, patent_number)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_drugs_brand      ON drugs(brand_name);
CREATE INDEX IF NOT EXISTS idx_drugs_generic    ON drugs(generic_name);
CREATE INDEX IF NOT EXISTS idx_products_drug_id ON products(drug_id);
CREATE INDEX IF NOT EXISTS idx_patents_drug_id  ON patents(drug_id);
CREATE INDEX IF NOT EXISTS idx_patents_expiry   ON patents(patent_expiry_date);
CREATE INDEX IF NOT EXISTS idx_patents_days     ON patents(days_until_expiry);