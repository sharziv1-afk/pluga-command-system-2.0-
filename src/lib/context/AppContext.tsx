'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile } from '../types';
import { fetchCurrentProfile } from '../supabase/profile';
import { createSupabaseBrowserClient } from '../supabase/browser';

export type AppAuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'ready'
  | 'onboarding_required'
  | 'pending_approval'
  | 'access_blocked'
  | 'profile_missing'
  | 'error';

interface AppContextProps {
  currentUser: Profile | null;
  isLoading: boolean;
  authStatus: AppAuthStatus;
  authError: string | null;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

const LEGACY_SESSION_KEY = 'pluga_session';
const PROFILE_LOAD_TIMEOUT_MS = 15_000;
const PROFILE_LOAD_ERROR_MESSAGE = 'לא ניתן לטעון את פרופיל המשתמש כרגע. יש לרענן ולנסות שוב.';

type ProfileLoadControlResult = { status: 'timeout' } | { status: 'cancelled' };

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authStatus, setAuthStatus] = useState<AppAuthStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isActive = true;
    let loadVersion = 0;
    let activeAuthUserId: string | null = null;
    let reloadTimer: number | undefined;
    let cancelActiveProfileLoad: (() => void) | undefined;

    const cancelProfileLoad = () => {
      const cancel = cancelActiveProfileLoad;
      cancelActiveProfileLoad = undefined;
      cancel?.();
    };

    const createProfileLoadDeadline = () => {
      let settled = false;
      let resolveDeadline: (result: ProfileLoadControlResult) => void = () => undefined;
      const promise = new Promise<ProfileLoadControlResult>((resolve) => {
        resolveDeadline = resolve;
      });
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolveDeadline({ status: 'timeout' });
      }, PROFILE_LOAD_TIMEOUT_MS);
      const cancel = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolveDeadline({ status: 'cancelled' });
      };

      return { promise, cancel };
    };

    const removeLegacySession = () => {
      try {
        window.localStorage.removeItem(LEGACY_SESSION_KEY);
      } catch {
        // Storage may be unavailable; it is never used as an auth source.
      }
    };

    const clearAuthState = () => {
      cancelProfileLoad();
      loadVersion += 1;
      activeAuthUserId = null;
      setCurrentUser(null);
      setAuthStatus('unauthenticated');
      setAuthError(null);
      removeLegacySession();
    };

    const loadCurrentProfile = async () => {
      cancelProfileLoad();
      const version = ++loadVersion;
      setCurrentUser(null);
      setAuthStatus('loading');
      setAuthError(null);

      const deadline = createProfileLoadDeadline();
      cancelActiveProfileLoad = deadline.cancel;
      const result = await Promise.race([fetchCurrentProfile(), deadline.promise]);

      if (cancelActiveProfileLoad === deadline.cancel) {
        cancelProfileLoad();
      }

      if (!isActive || version !== loadVersion || result.status === 'cancelled') return;

      if (result.status === 'timeout') {
        loadVersion += 1;
        activeAuthUserId = null;
        setCurrentUser(null);
        setAuthStatus('error');
        setAuthError(PROFILE_LOAD_ERROR_MESSAGE);
        return;
      }

      activeAuthUserId = result.authUserId;

      if (result.status === 'ready') {
        setCurrentUser(result.profile);
        setAuthStatus('ready');
        return;
      }

      setCurrentUser(null);

      if (result.status === 'unauthenticated') {
        setAuthStatus('unauthenticated');
        return;
      }

      if (result.status === 'profile_missing') {
        setAuthStatus('profile_missing');
        setAuthError('לא נמצא פרופיל משתמש לחשבון המחובר. יש לפנות למנהל המערכת.');
        return;
      }

      if (
        result.status === 'onboarding_required'
        || result.status === 'pending_approval'
        || result.status === 'access_blocked'
      ) {
        setAuthStatus(result.status);
        return;
      }

      setAuthStatus('error');
      setAuthError(PROFILE_LOAD_ERROR_MESSAGE);
    };

    removeLegacySession();
    void loadCurrentProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive || event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
        clearAuthState();
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && activeAuthUserId !== session.user.id) {
        cancelProfileLoad();
        loadVersion += 1;
        setCurrentUser(null);
        setAuthStatus('loading');
        setAuthError(null);

        if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          void loadCurrentProfile();
        }, 0);
      }
    });

    return () => {
      isActive = false;
      cancelProfileLoad();
      loadVersion += 1;
      if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser,
      isLoading: authStatus === 'loading',
      authStatus,
      authError,
    }}>
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
