'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Profile } from '../types';
import { fetchCurrentProfile } from '../supabase/profile';
import { createSupabaseBrowserClient } from '../supabase/browser';
import { cacheProfileSnapshot, readCachedProfileSnapshot } from '../offline/cachedProfile';

export type AppAuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'ready'
  | 'onboarding_required'
  | 'pending_approval'
  | 'access_blocked'
  | 'profile_missing'
  | 'offline'
  | 'error';

interface AppContextProps {
  currentUser: Profile | null;
  isLoading: boolean;
  authStatus: AppAuthStatus;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  /** True while the app is running on a device-unlocked cached identity with
   *  no verified network session. Reads come from the IndexedDB cache and
   *  writes are queued — nothing here has been confirmed against the server. */
  isOfflineSession: boolean;
  /** Called by the offline gate once the device PIN or biometric check
   *  passes: promotes the cached profile to the active user so the normal
   *  shell can render against the cache instead of a dead-end card. */
  unlockOfflineSession: () => boolean;
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
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  const unlockOfflineSession = useCallback(() => {
    const snapshot = readCachedProfileSnapshot();
    if (!snapshot) return false;
    setCurrentUser(snapshot.profile);
    setIsOfflineSession(true);
    setAuthStatus('ready');
    setAuthError(null);
    return true;
  }, []);
  const refreshProfileRef = useRef<() => Promise<void>>(async () => undefined);
  const refreshProfile = useCallback(() => refreshProfileRef.current(), []);

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
      setIsOfflineSession(false);
      setAuthStatus('unauthenticated');
      setAuthError(null);
      removeLegacySession();
    };

    const loadCurrentProfile = async (preserveReadyState = false) => {
      cancelProfileLoad();
      const version = ++loadVersion;
      if (!preserveReadyState) {
        setCurrentUser(null);
        setAuthStatus('loading');
      }
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
        // A hung request with the browser reporting no connectivity, and a
        // prior successful login on this device to fall back to, is the one
        // case worth distinguishing from a generic server error — everything
        // else (a real bug, a slow-but-live network) stays 'error' as before.
        setAuthStatus(!navigator.onLine && readCachedProfileSnapshot() ? 'offline' : 'error');
        setAuthError(PROFILE_LOAD_ERROR_MESSAGE);
        return;
      }

      activeAuthUserId = result.authUserId;

      if (result.status === 'ready') {
        setCurrentUser(result.profile);
        setIsOfflineSession(false);
        setAuthStatus('ready');
        cacheProfileSnapshot(result.profile);
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

      setAuthStatus(!navigator.onLine && readCachedProfileSnapshot() ? 'offline' : 'error');
      setAuthError(PROFILE_LOAD_ERROR_MESSAGE);
    };

    refreshProfileRef.current = () => loadCurrentProfile(true);
    removeLegacySession();
    void loadCurrentProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive || event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
        clearAuthState();
        return;
      }

      if (
        (event === 'SIGNED_IN' && activeAuthUserId !== session.user.id)
        || event === 'USER_UPDATED'
      ) {
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
      refreshProfileRef.current = async () => undefined;
    };
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser,
      isLoading: authStatus === 'loading',
      authStatus,
      authError,
      refreshProfile,
      isOfflineSession,
      unlockOfflineSession,
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
