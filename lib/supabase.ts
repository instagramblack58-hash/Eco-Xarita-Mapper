import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ===== Types =====

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

export type WasteBinType = "plastic" | "paper" | "glass" | "general";

export type WasteBin = {
  id: string;
  lat: number;
  lng: number;
  bin_type: WasteBinType;
  name: string;
  address: string;
};

export type Profile = {
  user_id: string;
  eco_score: number;
  level: number;
  avatar_url: string | null;
  full_name: string | null;
  created_at: string;
};

export type SavedLocation = {
  id: string;
  user_id: string;
  point_type: "recycling" | "waste_bin" | "report";
  point_id: string;
  note: string | null;
  created_at: string;
};

// ===== Helpers =====

export async function incrementEcoScore(userId: string, points: number) {
  return supabase.rpc("increment_eco_score", { user_id: userId, points });
}

export async function confirmReport(reportId: string, confirmingUserId: string) {
  return supabase.rpc("confirm_report", { report_id: reportId, confirming_user_id: confirmingUserId });
}