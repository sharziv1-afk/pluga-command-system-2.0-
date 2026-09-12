import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The helper itself is four lines; what is worth guarding is that the error
// paths actually route through it. A create that fails offline while still
// telling the commander "try again in a moment" is the bug this file exists
// to stop coming back, and that bug lives at the call sites, not in the helper.

const HELPER = readFileSync('src/lib/offline/writeErrors.ts', 'utf8');

test('the offline message says nothing was saved, rather than implying a retry will help', () => {
  const message = HELPER.match(/OFFLINE_WRITE_FAILED\s*=\s*\n?\s*'([^']+)'/)?.[1];
  assert.ok(message, 'OFFLINE_WRITE_FAILED should be a single-quoted string constant');

  assert.match(message, /אין חיבור לרשת/, 'must name the actual cause');
  assert.match(message, /לא נשמר/, 'must say the work was not saved');

  // "try again in a moment" is precisely the wrong advice with no signal: the
  // next attempt fails identically and the commander learns nothing.
  assert.doesNotMatch(message, /בעוד רגע/, 'must not suggest waiting a moment');
});

test('navigator.onLine is only consulted in the negative direction', () => {
  // onLine === true is not evidence of a working uplink (captive portals,
  // dead gateways), so it must never be used to decide whether to attempt a
  // write — only to explain one that already failed.
  assert.match(HELPER, /!navigator\.onLine/, 'should test for the false case');
  assert.doesNotMatch(
    HELPER,
    /if\s*\(\s*navigator\.onLine\s*\)/,
    'must not branch on onLine being true',
  );
});

test('every create path that reports a failure routes its message through the helper', () => {
  // Each entry: the file, and the failure messages that must be wrapped.
  const guarded = [
    ['src/app/(protected)/tasks/page.tsx', ['ליצור את המשימה']],
    ['src/app/(protected)/schedule/page.tsx', ['ליצור את המופע']],
    ['src/app/(protected)/requests/page.tsx', ['לפתוח את הדרישה']],
  ];

  for (const [file, fragments] of guarded) {
    const source = readFileSync(file, 'utf8');
    assert.ok(
      source.includes("from '@/lib/offline/writeErrors'"),
      `${file} should import the helper`,
    );

    for (const fragment of fragments) {
      // Find each setError(...) carrying this message and require that the
      // argument is wrapped rather than passed as a bare string literal.
      const bare = new RegExp(`setError\\(\\s*'[^']*${fragment}[^']*'\\s*\\)`);
      assert.doesNotMatch(
        source,
        bare,
        `${file}: "${fragment}" is still set as a bare string — wrap it in writeFailureMessage()`,
      );

      const wrapped = new RegExp(`writeFailureMessage\\(\\s*'[^']*${fragment}`);
      assert.match(
        source,
        wrapped,
        `${file}: "${fragment}" should be passed through writeFailureMessage()`,
      );
    }
  }
});
