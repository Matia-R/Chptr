import "~/styles/globals.css";
import { ThemeProvider } from "../_components/theme-provider";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

import { TRPCReactProvider } from "~/trpc/react";
import { SidebarInset, SidebarTrigger } from "../_components/sidebar";
import { BreadcrumbItem, BreadcrumbLink } from "../_components/breadcrumb";
import { SidebarProvider } from "../_components/sidebar";
import { BreadcrumbList } from "../_components/breadcrumb";
import { Breadcrumb } from "../_components/breadcrumb";
import { AppSidebar } from "../_components/app-sidebar";
import { Separator } from "../_components/separator";

export const metadata: Metadata = {
    title: "Chptr",
    description: "A simple, elegant, and powerful note-taking app.",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
};

async function getDocuments() {

    // TODO: Look at a better way to handle this header stuff without all the boilerplate - at least move it into a helper function

    const headersList = await headers();
    const heads = new Headers();
    for (const [key, value] of headersList.entries()) {
        heads.set(key, value);
    }
    heads.set("x-trpc-source", "rsc");
    const context = await createTRPCContext({ headers: heads });
    const caller = createCaller(context);
    const result = await caller.document.getDocumentsForAuthenticatedUser();
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
                    <AppSidebar documents={documents} />
                    <SidebarInset>
                        <div className="flex h-screen flex-col">
                            <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-background">
                                <SidebarTrigger className="-ml-1" />
                                <Separator orientation="vertical" className="mr-2 h-4" />
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItem className="hidden md:block">
                                            <BreadcrumbLink href="#">
                                                Building Your Application
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                    </BreadcrumbList>
                                </Breadcrumb>
                            </header>
                            <main className="flex-1 overflow-auto">
                                <div className="md:p-8 lg:p-12">
                                    <div className="mx-auto max-w-5xl">
                                        {children}
                                    </div>
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </ThemeProvider>
        </TRPCReactProvider>
    );
}
