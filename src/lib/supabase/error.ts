type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export function getSupabaseErrorInfo(error: unknown, context?: Record<string, unknown>) {
  const supabaseError = error as SupabaseLikeError | null | undefined;
  // Postgres details/message may contain an entire rejected row or an email.
  // Keep machine diagnostics, never server text, tokens, identities or records.
  const code = supabaseError?.code;
  const safeContext = Object.fromEntries(Object.entries(context ?? {}).filter(([, value]) =>
    typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)),
  ));

  return {
    message: 'Request failed; use the operation label and error code for diagnosis',
    code: typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : null,
    details: null,
    hint: null,
    status: typeof supabaseError?.status === 'number' ? supabaseError.status : null,
    context: Object.keys(safeContext).length ? safeContext : null,
  };
}

export function logSupabaseError(message: string, error: unknown, context?: Record<string, unknown>) {
  // Stable caller labels plus bounded codes remain observable in production.
  // Database messages and context identities are deliberately excluded.
  console.error(message, getSupabaseErrorInfo(error, context));
}
