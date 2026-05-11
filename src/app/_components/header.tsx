"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "./separator";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { CommandMenuButton } from "./command-menu-button";
import { DocumentPublishButton } from "./document-publish-button";

export function Header() {
  const pathname = usePathname();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 rounded-t-2xl bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <SidebarTrigger className="-ml-1" />
        {isDocumentPage && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <DocumentBreadcrumb />
          </>
        )}
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
