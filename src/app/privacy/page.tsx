import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Chptr",
  description: "What Chptr stores when you join the early-access waitlist.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-sidebar px-6 sm:px-10 lg:px-12">
      <header className="mx-auto w-full max-w-7xl shrink-0 pt-6 lg:pt-8">
        <Link
          href="/"
          className="font-lora text-3xl font-medium tracking-tight"
        >
          Chptr
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 py-16 lg:py-24">
        <article className="max-w-xl">
          <h1 className="font-lora text-4xl font-medium tracking-tight">
            Privacy
          </h1>
          <div className="mt-8 space-y-5 leading-relaxed text-muted-foreground">
            <p>
              Chptr is in early access. This page covers the waitlist on this
              site.
            </p>
            <p>
              When you join the waitlist, we store the email address you enter
              and the time you signed up. We don&apos;t ask for anything else.
            </p>
            <p>
              We use your address to tell you when early access opens and to
              send news about Chptr&apos;s launch. We don&apos;t sell it or
              share it with advertisers.
            </p>
            <p>
              You can leave the list at any time. Reply to any email from us
              and we&apos;ll remove your address.
            </p>
          </div>
          <p className="mt-10 text-sm">
            <Link
              href="/"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to Chptr
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
