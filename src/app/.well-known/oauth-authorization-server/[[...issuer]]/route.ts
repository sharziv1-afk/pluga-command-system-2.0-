import { getSupabaseEnv } from '@/lib/supabase/env';

// Compatibility for MCP clients that still look for authorization-server
// metadata on the resource's own origin (the 2025-03 spec). The source of
// truth stays Supabase: this only relays its RFC 8414 document unchanged.
export async function GET() {
  const { supabaseUrl } = getSupabaseEnv();
  const upstream = await fetch(`${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
    },
  });
}
