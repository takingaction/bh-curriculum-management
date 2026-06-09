-- Create cfu_assets table for Check for Understanding feature
CREATE TABLE IF NOT EXISTS cfu_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('background', 'png')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies - admin only access
ALTER TABLE cfu_assets ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to cfu_assets"
  ON cfu_assets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for CFU assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('cfu-assets', 'cfu-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read access to cfu-assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'cfu-assets');

-- Admin upload access
CREATE POLICY "Admin upload to cfu-assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cfu-assets');

-- Admin delete access
CREATE POLICY "Admin delete from cfu-assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'cfu-assets');