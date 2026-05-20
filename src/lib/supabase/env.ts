const SUPABASE_URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_ANON_KEY_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

export interface SupabaseEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];

  if (!supabaseUrl) missing.push(SUPABASE_URL_KEY);
  if (!supabaseAnonKey) missing.push(SUPABASE_ANON_KEY_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}
