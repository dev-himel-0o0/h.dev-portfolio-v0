import { DesktopEnhancements } from "@/components/ui/desktop-enhancements";
import { MotionProvider } from "@/components/ui/motion-provider";
import { PageTransition } from "@/components/ui/page-transition";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { WipeCurtain } from "@/components/ui/wipe-curtain";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const generalSans = localFont({
  src: [
    { path: "../fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
});

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Himel — Full-Stack Software Engineer",
  description:
    "Himel is a Full-Stack Software Engineer with 4+ years of experience, open for freelance projects and remote roles.",
  icons: {
    icon: "/img/h.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        montserrat.variable,
        generalSans.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col">
        <SmoothScroll>
          <MotionProvider>
            <PageTransition>
              {children}
              <ScrollToTop />
            </PageTransition>
            <WipeCurtain />
          </MotionProvider>
        </SmoothScroll>
        <DesktopEnhancements />
      </body>
    </html>
  );
}
