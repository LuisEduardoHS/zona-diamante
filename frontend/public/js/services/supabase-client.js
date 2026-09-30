import { createClient } from "../../vendor/supabase.js";
import { runtimeConfig } from "../app/runtime-config.js";

const {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} = runtimeConfig;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "La configuración pública de Supabase no está disponible."
  );
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);