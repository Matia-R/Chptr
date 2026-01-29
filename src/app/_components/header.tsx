"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "./separator";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { CommandMenuButton } from "./command-menu-button";

export function Header() {
  const pathname = usePathname();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 rounded-t-2xl bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        {isDocumentPage && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <DocumentBreadcrumb />
          </>
        )}
      </div>
      <div className="ml-auto flex min-w-[110px] flex-shrink-0 items-center gap-2 px-3">
        <CommandMenuButton />
        {isDocumentPage && <DocumentActions />}
      </div>
    </header>
  );
}
