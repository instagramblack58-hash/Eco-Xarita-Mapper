import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type IssueType =
  | "illegal_dumping"
  | "tree_cutting"
  | "water_pollution"
  | "air_pollution"
  | "other";

export type Report = {
  id: string;
  lat: number;
  lng: number;
  description: string;
  photo_url: string | null;
  user_id: string;
  created_at: string;
  confirmations_count: number;
  issue_type: IssueType | null;
};

export type RecyclingType =
  | "paper"
  | "plastic"
  | "mixed"
  | "glass"
  | "hazardous";

export type RecyclingPoint = {
  id: string;
  lat: number;
  lng: number;
  type: RecyclingType;
  name: string;
  address: string;
};

export type WasteBin = {
  id: string;
  lat: number;
  lng: number;
  bin_type: "plastic" | "paper" | "glass" | "general";
  name: string;
  address: string;
};
