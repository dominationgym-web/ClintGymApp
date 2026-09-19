// Hand-written mirror of supabase/migrations/0001_init.sql.
// If the schema drifts from this, regenerate with:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type AccessStatus = "active" | "expiring_soon" | "expired";
export type PlanType = "intro_1mo" | "sub_6mo" | "sub_12mo";
export type PackageType = "training_only" | "training_nutrition" | "training_nutrition_lifestyle";
export type HighGiTiming = "before_training" | "before_bed" | "other";
export type ClientStatusFlag = "green" | "orange" | "red";

export type Trainer = {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export type Client = {
  id: string;
  trainer_id: string;
  name: string;
  email: string;
  phone: string | null;
  goals: string | null;
  injuries: string | null;
  trainer_notes: string | null;
  intake_responses: Record<string, string>;
  access_status: AccessStatus;
  plan_type: PlanType | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  package_type: PackageType | null;
  consent_accepted_at: string | null;
  privacy_policy_version: string | null;
  status_flag: ClientStatusFlag;
  status_flag_note: string | null;
  status_flag_updated_at: string | null;
  created_at: string;
}

export type Checkin = {
  id: string;
  client_id: string;
  checkin_date: string;
  alcohol_units: number;
  sleep_bed_time: string | null;
  sleep_asleep_time: string | null;
  sleep_wake_time: string | null;
  sleep_quality: 1 | 2 | 3 | 4 | 5 | null;
  water_litres: number;
  electrolytes: boolean;
  meals_total: number;
  high_gi_count: number;
  high_gi_timing: HighGiTiming[];
  screen_time_before_bed_minutes: number | null;
  read_non_backlit_device: boolean;
  breathing_or_stretching_done: boolean;
  distress_flag: boolean;
  distress_notes: string | null;
  created_at: string;
}

export type Video = {
  id: string;
  client_id: string;
  checkin_id: string | null;
  storage_provider: "supabase" | "mux" | "cloudflare_stream";
  storage_path: string;
  playback_url: string | null;
  uploaded_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export type Exercise = {
  id: string;
  name: string;
  category: string | null;
  source: "movekit" | "muscle_and_motion" | "own_library";
  external_url: string | null;
  sort_order: number;
}

export interface Database {
  public: {
    Tables: {
      trainers: { Row: Trainer; Insert: Partial<Trainer>; Update: Partial<Trainer>; Relationships: [] };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client>; Relationships: [] };
      checkins: { Row: Checkin; Insert: Partial<Checkin>; Update: Partial<Checkin>; Relationships: [] };
      videos: { Row: Video; Insert: Partial<Video>; Update: Partial<Video>; Relationships: [] };
      exercises: { Row: Exercise; Insert: Partial<Exercise>; Update: Partial<Exercise>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
