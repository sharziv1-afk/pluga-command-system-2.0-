'use client';

import React, { useEffect, useState } from 'react';

/**
 * Temporary. Two blind attempts at fixing the portrait-only gap below the
 * bottom nav (window.innerHeight, then visualViewport + a delayed re-check)
 * were both retested on the reporting device and neither closed it. Rather
 * than ship a third guess, this reads every number the theories depended on
 * directly on that device, so the next change is aimed at a measured fact
 * instead of a hypothesis. Remove this component once the gap is diagnosed —
 * it has no reason to exist past that.
 */
export const ViewportDebug: React.FC = () => {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const measure = () => {
      const shell = document.querySelector('.protected-layout-shell');
      const shellRect = shell?.getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="ניווט תחתון"]');
      const navRect = nav?.getBoundingClientRect();
      const style = getComputedStyle(document.documentElement);

      setLines([
        `innerHeight: ${window.innerHeight}`,
        `visualViewport.height: ${window.visualViewport?.height ?? 'n/a'}`,
        `screen.height: ${window.screen.height}`,
        `devicePixelRatio: ${window.devicePixelRatio}`,
        `--app-vh: ${style.getPropertyValue('--app-vh').trim() || 'unset'}`,
        `shell height (rendered): ${shellRect ? Math.round(shellRect.height) : 'not found'}`,
        `shell bottom edge (px from top): ${shellRect ? Math.round(shellRect.bottom) : 'not found'}`,
        `nav bottom edge (px from top): ${navRect ? Math.round(navRect.bottom) : 'not found'}`,
        `safe-area-inset-bottom: ${style.getPropertyValue('--sat-debug-bottom').trim() || 'see note'}`,
        `standalone (installed app): ${
          window.matchMedia('(display-mode: standalone)').matches
          || (navigator as Navigator & { standalone?: boolean }).standalone === true
        }`,
        `orientation: ${window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'}`,
      ]);
    };

    measure();
    const timeout = window.setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      dir="ltr"
      className="fixed left-2 top-2 z-[100] max-w-[280px] rounded-lg bg-black/85 p-2 text-[10px] leading-tight text-lime-300 shadow-lg"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="mb-1 font-bold text-white">DEBUG — screenshot this</div>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
};
