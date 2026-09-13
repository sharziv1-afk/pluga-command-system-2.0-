import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// src/lib/supabase/error.ts logs a deliberately sanitized shape —
// message/code/details/hint/status — and its own comment says that is there
// instead of a raw error dump. A `console.error(err)` beside it dumps the
// whole object, which defeats the point of having the helper at all.
//
// The admin page had drifted furthest: it imported logSupabaseError, used it
// once, and left ten raw console.error calls around it — on the one screen
// that handles user approvals. This asserts the boundary rather than the
// count, so the next page to drift fails here instead of at review.
//
// The boundary is not "never console" — login/page.tsx has a legitimate one,
// dev-gated, deliberately logging the RAW error because Supabase's auth
// errors (AuthRetryableFetchError: name/status/cause) don't fit the narrowed
// shape, so narrowing them hides the useful fields. The first version of this
// test failed on exactly that, which is the rule being too blunt rather than
// the code being wrong.
//
// So the rule is what actually matters: a console call in a component is
// allowed only when it cannot run in production. Anything that CAN reach a
// production console must go through the sanitizing helper.

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** True when the console call is inside a block that early-returns off production. */
function isDevGated(lines, callIndex) {
  // Look back a short window — far enough to cover a guard at the top of the
  // enclosing function, near enough that an unrelated NODE_ENV check
  // elsewhere in the file cannot vouch for this call.
  const from = Math.max(0, callIndex - 10);
  return lines
    .slice(from, callIndex)
    .some((line) => /NODE_ENV\s*!==\s*['"]production['"]|NODE_ENV\s*!==\s*['"]development['"]|NODE_ENV\s*===\s*['"]development['"]/.test(line));
}

test('no component under src/app can log through console in production', () => {
  const offenders = [];

  for (const file of walk('src/app')) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      // Skip comments — a line explaining why console is avoided is not a call.
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
      if (!/\bconsole\.(log|debug|info|warn|error|trace)\s*\(/.test(code)) return;
      if (isDevGated(lines, index)) return;
      offenders.push(`${file}:${index + 1}: ${code}`);
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `use logSupabaseError (src/lib/supabase/error.ts), or gate on NODE_ENV, instead of logging straight to a production console:\n${offenders.join('\n')}`,
  );
});

test('the error helper still sanitizes rather than dumping the raw error', () => {
  const source = readFileSync('src/lib/supabase/error.ts', 'utf8');

  // It must build the narrowed shape and log THAT, not the error itself.
  assert.match(source, /getSupabaseErrorInfo/, 'the sanitizing function should still exist');
  assert.match(
    source,
    /console\.error\([^)]*getSupabaseErrorInfo\(/,
    'logSupabaseError should log the sanitized shape, not the raw error',
  );

  for (const field of ['message', 'code', 'details', 'hint', 'status']) {
    assert.match(source, new RegExp(`\\b${field}:`), `the sanitized shape should still carry ${field}`);
  }
});
