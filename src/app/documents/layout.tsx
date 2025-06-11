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
import { Header } from "../_components/header";

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
                        <div className="flex h-screen flex-col min-w-0">
                            <Header />
                            <main className="flex-1 overflow-auto h-screen">
                                <div className="h-full md:p-8 lg:p-12">
                                    <div className="mx-auto max-w-5xl h-full pt-16 min-w-0">
                                        {children}
                                    </div>
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                    <Toaster />
                </SidebarProvider>
                <CommandMenu />
            </ThemeProvider>
        </TRPCReactProvider>
    );
}
