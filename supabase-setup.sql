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
  confirmations_count integer DEFAULT 0,
  issue_type text DEFAULT 'other' CHECK (issue_type IN ('illegal_dumping', 'tree_cutting', 'water_pollution', 'air_pollution', 'other'))
);

-- Add issue_type column to existing table if upgrading
ALTER TABLE reports ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'other'
  CHECK (issue_type IN ('illegal_dumping', 'tree_cutting', 'water_pollution', 'air_pollution', 'other'));

-- 2. Recycling points table
CREATE TABLE IF NOT EXISTS recycling_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  type text NOT NULL CHECK (type IN ('paper', 'plastic', 'mixed', 'glass', 'hazardous')),
  name text NOT NULL,
  address text NOT NULL
);

-- Update constraint if upgrading from old schema
ALTER TABLE recycling_points DROP CONSTRAINT IF EXISTS recycling_points_type_check;
ALTER TABLE recycling_points ADD CONSTRAINT recycling_points_type_check
  CHECK (type IN ('paper', 'plastic', 'mixed', 'glass', 'hazardous'));

-- 3. Waste bins table
CREATE TABLE IF NOT EXISTS waste_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  bin_type text NOT NULL CHECK (bin_type IN ('plastic', 'paper', 'glass', 'general')),
  name text NOT NULL,
  address text NOT NULL
);

-- 4. Function to confirm a report (increment count)
CREATE OR REPLACE FUNCTION confirm_report(report_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE reports
  SET confirmations_count = confirmations_count + 1
  WHERE id = report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_bins ENABLE ROW LEVEL SECURITY;

-- Reports: anyone can read, authenticated users can insert
CREATE POLICY IF NOT EXISTS "Anyone can view reports" ON reports FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users can insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Recycling points: anyone can read
CREATE POLICY IF NOT EXISTS "Anyone can view recycling points" ON recycling_points FOR SELECT USING (true);

-- Waste bins: anyone can read
CREATE POLICY IF NOT EXISTS "Anyone can view waste bins" ON waste_bins FOR SELECT USING (true);

-- 6. Storage bucket for photos
-- In Supabase Dashboard → Storage → New bucket → Name: "report-photos" → Public: ON

-- 7. Seed recycling points across Uzbekistan (all types)
INSERT INTO recycling_points (lat, lng, type, name, address) VALUES
  -- Tashkent
  (41.2990, 69.2401, 'mixed', 'Chilonzor Qayta Ishlash Markazi', 'Chilonzor tumani, A. Temur ko''chasi 15'),
  (41.3110, 69.2800, 'paper', 'Qog''oz Qabul Punkti', 'Yunusobod tumani, Amir Temur shoh yo''li 108'),
  (41.2850, 69.2350, 'plastic', 'Plastik Qayta Ishlash', 'Mirzo Ulugbek tumani, Farabi ko''chasi 22'),
  (41.3200, 69.2600, 'mixed', 'Eco Point Toshkent', 'Shayxontohur tumani, Navoiy ko''chasi 5'),
  (41.2750, 69.2700, 'paper', 'Mukarram Qog''oz Markazi', 'Sergeli tumani, Ko''yluk bozori yonida'),
  (41.3050, 69.2200, 'plastic', 'GreenPoint Plastik', 'Uchtepa tumani, Bunyodkor ko''chasi 44'),
  (41.3300, 69.2450, 'glass', 'Shisha Qabul Markazi', 'Yakkasaroy tumani, Mustaqillik maydoni 3'),
  (41.2650, 69.2550, 'glass', 'Eco Glass Toshkent', 'Bektemir tumani, Sanoat ko''chasi 7'),
  (41.3150, 69.2050, 'hazardous', 'Zararli Chiqindilar Markazi', 'Olmazor tumani, Qo''yliq ko''chasi 18'),
  (41.2900, 69.3100, 'hazardous', 'Batareya va Elektronika Qabul', 'Yangihayot tumani, Furqat ko''chasi 12'),
  -- Samarkand
  (39.6542, 66.9597, 'mixed', 'Samarqand Eco Markaz', 'Samarqand sh., Registon ko''chasi 25'),
  (39.6700, 66.9750, 'paper', 'Qog''oz Qabul Samarqand', 'Samarqand sh., Temuriylar ko''chasi 8'),
  (39.6400, 66.9400, 'plastic', 'Plastik Samarqand', 'Samarqand sh., Bog''ishamol ko''chasi 14'),
  (39.6600, 66.9200, 'glass', 'Shisha Samarqand', 'Samarqand sh., Yangi shahar ko''chasi 31'),
  -- Bukhara
  (39.7747, 64.4286, 'mixed', 'Buxoro Qayta Ishlash', 'Buxoro sh., Karvon bozori yonida'),
  (39.7900, 64.4100, 'paper', 'Buxoro Qog''oz Markazi', 'Buxoro sh., Mustaqillik ko''chasi 5'),
  (39.7600, 64.4500, 'hazardous', 'Zararli Chiqindi Buxoro', 'Buxoro sh., Sanoat zonasi'),
  -- Namangan
  (41.0011, 71.6726, 'mixed', 'Namangan Eco Punkt', 'Namangan sh., Chorsu bozori yonida'),
  (41.0200, 71.6900, 'plastic', 'Plastik Namangan', 'Namangan sh., Yangi ko''cha 22'),
  (40.9800, 71.6500, 'paper', 'Qog''oz Namangan', 'Namangan sh., Do''stlik ko''chasi 15'),
  -- Andijan
  (40.7829, 72.3442, 'mixed', 'Andijon Qayta Ishlash', 'Andijon sh., Asaka ko''chasi 10'),
  (40.7700, 72.3600, 'plastic', 'EcoPlastic Andijon', 'Andijon sh., Navruz ko''chasi 7'),
  -- Fergana
  (40.3864, 71.7864, 'mixed', 'Farg''ona Eco Markaz', 'Farg''ona sh., Markaziy ko''cha 34'),
  (40.4000, 71.8000, 'glass', 'Shisha Farg''ona', 'Farg''ona sh., Sanoat ko''chasi 2'),
  -- Nukus
  (42.4603, 59.6166, 'mixed', 'Nukus Qayta Ishlash', 'Nukus sh., Dostlik ko''chasi 18'),
  (42.4800, 59.6000, 'hazardous', 'Zararli Chiqindi Nukus', 'Nukus sh., Sanoat zonasi 5'),
  -- Termez
  (37.2342, 67.2783, 'mixed', 'Termiz Eco Punkt', 'Termiz sh., Al-Hakim at-Termiziy ko''chasi 3'),
  -- Karshi
  (38.8569, 65.7906, 'mixed', 'Qarshi Qayta Ishlash', 'Qarshi sh., Markaziy ko''cha 11'),
  (38.8400, 65.8100, 'plastic', 'EcoPlastic Qarshi', 'Qarshi sh., Yangi ko''cha 16')
ON CONFLICT DO NOTHING;

-- 8. Seed waste bins
INSERT INTO waste_bins (lat, lng, bin_type, name, address) VALUES
  (41.2995, 69.2401, 'general', 'Amir Temur Ko''chasi Chiqindi Qutisi', 'Amir Temur ko''chasi, Toshkent'),
  (41.3110, 69.2710, 'plastic', 'Yunusobod Plastik Quti', 'Yunusobod, 7-mavze'),
  (41.2850, 69.2450, 'paper', 'Mirzo Ulugbek Qog''oz Qutisi', 'Mirzo Ulugbek tumani'),
  (41.3050, 69.2580, 'glass', 'Navoiy Ko''chasi Shisha Qutisi', 'Navoiy ko''chasi 12'),
  (41.2900, 69.2700, 'general', 'Chorsu Bozori Chiqindi Qutisi', 'Chorsu bozori yaqinida'),
  (39.6542, 66.9597, 'general', 'Registon Chiqindi Qutisi', 'Registon maydoni, Samarqand'),
  (39.7747, 64.4286, 'general', 'Buxoro Ark Chiqindi Qutisi', 'Ark qal''asi yonida, Buxoro')
ON CONFLICT DO NOTHING;
