import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Canonical origin for absolute og:image / canonical URLs; set NEXT_PUBLIC_SITE_URL to override (e.g. staging).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://phase.cool";

const title = "Phase: contrast-safe color scales";
const description =
  "Generate contrast-safe color scales in OKLCH where every step number guarantees WCAG contrast, so any hue can sit on any other. Supports Display P3 and exports design tokens.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`),
  title: { default: title, template: "%s | Phase" },
  description,
  applicationName: "Phase",
  // Tabs are light or dark independent of the page, so pick the one-color icon that contrasts with the browser theme.
  icons: {
    icon: [
      { url: "/icon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
  },
  // Images come from the opengraph-image / twitter-image file conventions in this folder.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Phase",
    locale: "en_US",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
