"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "./sidebar";
import { DocumentBreadcrumb } from "./document-breadcrumb";
import { DocumentActions } from "./document-actions";
import { DocumentPublishButton } from "./document-publish-button";
import { SAVE_FEEDBACK_CONTENT_TRANSITION } from "./save-feedback-label";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useDocumentUnavailableStore } from "~/hooks/use-document-unavailable";

export function Header() {
  const pathname = usePathname();
  const isOffline = useBrowserOffline();
  const isUnavailable = useDocumentUnavailableStore(
    (state) => state.isUnavailable,
  );
  const isDocumentPage =
    pathname.startsWith("/documents/") && pathname !== "/documents";
  const showDocumentChrome = isDocumentPage && !isUnavailable;

  return (
    <header
      data-app-header
      className="z-10 flex h-12 shrink-0 items-center justify-between gap-2 bg-background px-4 max-md:fixed max-md:inset-x-0 max-md:top-0 md:relative md:rounded-t-2xl"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger />
        {showDocumentChrome ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <DocumentBreadcrumb />
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex h-8 flex-shrink-0 items-center gap-2">
        {showDocumentChrome ? (
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
