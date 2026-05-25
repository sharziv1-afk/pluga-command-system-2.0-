'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pluga_theme';

function applyTheme(nextTheme: ThemeMode) {
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
}

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme: ThemeMode = savedTheme === 'dark' ? 'dark' : 'light';

    applyTheme(nextTheme);
    setTheme(nextTheme);
    setIsReady(true);

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<ThemeMode>;
      const syncedTheme = customEvent.detail === 'dark' ? 'dark' : 'light';

      applyTheme(syncedTheme);
      setTheme(syncedTheme);
    };

    window.addEventListener('pluga-theme-change', handleThemeChange);

    return () => {
      window.removeEventListener('pluga-theme-change', handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';

    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new CustomEvent<ThemeMode>('pluga-theme-change', { detail: nextTheme }));
    setTheme(nextTheme);
  };

  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!isReady}
      className="command-icon-button"
      aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה עדין'}
      title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה עדין'}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};
