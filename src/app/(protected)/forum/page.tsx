'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Pin, RefreshCw, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  units: { name: string } | null;
};

type ForumPostRow = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  unit_id: string | null;
  is_pinned: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ForumPostView = ForumPostRow & {
  authorName: string | null;
  unitName: string | null;
};

type UserLookup = {
  id: string;
  name: string | null;
  email: string;
};

type UnitLookup = {
  id: string;
  name: string;
};

function normalizeRole(role: string) {
  return role.replace(/[״׳´"“”]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function logSupabaseError(message: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.error(message, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

export default function ForumPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [posts, setPosts] = useState<ForumPostView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));

  const loadPosts = useCallback(async () => {
    if (isContextLoading) return;

    if (!currentUser) {
      setIsLoading(false);
      setError('לא נמצא משתמש מחובר. יש להתחבר מחדש.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('id,name,email,role,unit_id,permission_level,units(name)')
      .eq('id', currentUser.id)
      .maybeSingle<DbProfile>();

    if (profileError || !profileData) {
      if (profileError) logSupabaseError('Forum profile lookup failed', profileError);
      setDbProfile(null);
      setPosts([]);
      setError('לא נמצא פרופיל משתמש פעיל. יש להתחבר מחדש או לפנות למפקד.');
      setIsLoading(false);
      return;
    }

    setDbProfile(profileData);

    const { data: rawPosts, error: postsError } = await supabase
      .from('forum_posts')
      .select('id,title,body,author_id,unit_id,is_pinned,metadata,created_at,updated_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ForumPostRow[]>();

    if (postsError) {
      logSupabaseError('Forum posts load failed', postsError);
      setPosts([]);
      setError('לא ניתן לטעון את הפורום כרגע. בדוק שמיגרציית 008 הורצה ב-Supabase.');
      setIsLoading(false);
      return;
    }

    const authorIds = [...new Set((rawPosts ?? []).map(post => post.author_id).filter((id): id is string => Boolean(id)))];
    const unitIds = [...new Set((rawPosts ?? []).map(post => post.unit_id).filter((id): id is string => Boolean(id)))];

    const [authorsResult, unitsResult] = await Promise.all([
      authorIds.length
        ? supabase.from('users').select('id,name,email').in('id', authorIds).returns<UserLookup[]>()
        : Promise.resolve({ data: [] as UserLookup[], error: null }),
      unitIds.length
        ? supabase.from('units').select('id,name').in('id', unitIds).returns<UnitLookup[]>()
        : Promise.resolve({ data: [] as UnitLookup[], error: null }),
    ]);

    if (authorsResult.error) logSupabaseError('Forum author lookup failed', authorsResult.error);
    if (unitsResult.error) logSupabaseError('Forum unit lookup failed', unitsResult.error);

    const authorNames = new Map((authorsResult.data ?? []).map(user => [user.id, user.name || user.email]));
    const unitNames = new Map((unitsResult.data ?? []).map(unit => [unit.id, unit.name]));

    setPosts((rawPosts ?? []).map(post => ({
      ...post,
      authorName: post.author_id ? authorNames.get(post.author_id) ?? null : null,
      unitName: post.unit_id ? unitNames.get(post.unit_id) ?? null : null,
    })));
    setIsLoading(false);
  }, [currentUser, isContextLoading, supabase]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle || !cleanBody) {
      setFormError('כותרת ותוכן הם שדות חובה.');
      return;
    }

    if (!dbProfile) {
      setFormError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
      return;
    }

    setIsSubmitting(true);

    const nextIsPinned = canSeeAll ? isPinned : false;
    const { data: createdPost, error: insertError } = await supabase
      .from('forum_posts')
      .insert({
        title: cleanTitle,
        body: cleanBody,
        author_id: dbProfile.id,
        unit_id: dbProfile.unit_id,
        is_pinned: nextIsPinned,
        metadata: {},
      })
      .select('id,title,body,is_pinned,unit_id')
      .single<{ id: string; title: string; body: string; is_pinned: boolean; unit_id: string | null }>();

    if (insertError || !createdPost) {
      if (insertError) logSupabaseError('Forum post insert failed', insertError);
      setFormError('לא ניתן לפרסם את הפוסט כרגע. בדוק הרשאות RLS או נסה שוב.');
      setIsSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_post_created',
      entityType: 'forum_post',
      entityId: createdPost.id,
      previousValue: null,
      newValue: {
        title: createdPost.title,
        body: createdPost.body,
        is_pinned: createdPost.is_pinned,
        unit_id: createdPost.unit_id,
      },
    });

    setTitle('');
    setBody('');
    setIsPinned(false);
    setSuccessMessage('הפוסט פורסם בהצלחה.');
    setIsSubmitting(false);
    await loadPosts();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="פורום מוביל" subtitle="מרכז הודעות ועדכונים פלוגתי" category="פלוגה א׳" />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="פורום מוביל"
        subtitle="מרכז עדכונים, סיכומי מפקדים והודעות תיאום לכלל הפלוגה"
        category="פלוגה א׳"
        actions={(
          <GlossyButton variant="slate" size="sm" onClick={() => void loadPosts()} disabled={isSubmitting}>
            <RefreshCw className="h-4 w-4" />
            רענן
          </GlossyButton>
        )}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.35fr]">
        <form onSubmit={handleCreatePost} className="tactical-glass-card rounded-3xl p-5 shadow-[0_16px_44px_rgba(2,1,8,0.08)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#020108]">פרסום פוסט חדש</h2>
              <p className="mt-1 text-sm font-bold leading-relaxed text-[#667085]">
                עדכון קצר וברור למפקדים ולבעלי התפקידים.
              </p>
            </div>
          </div>

          {formError && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#020108]">כותרת *</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                className="command-input"
                placeholder="לדוגמה: עדכון מצב ערב"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#020108]">תוכן *</span>
              <textarea
                value={body}
                onChange={event => setBody(event.target.value)}
                className="command-input min-h-24 resize-none"
                placeholder="כתוב את העדכון המרכזי, החלטות, פערים או דגשים להמשך."
                disabled={isSubmitting}
              />
            </label>

            {canSeeAll && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-4 py-3">
                <span>
                  <span className="block text-sm font-black text-[#020108]">נעץ בראש הפורום</span>
                  <span className="text-xs font-bold text-[#667085]">זמין למפקדים בלבד</span>
                </span>
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={event => setIsPinned(event.target.checked)}
                  className="h-5 w-5 accent-[#FF6B02]"
                  disabled={isSubmitting}
                />
              </label>
            )}

            <GlossyButton type="submit" variant="orange" size="lg" disabled={isSubmitting} className="w-full">
              <Send className="h-4 w-4" />
              {isSubmitting ? 'מפרסם...' : 'פרסם לפורום'}
            </GlossyButton>
          </div>
        </form>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#020108]">עדכונים אחרונים</h2>
              <p className="text-sm font-bold text-[#667085]">{posts.length} פוסטים זמינים לפי הרשאות RLS</p>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="tactical-glass-card rounded-3xl p-8 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-[#020108]">אין עדיין פוסטים בפורום</h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed text-[#667085]">
                פרסם את העדכון הראשון כדי לפתוח את ערוץ הסנכרון הפלוגתי.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <article key={post.id} className="tactical-glass-card rounded-3xl p-5 shadow-[0_14px_36px_rgba(2,1,8,0.07)]">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {post.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#FF6B02]/25 bg-[#FF6B02]/10 px-3 py-1 text-xs font-black text-[#C75200]">
                            <Pin className="h-3.5 w-3.5" />
                            נעוץ
                          </span>
                        )}
                        <span className="text-xs font-bold text-[#667085]">{formatDate(post.created_at)}</span>
                      </div>
                      <h3 className="text-xl font-black leading-tight text-[#020108]">{post.title}</h3>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-[#344054]">{post.body}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(2,1,8,0.08)] pt-4 text-xs font-black text-[#667085]">
                    <span>מאת: <strong className="text-[#020108]">{post.authorName ?? 'משתמש'}</strong></span>
                    <span>·</span>
                    <span>יחידה: <strong className="text-[#020108]">{post.unitName ?? 'לא שויך'}</strong></span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
