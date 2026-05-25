import { createSupabaseBrowserClient } from './browser';
import { Profile, RoleType, FrameType, UserStatusType } from '../types';

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
  units: { name: string } | null;
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
      .select('*, units(name)')
      .eq('auth_user_id', user.id)
      .maybeSingle<DbUserProfile>();

    if (dbError || !dbUser) {
      // Fallback query by email in case the auth_user_id wasn't synced yet
      if (user.email) {
        const { data: fallbackUser, error: fallbackError } = await supabase
          .from('users')
          .select('*, units(name)')
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
          return mapDbUserToProfile(fallbackUser);
        }
      }
      return null;
    }

    return mapDbUserToProfile(dbUser);
  } catch (error) {
    console.error('Error fetching current profile:', error);
    return null;
  }
}

export function mapDbUserToProfile(dbUser: DbUserProfile): Profile {
  // Map 'role_approval_status' ('pending' | 'approved' | 'rejected') to local Profile 'status' ('pending' | 'approved' | 'rejected')
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
