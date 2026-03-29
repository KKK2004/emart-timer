import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_nNY5IsymcDGHZ07qNT-rTw_RryeESpO;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
