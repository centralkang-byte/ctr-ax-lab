"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, Languages, LayoutList, LogOut, Moon, Shield, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/config";
import { signOutAction } from "@/lib/auth-actions";

const THEME_STORAGE_KEY = "ctr_ax_lab_theme";

type Section = { href: string; label: string; Icon: LucideIcon; show: boolean };

// Application chrome: a left global navigation rail for the app's sections
// (collapses to icons on small screens), plus a slim top bar with the KR/EN
// toggle and sign-out. Access is gated by Google SSO; the Admin section only
// appears for admins (the /admin route is independently gated server-side).
export default function EvalShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Full-bleed content (e.g. the 3-panel workspace) instead of the centered max-w-6xl column. */
  wide?: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const container = wide ? "max-w-none" : "max-w-6xl";
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewingAsMember, setViewingAsMember] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Ask the server whether the signed-in user is an admin, so the Admin section
  // only appears for them. The /admin route is independently gated server-side.
  // viewingAsMember stays true while an admin is previewing the member view (in
  // which case isAdmin is reported false), so we can still offer a way back out.
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setIsAdmin(d.isAdmin === true);
        setViewingAsMember(d.viewingAsMember === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // "View as member" is a cookie the server honors to downgrade this session to a
  // plain member; flipping it is just set/clear + reload. It only ever removes
  // privileges from the caller's own session, so it needs no extra auth.
  const enterMemberView = () => {
    document.cookie = "viewAs=member; path=/; max-age=86400; samesite=lax";
    window.location.assign("/evaluate");
  };
  const exitMemberView = () => {
    document.cookie = "viewAs=; path=/; max-age=0; samesite=lax";
    window.location.reload();
  };

  // Resolve a sensible theme so the design tokens in globals.css apply.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-density", "comfortable");
  }, []);

  // Flip between light and dark, persisting the explicit choice.
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  // Sections of the app. Add an entry here to grow the left nav.
  const sections: Section[] = [
    { href: "/evaluate", label: locale === "kr" ? "AX 과제" : "AX Projects", Icon: Sparkles, show: true },
    { href: "/projects", label: locale === "kr" ? "과제 현황" : "Projects", Icon: LayoutList, show: true },
    { href: "/admin", label: locale === "kr" ? "관리자" : "Admin", Icon: Shield, show: isAdmin },
  ].filter((s) => s.show);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <main className="flex min-h-screen bg-bg text-text">
      {/* ── Left global navigation rail ──────────────────────────────────── */}
      <aside className="sticky top-0 z-20 flex h-screen w-14 shrink-0 flex-col border-r border-border/60 bg-panel/85 backdrop-blur lg:w-52">
        <Link
          href="/evaluate"
          title="CTR AX Lab"
          className="flex h-14 items-center justify-center border-b border-border/60 px-3 transition hover:opacity-80 lg:justify-start"
        >
          {/* Narrow rail (mobile): a compact monogram so the wordmark doesn't
              wrap to three lines. Full wordmark only when the rail expands. */}
          <span className="font-display text-lg font-semibold tracking-tight text-text lg:hidden">
            AX
          </span>
          <span className="hidden whitespace-nowrap font-display text-lg font-semibold tracking-tight text-text lg:inline">
            CTR AX Lab
          </span>
        </Link>

        <nav className="flex-1 space-y-1 p-2">
          {sections.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`relative flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors ${
                  active ? "text-primary" : "text-muted hover:bg-panel2/50 hover:text-text"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-y-1 left-0 w-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon strokeWidth={1.8} className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Content column ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-panel/85 backdrop-blur">
          <div className={`mx-auto flex h-14 items-center justify-end gap-2 px-4 ${container}`}>
            {/* Owner-only: preview the plain-member experience (downgrade-only). */}
            {isAdmin && (
              <button
                type="button"
                onClick={enterMemberView}
                title={locale === "kr" ? "테스터로 보기" : "View as member"}
                className="inline-flex items-center gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-text"
              >
                <Eye strokeWidth={1.8} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {locale === "kr" ? "테스터로 보기" : "View as member"}
                </span>
              </button>
            )}
            {viewingAsMember && (
              <button
                type="button"
                onClick={exitMemberView}
                title={locale === "kr" ? "테스터 보기 종료" : "Exit member view"}
                className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/15"
              >
                <EyeOff strokeWidth={1.8} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {locale === "kr" ? "테스터 보기 종료" : "Exit member view"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? locale === "kr"
                    ? "라이트 모드"
                    : "Light mode"
                  : locale === "kr"
                    ? "다크 모드"
                    : "Dark mode"
              }
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center border border-border/50 p-1.5 text-muted transition-colors hover:text-text"
            >
              {theme === "dark" ? (
                <Sun strokeWidth={1.8} className="h-3.5 w-3.5" />
              ) : (
                <Moon strokeWidth={1.8} className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="inline-flex items-center gap-1 border border-border/50 p-0.5">
              <Languages strokeWidth={1.8} className="ml-1 h-3.5 w-3.5 text-muted" />
              {(["kr", "en"] as Locale[]).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => setLocale(lng)}
                  className={`px-2 py-1 text-xs transition-colors ${
                    locale === lng ? "bg-primary/15 text-primary" : "text-muted hover:text-text"
                  }`}
                >
                  {lng === "kr" ? t("settings.langKr") : t("settings.langEn")}
                </button>
              ))}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title={locale === "kr" ? "로그아웃" : "Sign out"}
                className="inline-flex items-center gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-text"
              >
                <LogOut strokeWidth={1.8} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{locale === "kr" ? "로그아웃" : "Sign out"}</span>
              </button>
            </form>
          </div>
        </header>
        <div className={`mx-auto w-full px-4 py-6 ${container}`}>{children}</div>
      </div>
    </main>
  );
}
