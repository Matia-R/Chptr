import { api } from "~/trpc/react";

/**
 * Shared hook for fetching the current user profile.
 * React Query automatically deduplicates requests with the same query key,
 * so multiple components using this hook will share the same query instance.
 */
export function useUserProfile() {
  return api.user.getCurrentUserProfile.useQuery();
}

