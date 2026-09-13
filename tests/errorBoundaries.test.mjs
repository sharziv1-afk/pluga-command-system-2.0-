import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// There was no error boundary anywhere in this app before this. Next's
// default for an uncaught render error is a bare "Application error" screen
// with no recovery but a full reload — for a 3,400-line page doing a lot of
// hand-rolled data shaping, an uncaught error is a real way to lose whatever
// a commander was mid-typing, not a hypothetical. These files are Next's own
// App Router convention (error.tsx / global-error.tsx), not bespoke wiring.

test('error.tsx exists and offers a real recovery path, not just a message', () => {
  assert.ok(existsSync('src/app/error.tsx'), 'src/app/error.tsx must exist to catch render errors under the root layout');

  const source = readFileSync('src/app/error.tsx', 'utf8');
  assert.match(source, /export default function \w+\(\{\s*error,\s*reset,?\s*\}/s, 'must accept the (error, reset) props Next.js passes to error.tsx');
  assert.match(source, /onClick=\{?\(?\)? *=> *reset\(\)/, 'must actually call reset(), not just render a static message');
  assert.match(source, /logSupabaseError/, 'must log the error through the shared sanitizing helper, not a raw console call');
});

test('global-error.tsx exists, renders its own html/body, and stays independent of the app tree', () => {
  assert.ok(existsSync('src/app/global-error.tsx'), 'src/app/global-error.tsx must exist for the case where the root layout itself throws');

  const source = readFileSync('src/app/global-error.tsx', 'utf8');
  assert.match(source, /<html/, 'global-error must render its own <html> — there is no layout left to provide one');
  assert.match(source, /<body/, 'global-error must render its own <body>');
  assert.match(source, /onClick=\{?\(?\)? *=> *reset\(\)/, 'must offer a working reset(), not just a message');

  // The whole point of this file is to not depend on the thing that might be
  // broken — it must not import the app's own components or global styles.
  assert.doesNotMatch(source, /from ['"]@\/components\//, 'global-error must not import app components — they may be exactly what is broken');
  assert.doesNotMatch(source, /import\s+['"].*globals\.css['"]/, 'global-error must not import the app stylesheet — it needs to render even if that failed to load');
});
