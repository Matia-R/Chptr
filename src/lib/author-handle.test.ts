import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  RESERVED_HANDLES,
  backfillAuthorName,
  backfillUsernamesFromPublications,
  claimHandle,
  createHandleStore,
  enumerateHandleCandidates,
  suggestedHandleFromAuthorName,
  suggestHandles,
  validateHandleFormat,
} from "./author-handle.ts";

const migrationSql = readFileSync(
  new URL(
    "../../migrations/profiles_author_name_and_handles.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("author name backfill", () => {
  test("joins trimmed first and last names", () => {
    assert.equal(
      backfillAuthorName({
        firstName: "  Ada ",
        lastName: " Lovelace  ",
        username: "ada",
      }),
      "Ada Lovelace",
    );
  });

  test("falls back to username when both names are blank", () => {
    assert.equal(
      backfillAuthorName({
        firstName: "  ",
        lastName: null,
        username: " ada ",
      }),
      "ada",
    );
  });

  test("keeps an existing author name and leaves empty profiles empty", () => {
    assert.equal(
      backfillAuthorName({
        authorName: " Pen Name ",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
      "Pen Name",
    );
    assert.equal(
      backfillAuthorName({ firstName: " ", lastName: "", username: " " }),
      null,
    );
  });
});

describe("username backfill from publications", () => {
  test("adopts the latest publication segment when the profile has no handle", () => {
    const assigned = backfillUsernamesFromPublications({
      profiles: [
        { id: "a", username: null },
        { id: "b", username: "kept" },
      ],
      publications: [
        { creatorId: "a", ownerUsername: "old", updatedAt: "2020-01-01" },
        {
          creatorId: "a",
          ownerUsername: "adalovelace",
          updatedAt: "2024-01-01",
        },
      ],
    });
    assert.deepEqual(assigned, [{ id: "a", username: "adalovelace" }]);
  });

  test("does not give one historical segment to two profiles", () => {
    const assigned = backfillUsernamesFromPublications({
      profiles: [
        { id: "b", username: null },
        { id: "a", username: null },
      ],
      publications: [
        { creatorId: "a", ownerUsername: "shared", updatedAt: "2024-01-01" },
        { creatorId: "b", ownerUsername: "shared", updatedAt: "2024-06-01" },
      ],
    });
    assert.deepEqual(assigned, [{ id: "a", username: "shared" }]);
  });

  test("leaves a segment that another profile already owns", () => {
    const assigned = backfillUsernamesFromPublications({
      profiles: [
        { id: "owner", username: "Ada" },
        { id: "other", username: null },
      ],
      publications: [
        { creatorId: "other", ownerUsername: "ada", updatedAt: "2024-01-01" },
      ],
    });
    assert.deepEqual(assigned, []);
  });
});

describe("suggested handles", () => {
  test("normalizes an author name and skips reserved routes and collisions", () => {
    assert.deepEqual(
      suggestHandles("Ada Lovelace", () => false),
      ["ada-lovelace"],
    );
    assert.deepEqual(
      suggestHandles("Login", (handle) => handle === "login-2"),
      ["login-3"],
    );
    assert.deepEqual(enumerateHandleCandidates("API", 2), ["api-2", "api-3"]);
    assert.deepEqual(
      suggestHandles("A", () => false),
      ["a-2"],
    );
    assert.equal(validateHandleFormat("Login").ok, false);
    assert.equal(suggestedHandleFromAuthorName("Ada Lovelace"), "ada-lovelace");
    assert.equal(suggestedHandleFromAuthorName("A"), "a-2");
    assert.equal(suggestedHandleFromAuthorName("   "), "");
  });
});

describe("concurrent handle claims", () => {
  test("one of two racers wins the same handle and the loser is rejected", async () => {
    let store = createHandleStore();
    const locks = new Map<string, Promise<void>>();

    async function claimLocked(profileId: string, handle: string) {
      const key = handle.trim().toLowerCase();
      const previous = locks.get(key) ?? Promise.resolve();
      let release: () => void = () => {};
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
      claimLocked("user-a", "Ada"),
      claimLocked("user-b", "ada"),
    ]);

    const winners = [first, second].filter((result) => result.ok);
    const losers = [first, second].filter((result) => !result.ok);
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.equal(losers[0]?.ok, false);
    if (!losers[0]?.ok) assert.equal(losers[0].reason, "taken");
    assert.equal(store.usernames.get("ada") !== undefined, true);
    assert.equal(store.usernames.size, 1);
  });

  test("changing a handle reserves it so a later claim fails", () => {
    const initial = claimHandle(createHandleStore(), "user-a", "ada");
    assert.equal(initial.ok, true);
    if (!initial.ok) return;

    const renamed = claimHandle(initial.store, "user-a", "ada-lovelace");
    assert.equal(renamed.ok, true);
    if (!renamed.ok) return;
    assert.equal(renamed.store.reservations.get("ada"), "user-a");

    const stolen = claimHandle(renamed.store, "user-b", "ada");
    assert.equal(stolen.ok, false);
    if (!stolen.ok) assert.equal(stolen.reason, "reserved");

    const reclaimed = claimHandle(renamed.store, "user-a", "ADA");
    assert.equal(reclaimed.ok, true);
    if (!reclaimed.ok) return;
    assert.equal(reclaimed.store.usernames.get("ada"), "user-a");
    assert.equal(reclaimed.store.reservations.has("ada"), false);
    assert.equal(reclaimed.store.reservations.get("ada-lovelace"), "user-a");
  });

  test("rejects reserved app routes", () => {
    for (const route of RESERVED_HANDLES) {
      const result = claimHandle(createHandleStore(), "user-a", route);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "reserved");
    }
  });
});

describe("migration sql", () => {
  test("adds author_name, keeps legacy name columns, and reserves historical handles", () => {
    assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS author_name text/);
    assert.doesNotMatch(
      migrationSql,
      /DROP COLUMN\s+(IF EXISTS\s+)?(first_name|last_name)/i,
    );
    assert.match(migrationSql, /concat_ws/);
    assert.match(migrationSql, /profile_handle_reservations/);
    assert.match(migrationSql, /document_publication_redirects/);
    assert.match(migrationSql, /pg_advisory_xact_lock/);
    assert.match(migrationSql, /meta_username := NULLIF/);
  });

  test("reserves the same routes the app refuses", () => {
    const listed = [...migrationSql.matchAll(/\('([a-z0-9-]+)'\)/g)].map(
      (match) => match[1],
    );
    for (const handle of RESERVED_HANDLES) {
      assert.equal(listed.includes(handle), true, handle);
    }
  });
});
