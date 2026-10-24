import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'supabase/functions/send-email/index.ts'),
  'utf8'
);

test('the authentication email hook cannot ship embedded credentials or a test-only sender', () => {
  assert.doesNotMatch(source, /re_[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(source, /whsec_[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(source, /onboarding@resend\.dev/);
  assert.match(source, /Deno\.env\.get\("RESEND_API_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("SEND_EMAIL_HOOK_SECRET"\)/);
  assert.match(source, /Deno\.env\.get\("SEND_EMAIL_FROM"\)/);
});
