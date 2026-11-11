"use client";

import { useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  MoreVertical,
  PanelLeft,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import "~/app/_components/article/article.css";
import "./product-demo.css";

import { Button } from "~/app/_components/button";
import { renderCursor } from "~/app/_components/editor/cursor-renderer";
import { PublishedDocumentView } from "~/app/_components/published-document-view";
import { SaveFeedbackContent } from "~/app/_components/save-feedback-label";
import { cn } from "~/lib/utils";

import {
  DEMO_DOCUMENT,
  DEMO_FRAMES,
  DEMO_POSTER_INDEX,
  DEMO_PUBLISHED_FRAME,
  type DemoFrame,
} from "./demo-script";

/** Header controls match the editor's, as inert spans. */
const BAR_CONTROL_CLASS =
  "h-8 shrink-0 gap-1 rounded-md px-2 py-1 text-sm font-medium shadow-none [&_svg]:size-3.5";

/**
 * How much of the demo must be on screen before it plays. On a phone the card
 * starts as a sliver at the bottom of the first screen, and the loop should
 * wait until someone scrolls to it.
 */
const PLAY_VISIBLE_RATIO = 0.4;

/**
 * Steps through the script. Stops while the demo is off screen or the tab is
 * in the background, and holds on a still when motion is reduced.
 */
function useDemoFrame(target: RefObject<HTMLElement>): DemoFrame {
  const reduceMotion = useReducedMotion() === true;
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(true);

  const playing = !reduceMotion && onScreen;
  const frame =
    DEMO_FRAMES[reduceMotion ? DEMO_POSTER_INDEX : index] ?? DEMO_FRAMES[0]!;

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    let intersecting = true;
    const update = () =>
      setOnScreen(intersecting && document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry
          ? entry.intersectionRatio >= PLAY_VISIBLE_RATIO
          : true;
        update();
      },
      { threshold: PLAY_VISIBLE_RATIO },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [target]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(
      () => setIndex((current) => (current + 1) % DEMO_FRAMES.length),
      frame.hold,
    );
    return () => window.clearTimeout(id);
  }, [frame, playing]);

  return frame;
}

function CollaboratorCursor() {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    hostRef.current?.replaceChildren(renderCursor(DEMO_DOCUMENT.collaborator));
  }, []);

  return <span ref={hostRef} className="landing-demo-collaborator" />;
}

function EditedParagraph({ frame }: { frame: DemoFrame }) {
  const { before, original, revised, after } = DEMO_DOCUMENT.edited;
  const cursor = frame.collaborator ? <CollaboratorCursor key="cursor" /> : null;

  return (
    <p>
      {before}
      {frame.edit === "original" ? (
        original
      ) : frame.edit === "selected" ? (
        <span
          className="rounded-[2px]"
          style={{ backgroundColor: `${DEMO_DOCUMENT.collaborator.color}47` }}
        >
          {original}
        </span>
      ) : (
        revised.slice(0, frame.edit)
      )}
      {cursor}
      {after}
    </p>
  );
}

/** Same wrapper and block classes as the published article body. */
function DemoBody({ frame }: { frame: DemoFrame }) {
  return (
    <div className="published-document text-base leading-relaxed lg:text-[1.05rem]">
      <div className="article-block">
        <p>{DEMO_DOCUMENT.opening}</p>
      </div>
      <div className="article-block">
        <EditedParagraph frame={frame} />
      </div>
      <div className="article-block">
        <p className="min-h-[1.625em]">
          {DEMO_DOCUMENT.typed.slice(0, frame.typed)}
          {frame.mode === "editor" ? (
            <span className="landing-demo-caret" />
          ) : null}
        </p>
      </div>
    </div>
  );
}

function PublishControl({ state }: { state: DemoFrame["publish"] }) {
  const label =
    state === "saving"
      ? "Publishing"
      : state === "saved"
        ? "Published"
        : "Publish";
  const Icon = state === "saving" ? Loader2 : state === "saved" ? Check : Globe;

  return (
    <div className="relative inline-flex shrink-0 lg:mr-2">
      {/* Resting labels set the width, as in the editor's publish button. */}
      <span className="invisible inline-flex h-8 items-center gap-1 px-2 py-1 text-sm font-medium">
        <span className="size-3.5 shrink-0" />
        <span className="grid justify-items-start">
          <span className="col-start-1 row-start-1 whitespace-nowrap">
            Publish
          </span>
          <span className="col-start-1 row-start-1 whitespace-nowrap">
            Published
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0" />
      </span>
      <Button
        asChild
        variant="ghost"
        className={cn(
          BAR_CONTROL_CLASS,
          "absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap",
          "transition-[color,background-color] duration-200 ease-out",
          state === "pressed" && "bg-accent text-accent-foreground",
        )}
      >
        <span>
          <SaveFeedbackContent motionKey={label} contentClassName="gap-1">
            <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
              <Icon className={cn(state === "saving" && "animate-spin")} />
            </span>
            <span className="whitespace-nowrap">{label}</span>
          </SaveFeedbackContent>
          <ChevronDown />
        </span>
      </Button>
    </div>
  );
}

/**
 * The editor's header. While the demo is stacked (below lg) it keeps only the
 * title and Publish, lined up with the document text. Beside the hero it shows
 * the full editor chrome.
 */
function EditorBar({ frame }: { frame: DemoFrame }) {
  // The loop resets while the stage is faded out. Remounting the control there
  // puts "Publish" back at once; left mounted, its swap from "Published" was
  // still on screen for the first second of the next loop.
  const resetting = frame.hidden && frame.mode === "editor";

  return (
    <div className="landing-demo-bar absolute inset-x-0 top-0 z-10 flex h-[3.25rem] items-center justify-between gap-2 bg-background px-[var(--landing-demo-inset)] lg:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="hidden h-7 w-7 lg:inline-flex"
        >
          <span>
            <PanelLeft />
          </span>
        </Button>
        <span className="min-w-0 truncate py-1 text-sm font-semibold lg:px-2">
          {DEMO_DOCUMENT.title}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          asChild
          variant="ghost"
          className={cn(BAR_CONTROL_CLASS, "hidden lg:inline-flex")}
        >
          <span>
            <BookOpen />
            Preview
          </span>
        </Button>
        <PublishControl
          key={resetting ? "reset" : "live"}
          state={frame.publish}
        />
        <Button
          asChild
          variant="ghost"
          className={cn(
            BAR_CONTROL_CLASS,
            "hidden leading-none lg:inline-flex",
          )}
        >
          <span>Aa</span>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 lg:inline-flex"
        >
          <span>
            <MoreVertical />
          </span>
        </Button>
      </div>
    </div>
  );
}

/** The document at one frame, in the published article's own markup. */
function DemoArticle({ frame }: { frame: DemoFrame }) {
  return (
    <PublishedDocumentView
      embedded
      compact
      title={DEMO_DOCUMENT.title}
      font={DEMO_DOCUMENT.font}
      ownerUsername={DEMO_DOCUMENT.author.username}
      publishedAt={DEMO_DOCUMENT.publishedAt}
      authorProfile={DEMO_DOCUMENT.author}
      avatarClassName="h-10 w-10 lg:h-12 lg:w-12"
      className="landing-demo-article min-h-0"
    >
      <DemoBody frame={frame} />
    </PublishedDocumentView>
  );
}

/**
 * Looping walkthrough: a draft is written, a collaborator makes one edit, and
 * the document is published. Scripted sample content only.
 */
export function ProductDemo({ className }: { className?: string }) {
  const figureRef = useRef<HTMLElement>(null);
  const frame = useDemoFrame(figureRef);

  return (
    <figure
      ref={figureRef}
      className={cn(
        "landing-demo min-w-0 lg:flex lg:flex-col lg:pt-[clamp(6rem,15dvh,10rem)]",
        className,
      )}
      data-mode={frame.mode}
      data-hidden={frame.hidden ? "" : undefined}
    >
      {/*
       * A card under the hero on small screens. Beside the hero it is a sheet
       * that runs off the bottom of the page, like the onboarding preview.
       */}
      <div
        role="img"
        aria-label="The Chptr editor: a draft is written, a collaborator makes an edit, and the document is published as an article."
        className="pointer-events-none relative select-none overflow-hidden rounded-xl border bg-background shadow-sm lg:min-h-[24rem] lg:flex-1 lg:rounded-b-none lg:rounded-t-2xl lg:border-b-0 lg:shadow-[0_8px_32px_rgba(0,0,0,0.12)] lg:dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      >
        {/*
         * Gives the card its height: an unseen copy of the finished article.
         * The card fits the whole document at any phone width, and the page
         * below it holds still while the demo types and publishes.
         */}
        <div aria-hidden className="invisible lg:hidden">
          <DemoArticle frame={DEMO_PUBLISHED_FRAME} />
        </div>
        <div className="landing-demo-stage absolute inset-0">
          <EditorBar frame={frame} />
          <DemoArticle frame={frame} />
        </div>
      </div>
    </figure>
  );
}
