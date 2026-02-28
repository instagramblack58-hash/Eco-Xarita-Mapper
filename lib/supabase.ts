import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Report = {
  id: string;
  lat: number;
  lng: number;
  description: string;
  photo_url: string | null;
  user_id: string;
  created_at: string;
  confirmations_count: number;
};

export type RecyclingPoint = {
  id: string;
  lat: number;
  lng: number;
  type: "paper" | "plastic" | "mixed";
  name: string;
  address: string;
};
