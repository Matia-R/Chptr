"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { DocumentPublishButton } from "./document-publish-button";

export function Header() {
  const pathname = usePathname();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  return (
    <header className="z-10 flex h-12 shrink-0 items-center justify-between gap-2 bg-background px-4 max-md:absolute max-md:inset-x-0 max-md:top-0 md:relative md:rounded-t-2xl">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger />
        {isDocumentPage ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <DocumentBreadcrumb />
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {isDocumentPage ? (
          <>
            {/* CSS breakpoint only — avoids flash: JS viewport hooks default "desktop" until effect runs */}
            <div className="hidden shrink-0 md:flex md:items-center">
              <DocumentPublishButton />
            </div>
            <DocumentActions />
          </>
        ) : null}
        {/* <CommandMenuButton /> */}
      </div>
    </header>
  );
}
