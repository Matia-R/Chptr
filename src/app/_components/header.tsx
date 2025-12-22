"use client";

import { usePathname } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "./separator";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { AvatarGroup } from "./avatar-group";
import { useFocusMode } from "./focus-mode-context";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

interface HeaderProps {
  isScrolled?: boolean;
}

export function Header({ isScrolled = false }: HeaderProps) {
  const pathname = usePathname();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";
  const { isFocusMode, setIsFocusMode } = useFocusMode();

  return (
    <>
      {/* Backdrop gradient to mute content behind header */}
      {/* <div className="pointer-events-none absolute left-0 right-0 top-0 z-[9] h-16 bg-gradient-to-b from-background via-background/90 to-transparent" /> */}
      <header
        className={cn(
          "absolute left-4 right-4 z-10 mx-auto flex h-14 shrink-0 items-center justify-between gap-2 rounded-2xl border border-transparent px-4 py-3 transition-all duration-200 ease-linear",
          isScrolled ? "border-border bg-sidebar shadow-lg" : "bg-transparent",
          isFocusMode ? "-translate-y-[calc(100%+1rem)]" : "top-4",
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
        <div className="ml-auto flex min-w-0 flex-shrink-0 items-center gap-2">
          {/* <AvatarGroup
            avatars={[
              { initials: "AB" },
              { initials: "CD" },
              { initials: "EF" },
              { initials: "GH" },
            ]}
            borderColor={isScrolled ? "sidebar" : "background"}
          /> */}
          {/* <CommandMenuButton /> */}
          {isDocumentPage && <DocumentActions />}
          {isDocumentPage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsFocusMode(true)}
              title="Enter focus mode"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>
      {/* Exit focus mode button - appears when header is hidden */}
      {isFocusMode && (
        <div className="absolute left-4 right-4 top-4 z-10 mx-auto flex h-14 items-center justify-end gap-2 px-4">
          {isDocumentPage && (
            <div className="opacity-50 hover:opacity-100">
              <DocumentActions />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-50 hover:opacity-100"
            onClick={() => setIsFocusMode(false)}
            title="Exit focus mode"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
