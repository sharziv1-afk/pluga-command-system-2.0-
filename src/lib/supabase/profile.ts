import { createSupabaseBrowserClient } from './browser';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { Profile, RoleType, FrameType, UserStatusType } from '../types';
import { logSupabaseError } from './error';

export type CurrentProfileResult =
  | { status: 'unauthenticated'; profile: null; authUserId: null }
  | { status: 'ready'; profile: Profile; authUserId: string }
  | { status: 'onboarding_required'; profile: null; authUserId: string }
  | { status: 'pending_approval'; profile: null; authUserId: string }
  | { status: 'access_blocked'; profile: null; authUserId: string }
  | { status: 'profile_missing'; profile: null; authUserId: string }
  | { status: 'error'; profile: null; authUserId: string | null };

export interface DbUserProfile {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  has_completed_onboarding: boolean;
  role_approval_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  created_at: string;
  unit_name?: string | null;
  units?: { name: string } | null;
}

async function attachUnitName(dbUser: DbUserProfile): Promise<DbUserProfile> {
  if (!dbUser.unit_id) return { ...dbUser, unit_name: null, units: null };

  const supabase = createSupabaseBrowserClient();
  const { data: unit, error } = await supabase
    .from('units')
    .select('name')
    .eq('id', dbUser.unit_id)
    .maybeSingle<{ name: string }>();

  if (error) {
    logSupabaseError('Current profile unit lookup failed', error, {
      profileId: dbUser.id,
      unitId: dbUser.unit_id,
    });
    throw error;
  }

  if (!unit) {
    throw new Error('Current profile unit was not found');
  }

  return { ...dbUser, unit_name: unit.name, units: { name: unit.name } };
}

export async function fetchCurrentProfile(): Promise<CurrentProfileResult> {
  let authUserId: string | null = null;

  try {
    const supabase = createSupabaseBrowserClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      if (isAuthSessionMissingError(authError)) {
        return { status: 'unauthenticated', profile: null, authUserId: null };
      }

      logSupabaseError('Current auth user lookup failed', authError);
      return { status: 'error', profile: null, authUserId: null };
    }

    if (!user) {
      return { status: 'unauthenticated', profile: null, authUserId: null };
    }

    authUserId = user.id;

    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle<DbUserProfile>();

    if (dbError) {
      logSupabaseError('Current profile lookup failed', dbError, { authUserId });
      return { status: 'error', profile: null, authUserId };
    }

    if (!dbUser) {
      return { status: 'profile_missing', profile: null, authUserId };
    }

    if (
      dbUser.status === 'blocked'
      || dbUser.status === 'inactive'
      || dbUser.role_approval_status === 'rejected'
    ) {
      return { status: 'access_blocked', profile: null, authUserId };
    }

    if (!dbUser.has_completed_onboarding) {
      return { status: 'onboarding_required', profile: null, authUserId };
    }

    if (dbUser.status === 'pending' || dbUser.role_approval_status === 'pending') {
      return { status: 'pending_approval', profile: null, authUserId };
    }

    if (
      dbUser.status !== 'active'
      || dbUser.role_approval_status !== 'approved'
      || !dbUser.role.trim()
    ) {
      return { status: 'access_blocked', profile: null, authUserId };
    }

    return {
      status: 'ready',
      profile: mapDbUserToProfile(await attachUnitName(dbUser)),
      authUserId,
    };
  } catch (error) {
    logSupabaseError('Current profile load failed', error, { authUserId });
    return { status: 'error', profile: null, authUserId };
  }
}

export function mapDbUserToProfile(dbUser: DbUserProfile): Profile {
  // Profile.status uses UserStatusType ('pending' | 'approved' | 'rejected'), which aligns with
  // role_approval_status — not with dbUser.status ('active' | 'pending' | 'blocked' | 'inactive').
  // This is intentional: the rest of the app (e.g. admin isAuthorized check) uses status === 'approved'.
  // Changing to dbUser.status would break those checks. The DB status field (blocked/inactive) is
  // not surfaced in the app-level Profile type at this stage.
  if (!dbUser.units?.name) {
    throw new Error('Current profile has no assigned unit');
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    full_name: dbUser.name,
    role: dbUser.role as RoleType,
    assigned_frame: dbUser.units.name as FrameType,
    status: dbUser.role_approval_status as UserStatusType,
    created_at: dbUser.created_at,
  };
}
