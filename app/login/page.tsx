import { signIn, auth } from "@/auth";
import { PRIMARY_DOMAIN } from "@/lib/identity";
import { redirect } from "next/navigation";
import { DEV_LOGIN_ENABLED } from "@/auth.config";

export const metadata = {
  title: "로그인 · CTR AX Lab",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in → skip the login screen.
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm border border-border/60 bg-panel p-8">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-text">CTR AX Lab</h1>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 border border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
          >
            {error === "AccessDenied"
              ? "회사 계정으로만 로그인할 수 있습니다. 회사 Microsoft 계정으로 다시 시도해주세요."
              : "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해주세요."}
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 border border-border/70 bg-panel2 px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-primary/50 hover:bg-panel2/70"
          >
            <MicrosoftIcon />
            Microsoft 365로 계속하기
          </button>
        </form>

        {/* Dev-only login — renders ONLY when DEV_LOGIN_ENABLED (local dev,
            never in production builds; see auth.config.ts). */}
        {DEV_LOGIN_ENABLED && (
          <form
            action={async (formData: FormData) => {
              "use server";
              const email = String(formData.get("email") ?? "").trim();
              await signIn("dev-login", { email, redirectTo: "/" });
            }}
            className="mt-4 space-y-2 border border-dashed border-warning/60 p-3"
          >
            <p className="text-center text-[11px] text-muted">
              개발용 로그인 (로컬 전용 — 운영에서는 나타나지 않음)
            </p>
            <input
              type="email"
              name="email"
              required
              defaultValue={`sangwoo.kang@${PRIMARY_DOMAIN || "ctr.co.kr"}`}
              className="w-full border border-border/70 bg-panel2 px-3 py-2 text-sm text-text focus:border-primary/50 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full border border-border/70 bg-panel2 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-primary/50 hover:bg-panel2/70"
            >
              개발용으로 로그인
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
