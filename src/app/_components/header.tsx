'use client'

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "./sidebar"
import { Separator } from "./separator"
import { DocumentBreadcrumb } from "./document-breadcrumb"
import { DocumentActions } from "./document-actions"
import { CommandMenuButton } from "./command-menu-button"

export function Header() {
    const pathname = usePathname();
    const isDocumentPage = pathname.startsWith('/documents/') && pathname !== '/documents';

    return (
        <header className="absolute top-0 left-0 right-0 h-12 flex shrink-0 items-center justify-between gap-2 px-4 border-b bg-background/75 backdrop-blur-md z-10">
            <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="-ml-1" />
                {isDocumentPage && (
                    <>
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <DocumentBreadcrumb />
                    </>
                )}
            </div>
            <div className="ml-auto px-3 flex items-center gap-2 min-w-[110px] flex-shrink-0">
                <CommandMenuButton />
                {isDocumentPage && <DocumentActions />}
            </div>
        </header>
    );
} 