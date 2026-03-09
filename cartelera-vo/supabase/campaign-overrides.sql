-- ============================================================================
-- Campaign Overrides — Admin control for BrickBreaker brand campaigns
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Table: stores date overrides and active/inactive state per campaign
CREATE TABLE IF NOT EXISTS campaign_overrides (
  id TEXT PRIMARY KEY,          -- matches CAMPAIGNS[].id in BrickBreaker.jsx
  active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE campaign_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone can read (game needs to check overrides)
DROP POLICY IF EXISTS "campaign_overrides_select" ON campaign_overrides;
CREATE POLICY "campaign_overrides_select" ON campaign_overrides
  FOR SELECT USING (true);

-- Only authenticated users can insert/update (admin check happens in frontend)
DROP POLICY IF EXISTS "campaign_overrides_insert" ON campaign_overrides;
CREATE POLICY "campaign_overrides_insert" ON campaign_overrides
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "campaign_overrides_update" ON campaign_overrides;
CREATE POLICY "campaign_overrides_update" ON campaign_overrides
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Grant anon access for reading (game uses anon key)
GRANT SELECT ON campaign_overrides TO anon;
GRANT INSERT, UPDATE ON campaign_overrides TO authenticated;

-- Seed with initial campaigns
INSERT INTO campaign_overrides (id, active, start_date, end_date)
VALUES
  ('gofio-lapina', true, '2026-03-10', '2026-04-10'),
  ('clipper', false, '2026-04-11', '2026-05-10')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Done! Verify: SELECT * FROM campaign_overrides;
-- ============================================================================
