import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

/**
 * Everything an MCP tool needs, built from the caller's own bearer token.
 *
 * There is deliberately no service-role key here: every query goes to
 * PostgREST with the user's JWT, so RLS decides what comes back — a מ"מ gets
 * their platoon, the מ"פ gets the company, exactly as on the site.
 */
export interface McpProfile {
  id: string;
  name: string;
  role: string;
  unit_id: string | null;
  unit_name: string | null;
  permission_level: number;
}

export interface McpCaller {
  supabase: SupabaseClient;
  profile: McpProfile;
}

function supabaseForToken(token: string): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * withMcpAuth verifier. Returns undefined (→ 401 with a WWW-Authenticate
 * challenge) unless the token is valid AND belongs to an active, approved,
 * linked profile — the same gate current_app_user_id() applies in the DB.
 */
export async function verifyMcpToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const supabase = supabaseForToken(bearerToken);
  // getUser asks Supabase Auth to validate the token (signature, expiry,
  // revocation), so a forged or stale JWT never reaches a table query.
  const { data: userData, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userData.user) return undefined;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,name,role,unit_id,permission_level,status,role_approval_status')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileError || !profile) return undefined;
  if (profile.status !== 'active' || profile.role_approval_status !== 'approved') return undefined;

  let unitName: string | null = null;
  if (profile.unit_id) {
    const { data: unit } = await supabase.from('units').select('name').eq('id', profile.unit_id).maybeSingle();
    unitName = unit?.name ?? null;
  }

  const claims = decodeClaims(bearerToken);
  const scope = typeof claims.scope === 'string' ? claims.scope : '';
  const mcpProfile: McpProfile = {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    unit_id: profile.unit_id,
    unit_name: unitName,
    permission_level: profile.permission_level,
  };

  return {
    token: bearerToken,
    clientId: typeof claims.client_id === 'string' ? claims.client_id : 'supabase-session',
    scopes: scope ? scope.split(' ') : [],
    expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
    extra: { profile: mcpProfile },
  };
}

/** Rebuilds the RLS-scoped client inside a tool call from the verified AuthInfo. */
export function callerFrom(authInfo: AuthInfo | undefined): McpCaller {
  const profile = authInfo?.extra?.profile as McpProfile | undefined;
  if (!authInfo?.token || !profile) {
    throw new Error('Not authenticated.');
  }
  return { supabase: supabaseForToken(authInfo.token), profile };
}
