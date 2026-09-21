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
  lifestyle_reset_started_at: string | null;
  consent_accepted_at: string | null;
  privacy_policy_version: string | null;
  status_flag: ClientStatusFlag;
  status_flag_note: string | null;
  status_flag_updated_at: string | null;
  created_at: string;
}

// Append-only log of every flag change, written by the trigger in 0023. The
// three status_flag* columns on Client stay the current-state cache; this is the
// history that "Mark as resolved" used to erase.
export type ClientStatusFlagEvent = {
  id: string;
  client_id: string;
  flag: ClientStatusFlag;
  note: string | null;
  set_by: string | null;
  set_by_role: "client" | "trainer" | "system";
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

export type SetEffort = "comfortable" | "close_to_failure" | "failure";

export type WorkoutLog = {
  id: string;
  client_id: string;
  exercise_id: string | null;
  exercise_name: string;
  log_date: string;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  effort: SetEffort;
  created_at: string;
}

export type Habit = {
  id: string;
  client_id: string;
  name: string;
  active_days: number[];
  reps_target: number;
  start_date: string;
  end_date: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
}

export type HabitLog = {
  id: string;
  habit_id: string;
  log_date: string;
  reps_completed: number;
  created_at: string;
}

export type LifestyleResetDailyLog = {
  id: string;
  client_id: string;
  log_date: string;
  morning_daylight: boolean;
  breathing: boolean;
  daily_movement: boolean;
  protein_meals: boolean;
  strength_training: boolean;
  aerobic_exercise: boolean;
  consistent_sleep: boolean;
  evening_winddown: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      trainers: { Row: Trainer; Insert: Partial<Trainer>; Update: Partial<Trainer>; Relationships: [] };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client>; Relationships: [] };
      client_status_flag_events: {
        Row: ClientStatusFlagEvent;
        Insert: Partial<ClientStatusFlagEvent>;
        Update: Partial<ClientStatusFlagEvent>;
        Relationships: [];
      };
      checkins: { Row: Checkin; Insert: Partial<Checkin>; Update: Partial<Checkin>; Relationships: [] };
      videos: { Row: Video; Insert: Partial<Video>; Update: Partial<Video>; Relationships: [] };
      exercises: { Row: Exercise; Insert: Partial<Exercise>; Update: Partial<Exercise>; Relationships: [] };
      habits: { Row: Habit; Insert: Partial<Habit>; Update: Partial<Habit>; Relationships: [] };
      habit_logs: { Row: HabitLog; Insert: Partial<HabitLog>; Update: Partial<HabitLog>; Relationships: [] };
      workout_logs: { Row: WorkoutLog; Insert: Partial<WorkoutLog>; Update: Partial<WorkoutLog>; Relationships: [] };
      lifestyle_reset_daily_logs: {
        Row: LifestyleResetDailyLog;
        Insert: Partial<LifestyleResetDailyLog>;
        Update: Partial<LifestyleResetDailyLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      client_monthly_consistency: {
        Args: { p_client_id: string; p_month?: string };
        Returns: { checkin_rate: number; habit_rate: number | null; video_count: number; overall_score: number }[];
      };
    };
  };
}
