type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export function getSupabaseErrorInfo(error: unknown, context?: Record<string, unknown>) {
  const supabaseError = error as SupabaseLikeError | null | undefined;

  return {
    message: supabaseError?.message ?? (error instanceof Error ? error.message : 'No error message'),
    code: supabaseError?.code ?? null,
    details: supabaseError?.details ?? null,
    hint: supabaseError?.hint ?? null,
    status: supabaseError?.status ?? null,
    context: context ?? null,
  };
}

export function logSupabaseError(message: string, error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return;

  console.error(message, getSupabaseErrorInfo(error, context));
}
