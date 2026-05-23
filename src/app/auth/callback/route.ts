import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AppUserProfile = {
  id: string;
  email: string;
  role: string;
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  role_approval_status: 'pending' | 'approved' | 'rejected';
  has_completed_onboarding: boolean;
};

function getRedirectPath(profile: AppUserProfile): string {
  if (!profile.has_completed_onboarding) return '/onboarding';
  if (profile.role_approval_status === 'pending') return '/pending-approval';
  if (profile.role_approval_status === 'approved' && profile.status === 'active') return '/dashboard';

  return '/pending-approval';
}

function fallbackNameFromEmail(email: string): string {
  return email.split('@')[0] || email;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  const { data: authData, error: userError } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (userError || !authUser?.email) {
    return NextResponse.redirect(`${origin}/login?error=user_not_found`);
  }

  const authUserId = authUser.id;
  const email = authUser.email;
  const now = new Date().toISOString();

  const { data: existingProfile, error: profileError } = await supabase
    .from('users')
    .select('id,email,role,status,role_approval_status,has_completed_onboarding')
    .eq('auth_user_id', authUserId)
    .maybeSingle<AppUserProfile>();

  if (profileError) {
    return NextResponse.redirect(`${origin}/login?error=profile_lookup_failed`);
  }

  let profile = existingProfile;

  if (!profile) {
    const { data: createdProfile, error: insertError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUserId,
        email,
        name: authUser.user_metadata?.name || fallbackNameFromEmail(email),
        role: 'pending',
        permission_level: 0,
        has_completed_onboarding: false,
        role_approval_status: 'pending',
        status: 'pending',
        last_login_at: now,
      })
      .select('id,email,role,status,role_approval_status,has_completed_onboarding')
      .single<AppUserProfile>();

    if (insertError || !createdProfile) {
      return NextResponse.redirect(`${origin}/login?error=profile_create_failed`);
    }

    profile = createdProfile;
  } else {
    const { data: updatedProfile, error: updateError } = await supabase
      .from('users')
      .update({ last_login_at: now })
      .eq('id', profile.id)
      .select('id,email,role,status,role_approval_status,has_completed_onboarding')
      .single<AppUserProfile>();

    if (updateError || !updatedProfile) {
      return NextResponse.redirect(`${origin}/login?error=profile_update_failed`);
    }

    profile = updatedProfile;
  }

  return NextResponse.redirect(`${origin}${getRedirectPath(profile)}`);
}
