import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  decideAccess,
  isOnboardingComplete,
  needsOnboardingLookup,
} from "~/lib/onboarding";

function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let onboarded = false;
  if (user && needsOnboardingLookup(request.nextUrl.pathname)) {
    const { data } = await supabase
      .from("profiles")
      .select("author_name, username, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    onboarded = isOnboardingComplete(data);
  }

  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    authenticated: Boolean(user),
    onboarded,
  });

  if (decision.action === "redirect") {
    return redirectWithSession(request, supabaseResponse, decision.pathname);
  }

  return supabaseResponse;
}
