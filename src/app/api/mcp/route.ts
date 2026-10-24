import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp/context';
import { registerReadTools } from '@/lib/mcp/tools';

// Remote MCP endpoint for AI clients (Claude, ChatGPT). Read-only in this
// phase. Authentication is Supabase OAuth 2.1: the client sends the user's
// access token, and every query runs under that user's RLS.
const handler = createMcpHandler(
  (server) => {
    registerReadTools(server);
  },
  {
    serverInfo: { name: 'hamefaked', version: '1.0.0' },
    instructions:
      'מערכת "המפקד" — מערכת פיקוד פלוגתית בעברית. כל הכלים לקריאה בלבד ופועלים בהרשאות המשתמש המחובר. ' +
      'Start with get_daily_brief for a situation summary, or whoami to learn the viewer\'s scope. ' +
      'Dates are Asia/Jerusalem. Answer the user in Hebrew unless asked otherwise.',
  },
);

const authed = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST, authed as DELETE };
