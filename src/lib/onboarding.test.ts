import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { claimHandle, createHandleStore } from "./author-handle.ts";
import {
  assertCompletedProfileUpdate,
  classifyAppPath,
  decideAccess,
  isOnboardingComplete,
  needsOnboardingLookup,
  chooseFirstDocument,
  generatedHandleToApply,
  onboardingStepHref,
  onboardingStepMatchesRequest,
  qualifiesForOnboardingBackfill,
  resumeOnboardingStep,
  suggestedAuthorNameFromAuthMetadata,
  suggestedAvatarUrlFromAuthMetadata,
} from "./onboarding.ts";

const migrationSql = readFileSync(
  new URL("../../migrations/profiles_onboarding.sql", import.meta.url),
  "utf8",
);

const documentRouter = readFileSync(
  new URL("../server/api/routers/document.ts", import.meta.url),
  "utf8",
);
const userRouter = readFileSync(
  new URL("../server/api/routers/user.ts", import.meta.url),
  "utf8",
);
const aiRouter = readFileSync(
  new URL("../server/api/routers/ai-prompt-router.ts", import.meta.url),
  "utf8",
);
const connectRoute = readFileSync(
  new URL("../app/api/partykit/connect/route.ts", import.meta.url),
  "utf8",
);
const authDb = readFileSync(
  new URL("../server/db/auth.ts", import.meta.url),
  "utf8",
);
const saveRoute = readFileSync(
  new URL("../app/api/partykit/save/route.ts", import.meta.url),
  "utf8",
);

function follow(pathname: string, authenticated: boolean, onboarded: boolean) {
  const seen: string[] = [];
  let current = pathname;
  for (let hop = 0; hop < 6; hop += 1) {
    const decision = decideAccess({
      pathname: current,
      authenticated,
      onboarded,
    });
    if (decision.action === "allow") return { landed: current, hops: seen };
    if (seen.includes(decision.pathname)) {
      throw new Error(
        `redirect loop: ${[...seen, decision.pathname].join(" -> ")}`,
      );
    }
    seen.push(decision.pathname);
    current = decision.pathname;
  }
  throw new Error(`redirect did not settle from ${pathname}`);
}

describe("onboarding completion", () => {
  test("requires the timestamp and both identity fields", () => {
    assert.equal(
      isOnboardingComplete({
        author_name: "Ada Lovelace",
        username: "ada",
        onboarding_completed_at: "2026-01-01T00:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      isOnboardingComplete({
        author_name: "Ada Lovelace",
        username: "ada",
        onboarding_completed_at: null,
      }),
      false,
    );
    assert.equal(
      isOnboardingComplete({
        author_name: " ",
        username: "ada",
        onboarding_completed_at: "2026-01-01T00:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      isOnboardingComplete({
        author_name: "Ada",
        username: "login",
        onboarding_completed_at: "2026-01-01T00:00:00.000Z",
      }),
      false,
    );
    assert.equal(isOnboardingComplete(null), false);
  });

  test("backfills only profiles that already have a valid identity", () => {
    assert.equal(
      qualifiesForOnboardingBackfill({
        author_name: "Ada Lovelace",
        username: "ada",
        onboarding_completed_at: null,
      }),
      true,
    );
    assert.equal(
      qualifiesForOnboardingBackfill({
        author_name: "Ada Lovelace",
        username: null,
        onboarding_completed_at: null,
      }),
      false,
    );
    assert.equal(
      qualifiesForOnboardingBackfill({
        author_name: null,
        username: "ada",
        onboarding_completed_at: null,
      }),
      false,
    );
    assert.equal(
      qualifiesForOnboardingBackfill({
        author_name: "Ada",
        username: "ada",
        onboarding_completed_at: "2026-01-01T00:00:00.000Z",
      }),
      false,
    );
  });

  test("a completed profile cannot drop its name or handle", () => {
    const current = {
      author_name: "Ada Lovelace",
      username: "ada",
      onboarding_completed_at: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(
      assertCompletedProfileUpdate(current, {
        author_name: null,
        username: "ada",
      }).ok,
      false,
    );
    assert.equal(
      assertCompletedProfileUpdate(current, {
        author_name: "Ada",
        username: "",
      }).ok,
      false,
    );
    assert.equal(
      assertCompletedProfileUpdate(current, {
        author_name: "Pen Name",
        username: "ada-l",
      }).ok,
      true,
    );
    assert.equal(
      assertCompletedProfileUpdate(
        { author_name: null, username: null, onboarding_completed_at: null },
        { author_name: null, username: null },
      ).ok,
      true,
    );
  });
});

describe("onboarding steps", () => {
  test("resumes an interrupted session and blocks skipping ahead", () => {
    assert.equal(resumeOnboardingStep(null, null), "name");
    assert.equal(
      resumeOnboardingStep({ author_name: "Ada", username: null }, null),
      "handle",
    );
    assert.equal(
      resumeOnboardingStep({ author_name: "Ada", username: "ada" }, null),
      "avatar",
    );
    assert.equal(
      resumeOnboardingStep({ author_name: "Ada", username: null }, "avatar"),
      "handle",
    );
    assert.equal(
      resumeOnboardingStep({ author_name: "Ada", username: "ada" }, "name"),
      "name",
    );
    assert.equal(onboardingStepHref("name"), "/onboarding?step=name");
    assert.equal(onboardingStepHref("handle"), "/onboarding?step=handle");
    assert.equal(onboardingStepMatchesRequest(null, "name"), true);
    assert.equal(onboardingStepMatchesRequest("avatar", "handle"), false);
  });

  test("replaces only an untouched generated handle that is taken", () => {
    assert.equal(
      generatedHandleToApply({
        edited: false,
        authorName: "Jane Mitchell",
        currentHandle: "jane-mitchell",
        unavailable: true,
        alternative: "jane-mitchell-2",
      }),
      "jane-mitchell-2",
    );
    assert.equal(
      generatedHandleToApply({
        edited: true,
        authorName: "Jane Mitchell",
        currentHandle: "jane-mitchell",
        unavailable: true,
        alternative: "jane-mitchell-2",
      }),
      null,
    );
    assert.equal(
      generatedHandleToApply({
        edited: false,
        authorName: "Jane Mitchell",
        currentHandle: "custom-name",
        unavailable: true,
        alternative: "jane-mitchell-2",
      }),
      null,
    );
    assert.equal(
      generatedHandleToApply({
        edited: false,
        authorName: "Janet",
        currentHandle: "jane-mitchell",
        unavailable: true,
        alternative: "jane-mitchell-2",
      }),
      null,
    );
    assert.equal(
      generatedHandleToApply({
        edited: false,
        authorName: "Jane Mitchell",
        currentHandle: "jane-mitchell",
        unavailable: false,
        alternative: "jane-mitchell-2",
      }),
      null,
    );
  });
});

describe("first document handoff", () => {
  test("reuses an existing document instead of creating another", () => {
    assert.deepEqual(
      chooseFirstDocument({
        existingDocumentIds: ["existing"],
        rememberedId: "remembered",
        generatedId: "generated",
      }),
      { id: "existing", isNew: false },
    );
  });

  test("reuses a remembered id when the person has no documents yet", () => {
    assert.deepEqual(
      chooseFirstDocument({
        existingDocumentIds: [],
        rememberedId: "remembered",
        generatedId: "generated",
      }),
      { id: "remembered", isNew: true },
    );
  });

  test("uses a new id only for the first attempt", () => {
    assert.deepEqual(
      chooseFirstDocument({
        existingDocumentIds: ["", "  "],
        rememberedId: "  ",
        generatedId: "generated",
      }),
      { id: "generated", isNew: true },
    );
  });
});

describe("provider suggestions", () => {
  test("missing Google metadata stays empty", () => {
    assert.equal(suggestedAuthorNameFromAuthMetadata(undefined), null);
    assert.equal(suggestedAuthorNameFromAuthMetadata({}), null);
    assert.equal(
      suggestedAuthorNameFromAuthMetadata({ email: "ada@example.com" }),
      null,
    );
    assert.equal(suggestedAvatarUrlFromAuthMetadata(null), null);
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        avatar_url: "http://example.com/a.png",
      }),
      null,
    );
    assert.equal(isOnboardingComplete(null), false);
  });

  test("uses a provider name and https photo only as suggestions", () => {
    assert.equal(
      suggestedAuthorNameFromAuthMetadata({ full_name: "  Ada Lovelace  " }),
      "Ada Lovelace",
    );
    assert.equal(
      suggestedAuthorNameFromAuthMetadata({
        given_name: "Grace",
        family_name: "Hopper",
      }),
      "Grace Hopper",
    );
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        picture: "https://lh3.googleusercontent.com/a/photo",
      }),
      "https://lh3.googleusercontent.com/a/photo",
    );
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        avatar_url: "https://example.com/a.png",
      }),
      null,
    );
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        avatar_url: "https://lh3.googleusercontent.com.evil.com/a.png",
      }),
      null,
    );
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        identities: [
          {
            identity_data: {
              picture: "https://lh3.googleusercontent.com/a/provider",
            },
          },
        ],
        user_metadata: {
          avatar_url: "https://example.com/planted.png",
        },
      }),
      "https://lh3.googleusercontent.com/a/provider",
    );
    assert.equal(
      suggestedAvatarUrlFromAuthMetadata({
        identities: [
          {
            identity_data: {
              picture: "https://evil.example/photo.png",
            },
          },
        ],
      }),
      null,
    );
  });
});

describe("access redirects", () => {
  test("sends anonymous people to login and incomplete people to onboarding", () => {
    assert.deepEqual(
      decideAccess({
        pathname: "/documents/abc",
        authenticated: false,
        onboarded: false,
      }),
      { action: "redirect", pathname: "/login" },
    );
    assert.deepEqual(
      decideAccess({
        pathname: "/account",
        authenticated: true,
        onboarded: false,
      }),
      { action: "redirect", pathname: "/onboarding" },
    );
    assert.deepEqual(
      decideAccess({
        pathname: "/onboarding",
        authenticated: true,
        onboarded: false,
      }),
      { action: "allow" },
    );
    assert.deepEqual(
      decideAccess({
        pathname: "/onboarding",
        authenticated: true,
        onboarded: true,
      }),
      { action: "redirect", pathname: "/documents" },
    );
    assert.deepEqual(
      decideAccess({
        pathname: "/jane/hello",
        authenticated: true,
        onboarded: false,
      }),
      { action: "allow" },
    );
    assert.equal(classifyAppPath("/auth/signout"), "auth");
    assert.equal(classifyAppPath("/auth/confirm"), "auth");
    assert.equal(needsOnboardingLookup("/jane/hello"), false);
    assert.equal(
      needsOnboardingLookup("/api/trpc/document.createDocument"),
      false,
    );
    assert.equal(needsOnboardingLookup("/documents"), true);
  });

  test("does not loop between login, onboarding, and the app", () => {
    const cases: Array<[string, boolean, boolean, string]> = [
      ["/documents/abc", false, false, "/login"],
      ["/onboarding", false, false, "/login"],
      ["/account", true, false, "/onboarding"],
      ["/documents", true, false, "/onboarding"],
      ["/onboarding?step=handle", true, false, "/onboarding?step=handle"],
      ["/onboarding", true, true, "/documents"],
      ["/documents/abc", true, true, "/documents/abc"],
      ["/jane/hello", false, false, "/jane/hello"],
      ["/jane/hello", true, false, "/jane/hello"],
      ["/auth/confirm", true, false, "/auth/confirm"],
      ["/auth/signout", true, false, "/auth/signout"],
      ["/login", true, false, "/login"],
      [
        "/api/trpc/document.publishDocument",
        true,
        false,
        "/api/trpc/document.publishDocument",
      ],
    ];

    for (const [start, authenticated, onboarded, landed] of cases) {
      const result = follow(start, authenticated, onboarded);
      assert.equal(result.landed, landed, start);
      const settled = decideAccess({
        pathname: result.landed,
        authenticated,
        onboarded,
      });
      assert.equal(settled.action, "allow", start);
    }
  });
});

describe("concurrent handle completion", () => {
  test("only one of two simultaneous claims keeps the handle", async () => {
    let store = createHandleStore();
    const locks = new Map<string, Promise<void>>();

    async function claimLocked(profileId: string, handle: string) {
      const key = handle.trim().toLowerCase();
      const previous = locks.get(key) ?? Promise.resolve();
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(
        key,
        previous.then(() => gate),
      );
      await previous;
      try {
        const result = claimHandle(store, profileId, handle);
        if (result.ok) store = result.store;
        return result;
      } finally {
        release();
      }
    }

    const [first, second] = await Promise.all([
      claimLocked("user-a", "ada"),
      claimLocked("user-b", "Ada"),
    ]);
    const winners = [first, second].filter((result) => result.ok);
    assert.equal(winners.length, 1);
    assert.equal(store.usernames.size, 1);
  });
});

describe("onboarding migration and procedure gate", () => {
  test("backfills valid profiles and refuses a client-written completion flag", () => {
    assert.match(
      migrationSql,
      /ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz/,
    );
    assert.match(
      migrationSql,
      /SET onboarding_completed_at = COALESCE\(updated_at, now\(\)\)/,
    );
    assert.match(migrationSql, /char_length\(btrim\(author_name\)\) <= 100/);
    assert.match(migrationSql, /reserved_handles/);
    assert.match(migrationSql, /Onboarding completion cannot be set directly/);
    assert.match(migrationSql, /Onboarding completion cannot be cleared/);
    assert.match(migrationSql, /Author name is required/);
    assert.match(migrationSql, /Handle is required/);
    assert.match(migrationSql, /set_config\('chptr\.onboarding_completion'/);
    assert.match(
      migrationSql,
      /GRANT EXECUTE ON FUNCTION public\.complete_author_onboarding/,
    );
    assert.match(migrationSql, /VALUES \('onboarding'\)/);
    const backfillAt = migrationSql.indexOf(
      "SET onboarding_completed_at = COALESCE",
    );
    const triggerAt = migrationSql.indexOf(
      "CREATE TRIGGER profiles_guard_onboarding",
    );
    assert.equal(backfillAt > 0 && backfillAt < triggerAt, true);

    const completeFn = migrationSql.slice(
      migrationSql.indexOf(
        "CREATE OR REPLACE FUNCTION public.complete_author_onboarding",
      ),
    );
    assert.match(completeFn, /AND onboarding_completed_at IS NULL/);
    const alreadyAt = completeFn.indexOf("Onboarding is already complete");
    const missingAt = completeFn.indexOf("Profile not found");
    assert.equal(alreadyAt > 0 && alreadyAt < missingAt, true);

    const completeHandler = authDb.slice(
      authDb.indexOf("export async function completeOnboarding"),
      authDb.indexOf("export async function acceptSuggestedAvatar"),
    );
    const forbiddenAt = completeHandler.indexOf('code: "FORBIDDEN"');
    const unauthenticatedAt = completeHandler.indexOf('error.code === "42501"');
    assert.equal(forbiddenAt > 0 && forbiddenAt < unauthenticatedAt, true);
  });

  test("private procedures require onboarding and identity procedures stay open", () => {
    assert.doesNotMatch(documentRouter, /\bprotectedProcedure\b/);
    assert.match(documentRouter, /onboardedProcedure/);
    assert.doesNotMatch(aiRouter, /\bprotectedProcedure\b/);
    assert.match(aiRouter, /onboardedProcedure/);

    assert.match(userRouter, /getCurrentUserProfile: protectedProcedure/);
    assert.match(userRouter, /checkUsernameAvailability: protectedProcedure/);
    assert.match(userRouter, /suggestHandle: protectedProcedure/);
    assert.match(userRouter, /updateAvatar: protectedProcedure/);
    assert.match(userRouter, /saveOnboardingProgress: protectedProcedure/);
    assert.match(userRouter, /completeOnboarding: protectedProcedure/);
    assert.match(userRouter, /acceptSuggestedAvatar: protectedProcedure/);
    assert.match(userRouter, /updateProfile: onboardedProcedure/);

    assert.match(connectRoute, /requireOnboardedPartykitUser/);
    assert.match(saveRoute, /requireOnboardedPartykitUser/);
  });
});
