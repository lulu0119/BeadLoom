import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { publicPath } from "../../base-path";
import { AppToaster } from "@/app/app-toaster";
import { I18nProvider } from "@/i18n/i18n-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manifestPath = publicPath("/site.webmanifest");
const iconMetadata = [
  { url: publicPath("/favicon-32x32.png"), sizes: "32x32", type: "image/png" },
  { url: publicPath("/favicon-16x16.png"), sizes: "16x16", type: "image/png" }
];
const appleIconMetadata = [{ url: publicPath("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }];

export const viewport: Viewport = {
  viewportFit: "cover"
};

export const metadata: Metadata = {
  title: "BeadLoom",
  description:
    "Talk to a drawing agent on a bead chart. Attach a reference photo in chat or type what to draw, then keep editing the grid by hand.",
  manifest: manifestPath,
  icons: {
    icon: iconMetadata,
    apple: appleIconMetadata
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full min-h-0 antialiased`}
    >
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <I18nProvider>
          {children}
          <AppToaster />
        </I18nProvider>
      </body>
    </html>
  );
}
