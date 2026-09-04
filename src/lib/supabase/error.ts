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
  // Always log, including production — this was dev-only before, which meant a
  // failed mutation left zero trace anywhere once deployed (the user just saw
  // a friendly Hebrew message). The logged shape is already sanitized to
  // message/code/details/hint/status, not a raw error dump.
  console.error(message, getSupabaseErrorInfo(error, context));
}
