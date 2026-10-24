import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';

// RFC 9728 Protected Resource Metadata. Tells MCP clients that /api/mcp is
// protected by Supabase Auth's OAuth 2.1 server. The optional catch-all
// serves both /.well-known/oauth-protected-resource and the path-suffixed
// form /.well-known/oauth-protected-resource/api/mcp that newer clients probe.
function handler(req: Request) {
  const { supabaseUrl } = getSupabaseEnv();
  const origin = new URL(req.url).origin;
  return protectedResourceHandler({
    authServerUrls: [`${supabaseUrl}/auth/v1`],
    resourceUrl: `${origin}/api/mcp`,
  })(req);
}

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
