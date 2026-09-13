'use client';

import React from 'react';
import { RotateCw } from 'lucide-react';

/**
 * A standalone PWA has no browser chrome, so it has no pull-to-refresh
 * gesture either — iOS only wires that up to a Safari *tab*, not to a
 * home-screen app. Without an explicit control, a commander whose data looks
 * stale on bad reception has no way to force a reload short of force-quitting
 * the app.
 *
 * A full reload rather than a data-only refetch: every page fetches its own
 * data in its own effect on mount, so this both re-fetches everything and
 * re-checks for a new deployed build in one action — the two things "the
 * connection was bad a minute ago" could actually mean.
 */
export const RefreshButton: React.FC = () => (
  <button
    type="button"
    onClick={() => window.location.reload()}
    className="command-icon-button"
    aria-label="רענון האפליקציה"
    title="רענון"
  >
    <RotateCw className="h-4 w-4" />
  </button>
);
