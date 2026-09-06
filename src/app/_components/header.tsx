"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { DocumentPublishButton } from "./document-publish-button";
import { SAVE_FEEDBACK_CONTENT_TRANSITION } from "./save-feedback-label";
import { useBrowserOffline } from "~/hooks/use-browser-offline";

export function Header() {
  const pathname = usePathname();
  const isOffline = useBrowserOffline();
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  return (
    <header
      data-app-header
      className="z-10 flex h-12 shrink-0 items-center justify-between gap-2 bg-background px-4 max-md:fixed max-md:inset-x-0 max-md:top-0 md:relative md:rounded-t-2xl"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger />
        {isDocumentPage ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <DocumentBreadcrumb />
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex h-8 flex-shrink-0 items-center gap-2">
        {isDocumentPage ? (
          <AnimatePresence mode="wait" initial={false}>
            {isOffline ? null : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
                className="flex items-center gap-2"
              >
                <div className="hidden shrink-0 md:flex md:items-center">
                  <DocumentPublishButton key={pathname} />
                </div>
                <DocumentActions />
              </motion.div>
            )}
          </AnimatePresence>
        ) : null}
      </div>
    </header>
  );
}
