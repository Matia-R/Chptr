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
        <SidebarProvider>
          <AppSidebar initialDocuments={documents} />
          <SidebarInset>
            <div className="relative flex h-full min-h-0 min-w-0 flex-col">
              <Header />
              <main
                data-app-scroll-root
                className="min-h-0 flex-1 touch-pan-y overflow-auto overscroll-y-contain max-md:pt-12"
              >
                <div className="pt-20 md:pl-8 md:pr-4 md:pt-28 lg:pl-12 lg:pr-4 lg:pt-28">
                  <div className="mx-auto min-w-0 max-w-[768px] px-4 md:px-0">
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
