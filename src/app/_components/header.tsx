"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "./separator";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { CommandMenuButton } from "./command-menu-button";
import { cn } from "~/lib/utils";

interface HeaderProps {
  isScrolled?: boolean;
}

export function Header({ isScrolled = false }: HeaderProps) {
  const pathname = usePathname();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  return (
    <>
      {/* Backdrop gradient to mute content behind header */}
      {/* <div className="pointer-events-none absolute left-0 right-0 top-0 z-[9] h-16 bg-gradient-to-b from-background via-background/90 to-transparent" /> */}
      <header
        className={cn(
          "absolute left-4 right-4 top-4 z-10 mx-auto flex h-14 shrink-0 items-center justify-between gap-2 rounded-2xl border border-transparent px-4 py-3 transition-colors",
          isScrolled ? "border-border bg-sidebar shadow-lg" : "bg-background",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          {isDocumentPage && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <DocumentBreadcrumb />
            </>
          )}
        </div>
        <div className="ml-auto flex min-w-[110px] flex-shrink-0 items-center gap-2">
          <CommandMenuButton />
          {isDocumentPage && <DocumentActions />}
        </div>
      </header>
    </>
  );
}
