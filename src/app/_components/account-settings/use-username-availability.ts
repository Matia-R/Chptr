"use client";

import * as React from "react";

import { usernameSchema } from "~/lib/account-schema";
import { api } from "~/trpc/react";

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken";

const DEBOUNCE_MS = 400;

/**
 * Debounced username availability against the server. Skips the network when the
 * value is empty, invalid, or unchanged from the caller's current username.
 */
export function useUsernameAvailability(
  username: string,
  currentUsername: string | null,
) {
  const trimmed = username.trim();
  const current = (currentUsername ?? "").trim();
  const isOwnUsername =
    trimmed.length > 0 &&
    trimmed.toLowerCase() === current.toLowerCase();
  const isValid =
    usernameSchema.safeParse(trimmed).success && trimmed.length > 0;
  const shouldCheck = isValid && !isOwnUsername;

  const [debouncedUsername, setDebouncedUsername] = React.useState(trimmed);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedUsername(trimmed);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [trimmed]);

  const debouncedMatches = debouncedUsername === trimmed;
  const queryEnabled =
    shouldCheck &&
    debouncedMatches &&
    debouncedUsername.length > 0 &&
    debouncedUsername.toLowerCase() !== current.toLowerCase();

  const query = api.user.checkUsernameAvailability.useQuery(
    { username: debouncedUsername },
    {
      enabled: queryEnabled,
      staleTime: 30_000,
    },
  );

  const isDebouncing = shouldCheck && !debouncedMatches;

  let status: UsernameAvailabilityStatus = "idle";
  if (shouldCheck) {
    if (isDebouncing || query.isFetching || (queryEnabled && query.isPending)) {
      status = "checking";
    } else if (query.isSuccess) {
      status = query.data.available ? "available" : "taken";
    }
  }

  return {
    status,
    isTaken: status === "taken",
    isChecking: status === "checking",
  };
}
