'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, RoleType } from '../types';
import { fetchCurrentProfile } from '../supabase/profile';

interface AppContextProps {
  currentUser: Profile | null;
  isLoading: boolean;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

const initialProfiles: Profile[] = [
  {
    id: 'user-mp',
    email: 'mp@army.gov.il',
    full_name: 'רס"ן אוריאל דוד',
    role: 'מ"פ',
    assigned_frame: 'פלוגה',
    status: 'approved',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeAuth() {
      setIsLoading(true);

      const supabaseProfile = await fetchCurrentProfile();
      if (supabaseProfile) {
        setCurrentUser(supabaseProfile);
        setIsLoading(false);
        return;
      }

      // Supabase fallback: no authenticated profile found yet.
      const sessionUser = localStorage.getItem('pluga_session');
      if (sessionUser) {
        try {
          setCurrentUser(JSON.parse(sessionUser) as Profile);
        } catch {
          const defaultMp = initialProfiles.find((p) => p.role === ('מ"פ' as RoleType)) || null;
          setCurrentUser(defaultMp);
        }
      } else {
        const defaultMp = initialProfiles.find((p) => p.role === ('מ"פ' as RoleType)) || null;
        setCurrentUser(defaultMp);
        if (defaultMp) {
          localStorage.setItem('pluga_session', JSON.stringify(defaultMp));
        }
      }
      setIsLoading(false);
    }

    initializeAuth();
  }, []);

  return (
    <AppContext.Provider value={{ currentUser, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
