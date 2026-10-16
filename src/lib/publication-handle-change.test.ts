import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { planOwnerHandleChange } from "./publication-handle-change.ts";

describe("handle change redirects", () => {
  test("moves each published path and keeps the slug", () => {
    const plan = planOwnerHandleChange({
      publications: [
        { documentId: "doc-1", ownerUsername: "ada", slug: "notes" },
        { documentId: "doc-2", ownerUsername: "ada", slug: "essay" },
      ],
      nextOwnerUsername: "ada-lovelace",
      blockingRedirects: [],
    });

    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.deepEqual(plan.moves, [
      {
        documentId: "doc-1",
        fromOwnerUsername: "ada",
        fromSlug: "notes",
        toOwnerUsername: "ada-lovelace",
        toSlug: "notes",
      },
      {
        documentId: "doc-2",
        fromOwnerUsername: "ada",
        fromSlug: "essay",
        toOwnerUsername: "ada-lovelace",
        toSlug: "essay",
      },
    ]);
  });

  test("leaves paths that already use the new handle", () => {
    const plan = planOwnerHandleChange({
      publications: [
        { documentId: "doc-1", ownerUsername: "ada", slug: "notes" },
      ],
      nextOwnerUsername: "ada",
      blockingRedirects: [],
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.deepEqual(plan.moves, []);
  });

  test("refuses a slug reserved by another document's redirect", () => {
    const plan = planOwnerHandleChange({
      publications: [
        { documentId: "doc-1", ownerUsername: "ada", slug: "notes" },
      ],
      nextOwnerUsername: "ada-lovelace",
      blockingRedirects: [{ documentId: "doc-9", slug: "notes" }],
    });
    assert.deepEqual(plan, {
      ok: false,
      reason: "slug-conflict",
      slug: "notes",
    });
  });

  test("allows a redirect that already belongs to the same document", () => {
    const plan = planOwnerHandleChange({
      publications: [
        { documentId: "doc-1", ownerUsername: "ada", slug: "notes" },
      ],
      nextOwnerUsername: "ada-lovelace",
      blockingRedirects: [{ documentId: "doc-1", slug: "notes" }],
    });
    assert.equal(plan.ok, true);
  });

  test("refuses two documents that would share a slug after the move", () => {
    const plan = planOwnerHandleChange({
      publications: [
        { documentId: "doc-1", ownerUsername: "ada", slug: "notes" },
        { documentId: "doc-2", ownerUsername: "old", slug: "notes" },
      ],
      nextOwnerUsername: "ada-lovelace",
      blockingRedirects: [],
    });
    assert.deepEqual(plan, {
      ok: false,
      reason: "slug-conflict",
      slug: "notes",
    });
  });
});
