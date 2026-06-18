import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AppUserProfile = {
  id: string;
  email: string;
  name: string;
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

function logCallbackEvent(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('[auth/callback]', message, details ?? '');
}

function getSafeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const safeNextPath = getSafeNextPath(requestUrl.searchParams.get('next'));
  const origin = requestUrl.origin;

  logCallbackEvent('callback URL received', {
    pathname: requestUrl.pathname,
    hasCode: Boolean(code),
    hasError: Boolean(error || errorCode || errorDescription),
    error,
    errorCode,
    errorDescription,
    next: safeNextPath,
  });

  if (error || errorCode || errorDescription) {
    logCallbackEvent('callback received Supabase error params', {
      error,
      errorCode,
      errorDescription,
    });

    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  if (!code) {
    logCallbackEvent('missing code', {
      searchParams: Array.from(requestUrl.searchParams.keys()),
    });

    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logCallbackEvent('exchangeCodeForSession failed', {
      message: exchangeError.message,
      status: 'status' in exchangeError ? exchangeError.status : undefined,
      code: 'code' in exchangeError ? exchangeError.code : undefined,
    });

    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  logCallbackEvent('exchangeCodeForSession succeeded');

  if (safeNextPath === '/reset-password') {
    logCallbackEvent('redirecting to password reset flow');
    return NextResponse.redirect(`${origin}${safeNextPath}`);
  }

  const { data: authData, error: userError } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (userError || !authUser) {
    logCallbackEvent('getUser failed', {
      hasUser: Boolean(authUser),
      message: userError?.message,
    });

    return NextResponse.redirect(`${origin}/login?error=user_not_found`);
  }

  if (!authUser.email) {
    logCallbackEvent('user email missing', {
      userId: authUser.id,
    });

    return NextResponse.redirect(`${origin}/login?error=user_email_missing`);
  }

  logCallbackEvent('getUser succeeded', {
    userId: authUser.id,
    email: authUser.email,
  });

  const authUserId = authUser.id;
  const email = authUser.email;
  const now = new Date().toISOString();

  const { data: existingProfile, error: profileError } = await supabase
    .from('users')
    .select('id,email,name,role,status,role_approval_status,has_completed_onboarding')
    .eq('auth_user_id', authUserId)
    .maybeSingle<AppUserProfile>();

  if (profileError) {
    logCallbackEvent('profile lookup failed', {
      message: profileError.message,
      code: profileError.code,
    });

    return NextResponse.redirect(`${origin}/login?error=profile_lookup_failed`);
  }

  let profile = existingProfile;

  if (!profile) {
    logCallbackEvent('profile missing, creating new profile');

    const { data: createdProfile, error: insertError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUserId,
        email,
        name: email ?? 'משתמש חדש',
        role: 'pending',
        unit_id: null,
        permission_level: 0,
        has_completed_onboarding: true,
        role_approval_status: 'pending',
        status: 'pending',
        last_login_at: now,
      })
      .select('id,email,name,role,status,role_approval_status,has_completed_onboarding')
      .single<AppUserProfile>();

    if (insertError || !createdProfile) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Profile create failed', {
          message: insertError?.message,
          code: insertError?.code,
          details: insertError?.details,
          hint: insertError?.hint,
        });
      }

      logCallbackEvent('profile create failed', {
        message: insertError?.message,
        code: insertError?.code,
        details: insertError?.details,
        hint: insertError?.hint,
      });

      return NextResponse.redirect(`${origin}/login?error=profile_create_failed`);
    }

    profile = createdProfile;
    logCallbackEvent('profile created', {
      profileId: profile.id,
      status: profile.status,
      roleApprovalStatus: profile.role_approval_status,
      hasCompletedOnboarding: profile.has_completed_onboarding,
    });
  } else {
    logCallbackEvent('profile exists', {
      profileId: profile.id,
      status: profile.status,
      roleApprovalStatus: profile.role_approval_status,
      hasCompletedOnboarding: profile.has_completed_onboarding,
    });

    const { data: updatedProfile, error: updateError } = await supabase
      .from('users')
      .update({ last_login_at: now })
      .eq('id', profile.id)
      .select('id,email,name,role,status,role_approval_status,has_completed_onboarding')
      .single<AppUserProfile>();

    if (updateError || !updatedProfile) {
      logCallbackEvent('profile update failed', {
        message: updateError?.message,
        code: updateError?.code,
      });

      return NextResponse.redirect(`${origin}/login?error=profile_update_failed`);
    }

    profile = updatedProfile;
  }

  const finalRedirectPath = getRedirectPath(profile);

  logCallbackEvent('final redirect target', {
    finalRedirectPath,
  });

  return NextResponse.redirect(`${origin}${finalRedirectPath}`);
}
