import type { Metadata } from "next";
import Link from "next/link";

import { ProductDemo } from "./_landing/product-demo";
import { WaitlistForm } from "./_landing/waitlist-form";

const DESCRIPTION =
  "A beautiful place to create, refine, and share your ideas.";

export const metadata: Metadata = {
  title: "Chptr — Your space to write and publish",
  description: DESCRIPTION,
  openGraph: {
    title: "Chptr — Your space to write and publish",
    description: DESCRIPTION,
    type: "website",
    url: "/",
  },
};

export default function Home() {
  return (
    /*
     * Stacked on small screens. From lg this is a four-column grid: a margin,
     * the hero, and two columns for the demo. The margins keep the hero on the
     * left edge of a centred 80rem block. The demo's columns run from the hero
     * to the right edge of the page, and the demo is centred in them, so the
     * space on either side of it stays equal.
     */
    <div className="flex min-h-dvh flex-col bg-sidebar px-6 sm:px-10 lg:grid lg:grid-cols-[minmax(3rem,1fr)_23rem_minmax(0,57rem)_minmax(3rem,1fr)] lg:grid-rows-[auto_1fr_auto] lg:px-0 xl:grid-cols-[minmax(3rem,1fr)_26rem_minmax(0,54rem)_minmax(3rem,1fr)]">
      <header className="shrink-0 pt-5 lg:col-start-2 lg:row-start-1 lg:pt-8">
        <p className="font-lora text-3xl font-medium tracking-tight">Chptr</p>
      </header>

      {/*
       * Mobile keeps justify-start so free space cannot open under the logo.
       * Desktop uses lg:contents and ignores this flex context.
       */}
      <main className="flex flex-1 flex-col justify-start gap-10 pb-10 pt-6 sm:gap-14 sm:pb-12 sm:pt-12 lg:contents">
        <section className="max-w-xl lg:col-start-2 lg:row-start-2 lg:self-center lg:py-10">
          <h1 className="text-balance font-lora text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl xl:leading-[1.02]">
            Your space to write and publish.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            {DESCRIPTION}
          </p>
          <div className="mt-6 max-w-md sm:mt-10">
            <WaitlistForm />
          </div>
        </section>

        {/* 48rem wide when it fits. Narrower, it keeps 5vw clear on each side. */}
        <ProductDemo className="lg:col-span-2 lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:w-[min(48rem,100%_-_10vw)] lg:justify-self-center" />
      </main>

      <footer className="flex shrink-0 items-center justify-between pb-6 text-xs text-muted-foreground lg:col-start-2 lg:row-start-3 lg:justify-start lg:gap-6">
        <p>© {new Date().getFullYear()} Chptr</p>
        <Link
          href="/privacy"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy
        </Link>
      </footer>
    </div>
  );
}
