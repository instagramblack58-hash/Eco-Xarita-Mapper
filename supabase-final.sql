-- =============================================
-- ECO-XARITA FINAL DATABASE SETUP
-- Run in: Supabase Dashboard → SQL Editor → New query
-- =============================================

-- 1. Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  description text NOT NULL DEFAULT '',
  photo_url text,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  confirmations_count integer DEFAULT 0,
  issue_type text DEFAULT 'other'
    CHECK (issue_type IN ('illegal_dumping', 'tree_cutting', 'water_pollution', 'air_pollution', 'other')),
  verification_count integer DEFAULT 0,
  last_verified_at timestamptz
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'other'
  CHECK (issue_type IN ('illegal_dumping', 'tree_cutting', 'water_pollution', 'air_pollution', 'other'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification_count integer DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- 2. Recycling points table
CREATE TABLE IF NOT EXISTS recycling_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  type text NOT NULL CHECK (type IN ('paper', 'plastic', 'mixed', 'glass', 'hazardous')),
  name text NOT NULL,
  address text NOT NULL,
  is_verified boolean DEFAULT false,
  source text,
  last_verified_at timestamptz,
  verification_count integer DEFAULT 0
);

ALTER TABLE recycling_points ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE recycling_points ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE recycling_points ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE recycling_points ADD COLUMN IF NOT EXISTS verification_count integer DEFAULT 0;

-- 3. Waste bins table
CREATE TABLE IF NOT EXISTS waste_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  bin_type text NOT NULL CHECK (bin_type IN ('plastic', 'paper', 'glass', 'general')),
  name text NOT NULL,
  address text NOT NULL,
  verification_count integer DEFAULT 0,
  last_verified_at timestamptz
);

ALTER TABLE waste_bins ADD COLUMN IF NOT EXISTS verification_count integer DEFAULT 0;
ALTER TABLE waste_bins ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- 4. Reverse Vending Machines table (plastic bottle return machines)
CREATE TABLE IF NOT EXISTS reverse_vending_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  operator text,
  reward_type text CHECK (reward_type IN ('cheque', 'bonus', 'discount', 'money')),
  reward_description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  working_hours text,
  phone text,
  photo_url text,
  verification_count integer DEFAULT 0,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. User profiles (eco-score, level, leaderboard)
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  eco_score integer DEFAULT 0,
  level integer DEFAULT 1,
  avatar_url text,
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- 6. Saved locations (bookmarks)
CREATE TABLE IF NOT EXISTS saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  point_type text NOT NULL CHECK (point_type IN ('recycling', 'waste_bin', 'report')),
  point_id uuid NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 7. Report comments
CREATE TABLE IF NOT EXISTS report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  author_name text,
  created_at timestamptz DEFAULT now()
);

-- 8. Report confirmations (to prevent duplicate confirmations)
CREATE TABLE IF NOT EXISTS report_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, user_id)
);

-- 9. Verification audit log
CREATE TABLE IF NOT EXISTS verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  point_type text NOT NULL CHECK (point_type IN ('report', 'recycling_point', 'waste_bin', 'reverse_vending_machine')),
  point_id uuid NOT NULL,
  verified_at timestamptz DEFAULT now()
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Confirm a report (upsert-safe, increments count once per user)
CREATE OR REPLACE FUNCTION confirm_report(report_id uuid, confirming_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO report_confirmations (report_id, user_id)
  VALUES (report_id, confirming_user_id)
  ON CONFLICT (report_id, user_id) DO NOTHING;

  UPDATE reports
  SET confirmations_count = (
    SELECT COUNT(*) FROM report_confirmations WHERE report_confirmations.report_id = $1
  )
  WHERE id = report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment eco-score for a user
CREATE OR REPLACE FUNCTION increment_eco_score(user_id uuid, points integer)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (user_id, eco_score, level)
  VALUES (user_id, points, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    eco_score = profiles.eco_score + EXCLUDED.eco_score,
    level = CASE
      WHEN profiles.eco_score + EXCLUDED.eco_score >= 5000 THEN 5
      WHEN profiles.eco_score + EXCLUDED.eco_score >= 1000 THEN 4
      WHEN profiles.eco_score + EXCLUDED.eco_score >= 500  THEN 3
      WHEN profiles.eco_score + EXCLUDED.eco_score >= 100  THEN 2
      ELSE 1
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify a point (report, recycling_point, waste_bin, reverse_vending_machine)
CREATE OR REPLACE FUNCTION verify_point(
  p_point_type text,
  p_point_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Log the verification
  INSERT INTO verification_audit (user_id, point_type, point_id)
  VALUES (p_user_id, p_point_type, p_point_id);

  -- Update the appropriate table
  IF p_point_type = 'report' THEN
    UPDATE reports
    SET verification_count = COALESCE(verification_count, 0) + 1,
        last_verified_at = now()
    WHERE id = p_point_id;
  ELSIF p_point_type = 'recycling_point' THEN
    UPDATE recycling_points
    SET verification_count = COALESCE(verification_count, 0) + 1,
        last_verified_at = now()
    WHERE id = p_point_id;
  ELSIF p_point_type = 'waste_bin' THEN
    UPDATE waste_bins
    SET verification_count = COALESCE(verification_count, 0) + 1,
        last_verified_at = now()
    WHERE id = p_point_id;
  ELSIF p_point_type = 'reverse_vending_machine' THEN
    UPDATE reverse_vending_machines
    SET verification_count = COALESCE(verification_count, 0) + 1,
        last_verified_at = now()
    WHERE id = p_point_id;
  END IF;

  -- Award eco-score to the verifying user (5 points per verification)
  PERFORM increment_eco_score(p_user_id, 5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (user_id, eco_score, level)
  VALUES (NEW.id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_vending_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_audit ENABLE ROW LEVEL SECURITY;

-- Reports
DROP POLICY IF EXISTS "Anyone can view reports" ON reports;
CREATE POLICY "Anyone can view reports" ON reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can insert reports" ON reports;
CREATE POLICY "Auth users can insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reports" ON reports;
CREATE POLICY "Users can update own reports" ON reports FOR UPDATE USING (auth.uid() = user_id);

-- Recycling points
DROP POLICY IF EXISTS "Anyone can view recycling points" ON recycling_points;
CREATE POLICY "Anyone can view recycling points" ON recycling_points FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can insert recycling points" ON recycling_points;
CREATE POLICY "Auth users can insert recycling points" ON recycling_points FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Waste bins
DROP POLICY IF EXISTS "Anyone can view waste bins" ON waste_bins;
CREATE POLICY "Anyone can view waste bins" ON waste_bins FOR SELECT USING (true);

-- Reverse vending machines
DROP POLICY IF EXISTS "Anyone can view machines" ON reverse_vending_machines;
CREATE POLICY "Anyone can view machines" ON reverse_vending_machines FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can insert machines" ON reverse_vending_machines;
CREATE POLICY "Auth users can insert machines" ON reverse_vending_machines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Auth users can update machines" ON reverse_vending_machines;
CREATE POLICY "Auth users can update machines" ON reverse_vending_machines FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = user_id);

-- Saved locations
DROP POLICY IF EXISTS "Users manage own saved locations" ON saved_locations;
CREATE POLICY "Users manage own saved locations" ON saved_locations FOR ALL USING (auth.uid() = user_id);

-- Confirmations
DROP POLICY IF EXISTS "Anyone can view confirmations" ON report_confirmations;
CREATE POLICY "Anyone can view confirmations" ON report_confirmations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can insert confirmations" ON report_confirmations;
CREATE POLICY "Auth users can insert confirmations" ON report_confirmations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comments
DROP POLICY IF EXISTS "Anyone can view comments" ON report_comments;
CREATE POLICY "Anyone can view comments" ON report_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can insert comments" ON report_comments;
CREATE POLICY "Auth users can insert comments" ON report_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments" ON report_comments;
CREATE POLICY "Users can delete own comments" ON report_comments FOR DELETE USING (auth.uid() = user_id);

-- Verification audit
DROP POLICY IF EXISTS "Users can view own verifications" ON verification_audit;
CREATE POLICY "Users can view own verifications" ON verification_audit FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Auth users can insert verifications" ON verification_audit;
CREATE POLICY "Auth users can insert verifications" ON verification_audit FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- SEED DATA — Recycling Points (Uzbekistan)
-- =============================================

INSERT INTO recycling_points (lat, lng, type, name, address) VALUES
  (41.2990, 69.2401, 'mixed',     'Chilonzor Qayta Ishlash Markazi',   'Chilonzor tumani, A. Temur ko''chasi 15'),
  (41.3110, 69.2800, 'paper',     'Qog''oz Qabul Punkti',              'Yunusobod tumani, Amir Temur shoh yo''li 108'),
  (41.2850, 69.2350, 'plastic',   'Plastik Qayta Ishlash',             'Mirzo Ulugbek tumani, Farabi ko''chasi 22'),
  (41.3200, 69.2600, 'mixed',     'Eco Point Toshkent',                'Shayxontohur tumani, Navoiy ko''chasi 5'),
  (41.2750, 69.2700, 'paper',     'Mukarram Qog''oz Markazi',          'Sergeli tumani, Ko''yluk bozori yonida'),
  (41.3050, 69.2200, 'plastic',   'GreenPoint Plastik',                'Uchtepa tumani, Bunyodkor ko''chasi 44'),
  (41.3300, 69.2450, 'glass',     'Shisha Qabul Markazi',              'Yakkasaroy tumani, Mustaqillik maydoni 3'),
  (41.2650, 69.2550, 'glass',     'Eco Glass Toshkent',                'Bektemir tumani, Sanoat ko''chasi 7'),
  (41.3150, 69.2050, 'hazardous', 'Zararli Chiqindilar Markazi',       'Olmazor tumani, Qo''yliq ko''chasi 18'),
  (41.2900, 69.3100, 'hazardous', 'Batareya va Elektronika Qabul',     'Yangihayot tumani, Furqat ko''chasi 12'),
  (39.6542, 66.9597, 'mixed',     'Samarqand Eco Markaz',              'Samarqand sh., Registon ko''chasi 25'),
  (39.6700, 66.9750, 'paper',     'Qog''oz Qabul Samarqand',          'Samarqand sh., Temuriylar ko''chasi 8'),
  (39.6400, 66.9400, 'plastic',   'Plastik Samarqand',                 'Samarqand sh., Bog''ishamol ko''chasi 14'),
  (39.6600, 66.9200, 'glass',     'Shisha Samarqand',                  'Samarqand sh., Yangi shahar ko''chasi 31'),
  (39.7747, 64.4286, 'mixed',     'Buxoro Qayta Ishlash',              'Buxoro sh., Karvon bozori yonida'),
  (39.7900, 64.4100, 'paper',     'Buxoro Qog''oz Markazi',            'Buxoro sh., Mustaqillik ko''chasi 5'),
  (39.7600, 64.4500, 'hazardous', 'Zararli Chiqindi Buxoro',           'Buxoro sh., Sanoat zonasi'),
  (41.0011, 71.6726, 'mixed',     'Namangan Eco Punkt',                'Namangan sh., Chorsu bozori yonida'),
  (41.0200, 71.6900, 'plastic',   'Plastik Namangan',                  'Namangan sh., Yangi ko''cha 22'),
  (40.9800, 71.6500, 'paper',     'Qog''oz Namangan',                  'Namangan sh., Do''stlik ko''chasi 15'),
  (40.7829, 72.3442, 'mixed',     'Andijon Qayta Ishlash',             'Andijon sh., Asaka ko''chasi 10'),
  (40.7700, 72.3600, 'plastic',   'EcoPlastic Andijon',                'Andijon sh., Navruz ko''chasi 7'),
  (40.3864, 71.7864, 'mixed',     'Farg''ona Eco Markaz',             'Farg''ona sh., Markaziy ko''cha 34'),
  (40.4000, 71.8000, 'glass',     'Shisha Farg''ona',                 'Farg''ona sh., Sanoat ko''chasi 2'),
  (42.4603, 59.6166, 'mixed',     'Nukus Qayta Ishlash',              'Nukus sh., Dostlik ko''chasi 18'),
  (42.4800, 59.6000, 'hazardous', 'Zararli Chiqindi Nukus',           'Nukus sh., Sanoat zonasi 5'),
  (37.2342, 67.2783, 'mixed',     'Termiz Eco Punkt',                 'Termiz sh., Al-Hakim at-Termiziy ko''chasi 3'),
  (38.8569, 65.7906, 'mixed',     'Qarshi Qayta Ishlash',             'Qarshi sh., Markaziy ko''cha 11'),
  (38.8400, 65.8100, 'plastic',   'EcoPlastic Qarshi',                'Qarshi sh., Yangi ko''cha 16'),
  (40.1158, 67.8422, 'mixed',     'Jizzax Eco Punkt',                 'Jizzax sh., Sharq ko''chasi 8'),
  (40.1000, 67.8600, 'paper',     'Qog''oz Jizzax',                   'Jizzax sh., Mustaqillik ko''chasi 3'),
  (40.4897, 68.7737, 'mixed',     'Guliston Qayta Ishlash',           'Guliston sh., Navoiy ko''chasi 12'),
  (40.1028, 65.3791, 'mixed',     'Navoiy Eco Markaz',                'Navoiy sh., Temur ko''chasi 20'),
  (40.0900, 65.3600, 'plastic',   'Plastik Navoiy',                   'Navoiy sh., Sanoat ko''chasi 5'),
  (41.5503, 60.6337, 'mixed',     'Urganch Eco Punkt',                'Urganch sh., Al-Xorazmiy ko''chasi 7'),
  (41.5700, 60.6500, 'glass',     'Shisha Urganch',                   'Urganch sh., Markaziy ko''cha 14')
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED DATA — Waste Bins
-- =============================================

INSERT INTO waste_bins (lat, lng, bin_type, name, address) VALUES
  (41.2995, 69.2401, 'general', 'Amir Temur Ko''chasi Axlat Qutisi',  'Amir Temur ko''chasi, Toshkent'),
  (41.3110, 69.2710, 'plastic', 'Yunusobod Plastik Qutisi',           'Yunusobod, 7-mavze'),
  (41.2850, 69.2450, 'paper',   'Mirzo Ulugbek Qog''oz Qutisi',       'Mirzo Ulugbek tumani'),
  (41.3050, 69.2580, 'glass',   'Navoiy Ko''chasi Shisha Qutisi',     'Navoiy ko''chasi 12'),
  (41.2900, 69.2700, 'general', 'Chorsu Bozori Axlat Qutisi',         'Chorsu bozori yaqinida'),
  (41.3200, 69.2400, 'plastic', 'Mustaqillik Maydoni Qutisi',         'Mustaqillik maydoni, Toshkent'),
  (41.2960, 69.2800, 'paper',   'Tinchlik Yo''li Qog''oz Qutisi',    'Tinchlik yo''li, Toshkent'),
  (41.3080, 69.2300, 'general', 'Olmazor Axlat Qutisi',               'Olmazor tumani, 3-ko''cha'),
  (39.6542, 66.9597, 'general', 'Registon Axlat Qutisi',              'Registon maydoni, Samarqand'),
  (39.6700, 66.9750, 'plastic', 'Samarqand Plastik Qutisi',           'Temuriylar ko''chasi, Samarqand'),
  (39.7747, 64.4286, 'general', 'Buxoro Ark Axlat Qutisi',            'Ark qal''asi yonida, Buxoro'),
  (41.0011, 71.6726, 'general', 'Namangan Chorsu Qutisi',             'Chorsu bozori yonida, Namangan'),
  (40.7829, 72.3442, 'plastic', 'Andijon Markaziy Qutisi',            'Markaziy ko''cha, Andijon'),
  (40.3864, 71.7864, 'general', 'Farg''ona Markaziy Qutisi',         'Markaziy ko''cha, Farg''ona'),
  (42.4603, 59.6166, 'general', 'Nukus Dostlik Ko''chasi Qutisi',    'Dostlik ko''chasi, Nukus')
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED DATA — Reverse Vending Machines
-- =============================================

INSERT INTO reverse_vending_machines (lat, lng, name, address, operator, reward_type, reward_description, status, working_hours, phone) VALUES
  (41.2985, 69.2392, 'EcoBot #1 — Amir Temur',
   'Amir Temur ko''chasi 1, Toshkent',
   'EcoTech Uzbekistan',
   'money',
   'Har bir idish uchun 200 so''m',
   'active',
   '08:00 – 22:00',
   '+998712345678'),
  (41.3115, 69.2690, 'EcoBot #2 — Yunusobod',
   'Yunusobod tumani, 7-mavze 12, Toshkent',
   'EcoTech Uzbekistan',
   'bonus',
   'Har bir idish uchun 50 bonus ball',
   'active',
   '09:00 – 21:00',
   '+998712345678'),
  (41.2870, 69.2340, 'SmartVend — Mirzo Ulugbek',
   'Farabi ko''chasi 5, Mirzo Ulugbek tumani',
   'GreenVend LLC',
   'cheque',
   'Har 10 idishdan 1 ta chek — do''konda chegirma',
   'active',
   '08:00 – 20:00',
   '+998717654321'),
  (39.6550, 66.9580, 'EcoBot — Samarqand Registon',
   'Registon ko''chasi 3, Samarqand',
   'EcoTech Uzbekistan',
   'money',
   'Har bir idish uchun 150 so''m',
   'active',
   '09:00 – 21:00',
   NULL),
  (41.0020, 71.6740, 'EcoBot — Namangan',
   'Chorsu ko''chasi 8, Namangan',
   'GreenVend LLC',
   'discount',
   'Har 20 idishdan 5% chegirma kupon',
   'active',
   '10:00 – 20:00',
   NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- ECO-SHOP: shop_items table
-- =============================================

CREATE TABLE IF NOT EXISTS shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_uz text NOT NULL,
  description_uz text NOT NULL DEFAULT '',
  price_balls integer NOT NULL CHECK (price_balls > 0),
  category text NOT NULL CHECK (category IN ('transport', 'oziq-ovqat', 'korik', 'mahsulot')),
  emoji text NOT NULL DEFAULT '🎁',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_items_read" ON shop_items;
CREATE POLICY "shop_items_read" ON shop_items FOR SELECT USING (true);

-- =============================================
-- ECO-SHOP: purchases table
-- =============================================

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES shop_items(id),
  balls_spent integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchases_own_read" ON purchases;
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
CREATE POLICY "purchases_own_read" ON purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchases_insert" ON purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- ECO-SHOP: purchase_item RPC
-- =============================================

CREATE OR REPLACE FUNCTION purchase_item(p_item_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_price integer;
  v_balance integer;
  v_item_name text;
BEGIN
  SELECT price_balls, name_uz INTO v_price, v_item_name
  FROM shop_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mahsulot topilmadi');
  END IF;

  SELECT eco_score INTO v_balance
  FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil topilmadi');
  END IF;

  IF v_balance < v_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Balansingiz yetarli emas');
  END IF;

  UPDATE profiles SET eco_score = eco_score - v_price WHERE user_id = p_user_id;
  INSERT INTO purchases (user_id, item_id, balls_spent) VALUES (p_user_id, p_item_id, v_price);

  RETURN jsonb_build_object('success', true, 'item_name', v_item_name, 'balls_spent', v_price);
END;
$$;

-- =============================================
-- ECO-SHOP: Seed data
-- =============================================

INSERT INTO shop_items (name_uz, description_uz, price_balls, category, emoji) VALUES
  ('Metro bilet',           'Toshkent metro tarmog''ida bir marta foydalanish',            150, 'transport',  '🚇'),
  ('Avtobus bilet (10 ta)', '10 ta avtobus safari uchun to''ldirish',                      100, 'transport',  '🚌'),
  ('Tramvay bilet (5 ta)',  'Toshkent tramvay yo''nalishi uchun 5 ta bilet',                60, 'transport',  '🚋'),
  ('Eko-sumka',             'Qayta ishlangan materialdan yasalgan ulkan xarid sumkasi',    120, 'mahsulot',   '🛍️'),
  ('Daraxt ko''chati',      'Shahar ko''kalamzorlashtirish uchun yosh daraxt',              80, 'mahsulot',   '🌱'),
  ('Eko-daftar',            'Qayta ishlangan qog''ozdan yasalgan 96 varaqli daftar',        50, 'mahsulot',   '📓'),
  ('Bambuk qoshiq to''plami','Bir martalik plastikni almashtiruvchi bambuk to''plam',       45, 'mahsulot',   '🥢'),
  ('Toshkent Botanical bog''i', 'Botanika bog''iga kirish chiptasi (1 kishi)',             90,  'korik',      '🌳'),
  ('Toshkent Zoo kirish',   'Hayvonot bog''iga kirish chiptasi (1 kishi)',                 200, 'korik',      '🦁'),
  ('Tarix muzeyi kirish',   'O''zbekiston tarixi davlat muzeyi kirish chiptasi',            80, 'korik',      '🏛️'),
  ('Alisher Navoiy teatri', 'Milliy opera va balet teatri kirish chiptasi',                300, 'korik',      '🎭'),
  ('Mineral suv (1 L)',     'Sog''lom ichimlik suvi — tabiatga zarar keltirmaydigan',       30, 'oziq-ovqat', '💧'),
  ('Yashil choy',           'Mahalliy o''stirilgan yashil choy (50 g)',                     40, 'oziq-ovqat', '🍵'),
  ('Organik meva to''plami','Mavsumiy mahalliy organik mevalar to''plami (1 kg)',           70, 'oziq-ovqat', '🍎')
ON CONFLICT DO NOTHING;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for reports in Supabase Dashboard:
-- Database → Replication → supabase_realtime publication → Add table: reports
-- =============================================
