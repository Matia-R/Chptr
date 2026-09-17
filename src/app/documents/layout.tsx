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
import { AccountSettings } from "../_components/account-settings";
import { DocumentTrash } from "../_components/document-trash";
import { Header } from "../_components/header";
import { DocumentsMain } from "../_components/document-unavailable-state";
import { DocumentListSeedProvider } from "~/hooks/use-known-document-name";

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

async function getDocumentListSeed() {
  const caller = await getTrpcCaller();
  const result = await caller.document.getDocumentIdsForAuthenticatedUser();
  return {
    documents: result.documents ?? [],
    trashedDocuments: result.trashedDocuments ?? [],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { documents, trashedDocuments } = await getDocumentListSeed();

  return (
    <TRPCReactProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <DocumentListSeedProvider
          documents={documents}
          trashedDocuments={trashedDocuments}
        >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <div className="relative flex h-full min-h-0 min-w-0 flex-col">
                <Header />
                <DocumentsMain>{children}</DocumentsMain>
              </div>
            </SidebarInset>
            <Toaster />
          </SidebarProvider>
          <CommandMenu />
          <AccountSettings />
          <DocumentTrash />
        </DocumentListSeedProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
