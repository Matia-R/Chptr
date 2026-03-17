import { createClient } from '~/utils/supabase/server'
import { TRPCError } from '@trpc/server'

/** Passed from tRPC context to avoid redundant createClient() + getUser() per request. */
export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

export { createClient };

/** Map Supabase/PostgREST document-query errors to TRPC errors (NOT_FOUND, BAD_REQUEST, INTERNAL). */
export function throwOnDocumentQueryError(
  error: { code?: string; message?: string },
  context: string
): never {
  if (error.code === 'PGRST116' || (error.message?.includes('Cannot coerce') ?? false)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
  }
  if (error.message?.includes('invalid input syntax for type uuid')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid document ID format' });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `${context}: ${error.message ?? 'Unknown error'}`,
  });
}
