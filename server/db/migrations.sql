-- ============================================================
-- OpéraTrack — Migrations PostgreSQL (Supabase)
-- Ville de Denain — Phase 1
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE : operations
-- ============================================================
CREATE TABLE IF NOT EXISTS operations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intitule            VARCHAR(255) NOT NULL,
  type                VARCHAR(50) NOT NULL CHECK (type IN ('construction_neuve', 'rehabilitation', 'amenagement_vrd')),
  statut              VARCHAR(50) NOT NULL CHECK (statut IN ('etudes', 'consultation', 'travaux', 'reception', 'soldee')),
  adresse             VARCHAR(255),
  description         TEXT,
  charged_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  maitre_oeuvre       VARCHAR(255),
  enveloppe_ht        DECIMAL(12,2) NOT NULL,
  mode_financier      VARCHAR(20) NOT NULL CHECK (mode_financier IN ('enveloppe_globale', 'ap_cp')),
  montant_engage      DECIMAL(12,2) DEFAULT 0,
  montant_mandate     DECIMAL(12,2) DEFAULT 0,
  date_debut          DATE,
  date_livraison_prev DATE,
  date_reception      DATE,
  date_fin_gpa        DATE GENERATED ALWAYS AS (date_reception + INTERVAL '365 days') STORED,
  latitude            DECIMAL(10,7),
  longitude           DECIMAL(10,7),
  image_url           VARCHAR(500),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_operations_statut ON operations(statut);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(type);
CREATE INDEX IF NOT EXISTS idx_operations_charged_id ON operations(charged_id);

-- ============================================================
-- TRIGGER : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

-- Politique : admin voit tout
CREATE POLICY "admin_all" ON operations
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Politique : direction voit tout en lecture
CREATE POLICY "direction_read" ON operations
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'direction');

-- Politique : chargé d'opération voit ses opérations
CREATE POLICY "charge_operation_own" ON operations
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'charge_operation'
    AND charged_id = auth.uid()
  );

-- ============================================================
-- STORAGE : bucket pour les images des opérations
-- ============================================================
-- À exécuter dans le dashboard Supabase Storage :
-- Créer un bucket public nommé "operation-images"
-- INSERT INTO storage.buckets (id, name, public) VALUES ('operation-images', 'operation-images', true);
