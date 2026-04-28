-- ============================================================
-- OpéraTrack — Migration : table financements
-- ============================================================

CREATE TABLE IF NOT EXISTS financements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id     UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  financeur        TEXT NOT NULL CHECK (financeur IN ('anru','etat','dpv','region','agglo','commune','autre')),
  libelle          TEXT,
  montant_attribue NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant_verse    NUMERIC(15,2) NOT NULL DEFAULT 0,
  date_convention  DATE,
  numero_convention TEXT,
  observations     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financements_operation ON financements(operation_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_financements_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financements_updated_at ON financements;
CREATE TRIGGER trg_financements_updated_at
  BEFORE UPDATE ON financements
  FOR EACH ROW EXECUTE FUNCTION update_financements_updated_at();

-- RLS
ALTER TABLE financements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financements_select" ON financements FOR SELECT USING (true);
CREATE POLICY "financements_insert" ON financements FOR INSERT WITH CHECK (true);
CREATE POLICY "financements_update" ON financements FOR UPDATE USING (true);
CREATE POLICY "financements_delete" ON financements FOR DELETE USING (true);
