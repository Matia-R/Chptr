"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "~/utils/supabase/client";
import { isProtectedRoute } from "~/utils/supabase/protected-routes";

/**
 * Cross-tab (and this-tab) sign-out: leave protected app chrome for /login.
 * Route protection still comes from middleware and server procedures.
 */
export function AuthSessionListener() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      if (!isProtectedRoute(pathnameRef.current)) return;
      queryClient.clear();
      router.replace("/login");
    });

    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return null;
}
