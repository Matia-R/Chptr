import Link from "next/link";

import { Button } from "~/app/_components/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold">Chptr</h1>
        <p className="mb-8 text-muted-foreground">
          This page is a work in progress. Check back soon — or head to login to
          get started.
        </p>
        <Button asChild className="w-full py-2 text-sm font-medium">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    </main>
  );
}
