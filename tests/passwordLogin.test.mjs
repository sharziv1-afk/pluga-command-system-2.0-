import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/app/(auth)/login/page.tsx', 'utf8');

test('password login authenticates existing users and still requires an app profile', () => {
  assert.match(source, /supabase\.auth\.signInWithPassword\(/);
  assert.doesNotMatch(source, /supabase\.auth\.signUp\(/);
  assert.match(source, /\.eq\('auth_user_id', signInData\.user\.id\)/);
  assert.match(source, /await supabase\.auth\.signOut\(\)/);
  assert.match(source, /החשבון קיים אך עדיין לא שויך לפרופיל פיקודי/);
});

test('password login does not expose raw authentication errors to users', () => {
  assert.match(source, /פרטי ההתחברות אינם נכונים/);
  assert.doesNotMatch(source, /signInError\?\.message/);
  assert.match(source, /autoComplete="current-password"/);
});
