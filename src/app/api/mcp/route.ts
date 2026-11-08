import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp/context';
import { registerReadTools } from '@/lib/mcp/tools';
import { registerWriteTools } from '@/lib/mcp/writes';
import { registerMoreWriteTools } from '@/lib/mcp/writesMore';

// Remote MCP endpoint for AI clients (Claude, ChatGPT): read tools plus a
// small set of write tools (see writes.ts and migration 035). Authentication
// is Supabase OAuth 2.1: the client sends the user's access token, and every
// query runs under that user's RLS.
const handler = createMcpHandler(
  (server) => {
    registerReadTools(server);
    registerWriteTools(server);
    registerMoreWriteTools(server);
  },
  {
    serverInfo: { name: 'hamefaked', version: '1.0.0' },
    instructions:
      'מערכת "המפקד" — מערכת פיקוד פלוגתית בעברית. כל הכלים פועלים בהרשאות המשתמש המחובר. ' +
      'Write tools change real data: before calling one, state exactly what will be written and get the user\'s confirmation. ' +
      'delete_mcp_item only removes items that were created through this connector; delete_event removes any schedule event the user may delete, and update_event / delete_event report each change before and after. ' +
      'Start with get_daily_brief for a situation summary, or whoami to learn the viewer\'s scope. ' +
      'Dates are Asia/Jerusalem. Answer the user in Hebrew unless asked otherwise.',
  },
);

const authed = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST, authed as DELETE };
