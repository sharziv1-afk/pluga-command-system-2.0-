'use client';

import React, { useEffect, useState } from 'react';
import { Contrast } from 'lucide-react';

type ContrastMode = 'normal' | 'high';

const STORAGE_KEY = 'pluga_contrast';

function applyContrast(next: ContrastMode) {
  if (next === 'high') {
    document.documentElement.dataset.contrast = 'high';
  } else {
    delete document.documentElement.dataset.contrast;
  }
}

export const ContrastToggle: React.FC = () => {
  const [contrast, setContrast] = useState<ContrastMode>('normal');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next: ContrastMode = saved === 'high' ? 'high' : 'normal';

    applyContrast(next);
    setContrast(next);
    setIsReady(true);

    const handleContrastChange = (event: Event) => {
      const customEvent = event as CustomEvent<ContrastMode>;
      const synced: ContrastMode = customEvent.detail === 'high' ? 'high' : 'normal';

      applyContrast(synced);
      setContrast(synced);
    };

    window.addEventListener('pluga-contrast-change', handleContrastChange);

    return () => {
      window.removeEventListener('pluga-contrast-change', handleContrastChange);
    };
  }, []);

  const toggleContrast = () => {
    const next: ContrastMode = contrast === 'high' ? 'normal' : 'high';

    applyContrast(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent<ContrastMode>('pluga-contrast-change', { detail: next }));
    setContrast(next);
  };

  const isHigh = contrast === 'high';

  return (
    <button
      type="button"
      onClick={toggleContrast}
      disabled={!isReady}
      className="command-icon-button"
      aria-pressed={isHigh}
      aria-label={isHigh ? 'כבה ניגודיות גבוהה' : 'הפעל ניגודיות גבוהה'}
      title={isHigh ? 'ניגודיות גבוהה פעילה' : 'ניגודיות גבוהה'}
    >
      <Contrast className="h-4 w-4" />
    </button>
  );
};
