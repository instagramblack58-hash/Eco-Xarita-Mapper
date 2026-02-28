-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  description text NOT NULL,
  photo_url text,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  confirmations_count integer DEFAULT 0
);

-- 2. Recycling points table
CREATE TABLE IF NOT EXISTS recycling_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  type text NOT NULL CHECK (type IN ('paper', 'plastic', 'mixed')),
  name text NOT NULL,
  address text NOT NULL
);

-- 3. Function to confirm a report (increment count)
CREATE OR REPLACE FUNCTION confirm_report(report_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE reports
  SET confirmations_count = confirmations_count + 1
  WHERE id = report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_points ENABLE ROW LEVEL SECURITY;

-- Reports: anyone can read, authenticated users can insert
CREATE POLICY "Anyone can view reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Auth users can insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Recycling points: anyone can read
CREATE POLICY "Anyone can view recycling points" ON recycling_points FOR SELECT USING (true);

-- 5. Storage bucket for photos (run separately if needed)
-- In Supabase Dashboard → Storage → New bucket → Name: "report-photos" → Public: ON

-- 6. Seed some recycling points in Tashkent
INSERT INTO recycling_points (lat, lng, type, name, address) VALUES
  (41.2990, 69.2401, 'mixed', 'Chilonzor Qayta Ishlash Markazi', 'Chilonzor tumani, A. Temur ko''chasi 15'),
  (41.3110, 69.2800, 'paper', 'Qog''oz Qabul Punkti', 'Yunusobod tumani, Amir Temur shoh yo''li 108'),
  (41.2850, 69.2350, 'plastic', 'Plastik Qayta Ishlash', 'Mirzo Ulugbek tumani, Farabi ko''chasi 22'),
  (41.3200, 69.2600, 'mixed', 'Eco Point Toshkent', 'Shayxontohur tumani, Navoiy ko''chasi 5'),
  (41.2750, 69.2700, 'paper', 'Mukarram Qog''oz Markazi', 'Sergeli tumani, Ko''yluk bozori yonida'),
  (41.3050, 69.2200, 'plastic', 'GreenPoint Plastik', 'Uchtepa tumani, Bunyodkor ko''chasi 44')
ON CONFLICT DO NOTHING;
