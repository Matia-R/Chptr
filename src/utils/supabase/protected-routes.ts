import { isAuthenticatedAppPath } from "~/lib/onboarding";

/** Session routes. Sign-out leaves these for /login. */
export const isProtectedRoute = (pathname: string) => {
  return isAuthenticatedAppPath(pathname);
};
