-- 046_mcp_more_writes.sql
--
-- Lets the MCP connector (Claude, ChatGPT) do what the company commander
-- asked for on 08.11.2026 (src/lib/mcp/writesMore.ts). Run manually —
-- SANDBOX first, then LIVE. Idempotent. Needs 035.
--
-- Two of 035's OAuth-only RESTRICTIVE policies are loosened. Nothing changes
-- for the website (these policies only bite when the token has a client_id),
-- and the existing PERMISSIVE policies still decide every write:
--
-- 1. tracking_weeks, tracking_items, soldiers: an OAuth token may INSERT.
--    Still only a tracking commander may (015 / 026 "commander insert").
--    Update and delete from OAuth stay blocked ("oauth: no update",
--    "oauth: no delete" are left as they are).
--
-- 2. events: an OAuth token may DELETE any event, not only one it created.
--    Still only a closed event (completed / cancelled), and only its creator
--    or a commander ("events: delete closed"). The tool cancels an open event
--    first, which notifies its audience, as the site does.
--
-- tasks, requests and mentoring entries keep 035's rule: through MCP, only
-- what MCP created can be deleted.

drop policy if exists "oauth: no insert" on public.tracking_weeks;
drop policy if exists "oauth: no insert" on public.tracking_items;
drop policy if exists "oauth: no insert" on public.soldiers;

drop policy if exists "oauth: delete only mcp-created" on public.events;
