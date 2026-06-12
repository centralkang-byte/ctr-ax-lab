import "@/app/globals.css";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata = {
  title: "CTR AX Lab",
  description: "거친 아이디어를 결재 가능한 한 장짜리 AX 과제 제안서로",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the no-flash script (below) sets data-theme on
    // <html> before hydration, which the server HTML doesn't carry — that
    // intentional attribute mismatch is the standard theme-script pattern and
    // must not trip React's hydration check. Scoped to <html>'s own attributes.
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable}`}>
        {/* Render-blocking, first in <body>: sets data-theme before paint so the
            page never flashes light→dark on load. Static same-origin file (no
            inline script), cached after first visit. See public/no-flash.js. */}
        <script src="/no-flash.js" />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
