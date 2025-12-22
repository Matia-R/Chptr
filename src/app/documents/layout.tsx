import "~/styles/globals.css";
import { ThemeProvider } from "../_components/theme-provider";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { SidebarInset } from "../_components/sidebar";
import { SidebarProvider } from "../_components/sidebar";
import { AppSidebar } from "../_components/app-sidebar";
import { Toaster } from "../_components/ui/toaster";
import { getTrpcCaller } from "~/utils/trpc-utils";
import { CommandMenu } from "../_components/command-menu";
import { DocumentLayoutWrapper } from "../_components/document-layout-wrapper";
import { HeaderWrapper } from "../_components/header-wrapper";
import { ScrollProvider } from "../_components/scroll-context";

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
                <ScrollProvider>
                    <SidebarProvider
                        style={
                            {
                                "--sidebar-width": "19rem",
                            } as React.CSSProperties
                        }
                    >
                        <HeaderWrapper />
                        <AppSidebar initialDocuments={documents} />
                        <SidebarInset>
                            <DocumentLayoutWrapper>
                                {children}
                            </DocumentLayoutWrapper>
                        </SidebarInset>
                        <Toaster />
                    </SidebarProvider>
                </ScrollProvider>
                <CommandMenu />
            </ThemeProvider>
        </TRPCReactProvider>
    );
}
