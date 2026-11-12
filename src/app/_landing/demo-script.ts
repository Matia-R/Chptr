import { SAVE_FEEDBACK_SETTLE_MS } from "~/hooks/use-save-feedback";
import { getAvatarColorHex } from "~/lib/avatar-colors";

/**
 * Sample document and the frame-by-frame script for the landing-page demo.
 * Nothing here touches a real document or a live session.
 */
export const DEMO_DOCUMENT = {
  title: "The Quiet Hours",
  font: "lora",
  publishedAt: "2026-11-05T10:00:00.000Z",
  author: {
    username: "elena",
    author_name: "Elena Marsh",
    avatar_url: null,
    default_avatar_background_color: "yellow",
  },
  collaborator: { name: "Theo", color: getAvatarColorHex("indigo") },
  opening:
    "There is a particular kind of silence before the day begins. The kettle hums, the window brightens, and for a little while nothing is asked of you.",
  /** The collaborator swaps `original` for `revised`. */
  edited: {
    before: "I started writing in that hour ",
    original: "years ago",
    revised: "last winter",
    after: ". Not to finish anything, only to find out what I think.",
  },
  /** Typed by the author while the demo plays. */
  typed:
    "Most mornings, a page is enough. Some mornings it turns into something worth sharing.",
  /**
   * Extra body copy shown beside the hero. Hidden on the stacked mobile card
   * so the preview stays a manageable height.
   */
  continuation: [
    "The hard part is not finding the words. It is leaving the rest of the day outside the room long enough to hear them arrive.",
    "When a draft finally feels finished, publishing it is less a launch than a quiet handoff: the page leaves your desk and goes looking for a reader.",
  ],
} as const;

type DemoState = {
  /** The editor, or the same document as its published article. */
  mode: "editor" | "published";
  /** Characters of `typed` on the page. */
  typed: number;
  /** Collaborator cursor is in the document. */
  collaborator: boolean;
  /** A number is how many characters of `revised` have replaced `original`. */
  edit: "original" | "selected" | number;
  publish: "idle" | "pressed" | "saving" | "saved";
  /** Faded out while the loop resets. */
  hidden: boolean;
};

export type DemoFrame = DemoState & {
  /** Milliseconds before the next frame. */
  hold: number;
};

const INITIAL: DemoState = {
  mode: "editor",
  typed: 0,
  collaborator: false,
  edit: "original",
  publish: "idle",
  hidden: false,
};

/** Uneven keystrokes, with a breath after punctuation. No randomness, so every loop matches. */
function keystrokeDelay(text: string, index: number): number {
  const previous = text[index - 1];
  const pause = previous === "," ? 150 : previous === "." ? 380 : 0;
  return 40 + ((index * 7) % 5) * 7 + pause;
}

function buildFrames(): { frames: DemoFrame[]; posterIndex: number } {
  const { typed, edited } = DEMO_DOCUMENT;
  const events: { at: number; patch: Partial<DemoState> }[] = [];
  const at = (time: number, patch: Partial<DemoState>) =>
    events.push({ at: time, patch });

  const typeAuthor = (from: number, to: number, start: number) => {
    let time = start;
    for (let index = from; index < to; index++) {
      time += keystrokeDelay(typed, index);
      at(time, { typed: index + 1 });
    }
    return time;
  };

  // The author writes the first sentence alone.
  const firstSentenceEnd = typed.indexOf(".") + 1;
  const firstDone = typeAuthor(0, firstSentenceEnd, 900);

  // A collaborator joins and fixes a phrase while the author keeps writing.
  const arrives = firstDone + 500;
  at(arrives, { collaborator: true });
  at(arrives + 700, { edit: "selected" });
  let collaboratorTime = arrives + 1350;
  at(collaboratorTime, { edit: 0 });
  for (let index = 0; index < edited.revised.length; index++) {
    collaboratorTime += 62 + ((index * 5) % 4) * 9;
    at(collaboratorTime, { edit: index + 1 });
  }

  const authorDone = typeAuthor(firstSentenceEnd, typed.length, arrives + 250);
  const leaves = Math.max(authorDone, collaboratorTime) + 900;
  at(leaves, { collaborator: false });

  // Publish, then the editor becomes the article.
  const pressed = leaves + 800;
  at(pressed, { publish: "pressed" });
  at(pressed + 260, { publish: "saving" });
  const saved = pressed + 260 + 1100;
  at(saved, { publish: "saved" });
  const published = saved + SAVE_FEEDBACK_SETTLE_MS;
  at(published, { mode: "published" });

  // Hold on the article, fade out, and reset unseen.
  const fadeOut = published + 5200;
  at(fadeOut, { hidden: true });
  const reset = fadeOut + 450;
  at(reset, { ...INITIAL, hidden: true });
  const end = reset + 150;

  events.sort((a, b) => a.at - b.at);

  const frames: DemoFrame[] = [];
  let state = INITIAL;
  let time = 0;
  for (const event of events) {
    if (event.at > time) {
      frames.push({ ...state, hold: event.at - time });
      time = event.at;
    }
    state = { ...state, ...event.patch };
  }
  frames.push({ ...state, hold: end - time });

  // Everything written, collaborator still present: the still shown when motion is reduced.
  let posterIndex = 0;
  frames.forEach((frame, index) => {
    if (frame.collaborator && frame.typed === typed.length) posterIndex = index;
  });

  return { frames, posterIndex };
}

const built = buildFrames();

export const DEMO_FRAMES = built.frames;
export const DEMO_POSTER_INDEX = built.posterIndex;
/** The finished article, the tallest the document gets. */
export const DEMO_PUBLISHED_FRAME =
  built.frames.find((frame) => frame.mode === "published" && !frame.hidden) ??
  built.frames[0]!;
