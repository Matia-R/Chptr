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
  icons: [
    {
      rel: "icon",
      url: "/light_favicon.ico",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      url: "/dark_favicon.ico",
      media: "(prefers-color-scheme: dark)",
    },
  ],
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
        // style={
        //     {
        //         "--sidebar-width": "19rem",
        //     } as React.CSSProperties
        // }
        >
          <AppSidebar initialDocuments={documents} />
          <SidebarInset>
            <div className="flex h-screen min-w-0 flex-col">
              <Header />
              <main className="flex-1 overflow-auto">
                <div className="min-h-full pb-20 pl-8 pr-4 pt-20 md:pb-28 md:pl-8 md:pr-4 md:pt-28 lg:pb-36 lg:pl-12 lg:pr-4 lg:pt-28">
                  <div className="mx-auto min-w-0 max-w-[720px]">
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
