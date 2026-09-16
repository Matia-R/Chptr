import type { QueryClient } from "@tanstack/react-query";
import { isProtectedRoute } from "~/utils/supabase/protected-routes";

export function leaveProtectedSession(
  queryClient: QueryClient,
  router: { replace: (href: string) => void },
  pathname: string,
) {
  queryClient.clear();
  if (isProtectedRoute(pathname)) {
    router.replace("/login");
  }
}
