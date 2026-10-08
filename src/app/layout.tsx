import "~/styles/globals.css";
import { ThemeProvider } from "./_components/theme-provider";

import { GeistSans } from "geist/font/sans";
import {
  IBM_Plex_Mono,
  Inter,
  Lora,
  Merriweather,
  Noto_Serif,
  Source_Serif_4,
} from "next/font/google";
import { type Metadata, type Viewport } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { AuthSessionListener } from "./_components/auth-session-listener";
import { OverlayThemeSync } from "./_components/overlay-theme-sync";

const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-merriweather",
  display: "swap",
  preload: false,
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  preload: false,
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif-4",
  display: "swap",
  preload: false,
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const metadata: Metadata = {
  title: "Chptr",
  description: "A powerful app to develop and share your ideas",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      {
        url: "/light_favicon.ico",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/dark_favicon.ico",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${GeistSans.variable} ${inter.variable} ${lora.variable} ${merriweather.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable} ${notoSerif.variable}`}
    >
      <body>
        <OverlayThemeSync />
        <TRPCReactProvider>
          <AuthSessionListener />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
