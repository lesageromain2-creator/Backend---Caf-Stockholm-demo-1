-- ============================================
-- TABLE: settings
-- Paramètres clé-valeur du site (config générale)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);

-- Fonction updated_at (si pas déjà créée par 000_complete_schema.sql)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Données par défaut (optionnel)
INSERT INTO settings (setting_key, setting_value) VALUES
  ('site_name', 'Ma Boutique'),
  ('site_description', 'Boutique en ligne'),
  ('contact_email', 'contact@example.com'),
  ('contact_phone', ''),
  ('maintenance_mode', 'false'),
  ('currency', 'EUR'),
  ('free_shipping_threshold', '50'),
  ('tax_rate', '20')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE settings IS 'Paramètres globaux du site (clé-valeur)';
