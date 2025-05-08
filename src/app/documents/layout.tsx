import "~/styles/globals.css";
import { ThemeProvider } from "../_components/theme-provider";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { SidebarInset, SidebarTrigger } from "../_components/sidebar";
import { SidebarProvider } from "../_components/sidebar";
import { AppSidebar } from "../_components/app-sidebar";
import { Separator } from "../_components/separator";
import { Toaster } from "../_components/ui/toaster";
import { DocumentBreadcrumb } from "../_components/document-breadcrumb";
import { getTrpcCaller } from "~/utils/trpc-utils";
export const metadata: Metadata = {
    title: "Chptr",
    description: "A simple, elegant, and powerful note-taking app.",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
};

async function getDocuments() {
    const caller = await getTrpcCaller();
    const result = await caller.document.getDocumentIdsForAuthenticatedUser();
    return result.documents ?? [];
}

export default async function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const documents = await getDocuments();

    return (
        <TRPCReactProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <SidebarProvider
                    style={
                        {
                            "--sidebar-width": "19rem",
                        } as React.CSSProperties
                    }
                >
                    <AppSidebar initialDocuments={documents} />
                    <SidebarInset>
                        <div className="flex h-screen flex-col">
                            <header className="absolute top-0 left-0 right-0 flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-background/75 backdrop-blur-sm z-10">
                                <SidebarTrigger className="-ml-1" />
                                <Separator orientation="vertical" className="mr-2 h-4" />
                                <DocumentBreadcrumb />
                            </header>
                            <main className="flex-1 overflow-auto h-screen">
                                <div className="h-full md:p-8 lg:p-12">
                                    <div className="mx-auto max-w-5xl h-full pt-16">
                                        {children}
                                    </div>
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                    <Toaster />
                </SidebarProvider>
            </ThemeProvider>
        </TRPCReactProvider>
    );
}
