import { createSupabaseBrowserClient } from './browser';
import { Profile, RoleType, FrameType, UserStatusType } from '../types';
import { logSupabaseError } from './error';

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
  }

  return { ...dbUser, unit_name: unit?.name ?? null, units: unit ? { name: unit.name } : null };
}

export async function fetchCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
    }

    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle<DbUserProfile>();

    if (dbError || !dbUser) {
      // Fallback query by email in case the auth_user_id wasn't synced yet
      if (user.email) {
        const { data: fallbackUser, error: fallbackError } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email.toLowerCase().trim())
          .maybeSingle<DbUserProfile>();

        if (!fallbackError && fallbackUser) {
          // If we found the user by email but auth_user_id is not set, let's sync it
          if (!fallbackUser.auth_user_id) {
            await supabase
              .from('users')
              .update({ auth_user_id: user.id })
              .eq('id', fallbackUser.id);
          }
          return mapDbUserToProfile(await attachUnitName(fallbackUser));
        }
      }
      return null;
    }

    return mapDbUserToProfile(await attachUnitName(dbUser));
  } catch (error) {
    console.error('Error fetching current profile:', error);
    return null;
  }
}

export function mapDbUserToProfile(dbUser: DbUserProfile): Profile {
  // Profile.status uses UserStatusType ('pending' | 'approved' | 'rejected'), which aligns with
  // role_approval_status — not with dbUser.status ('active' | 'pending' | 'blocked' | 'inactive').
  // This is intentional: the rest of the app (e.g. admin isAuthorized check) uses status === 'approved'.
  // Changing to dbUser.status would break those checks. The DB status field (blocked/inactive) is
  // not surfaced in the app-level Profile type at this stage.
  return {
    id: dbUser.id,
    email: dbUser.email,
    full_name: dbUser.name,
    role: dbUser.role as RoleType,
    assigned_frame: (dbUser.units?.name || 'פלוגה') as FrameType,
    status: dbUser.role_approval_status as UserStatusType,
    created_at: dbUser.created_at,
  };
}
