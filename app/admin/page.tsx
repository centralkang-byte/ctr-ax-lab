import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isViewingAsMember } from "@/lib/view-as";
import EvalShell from "@/components/EvalShell";
import AdminDashboard from "@/components/AdminDashboard";

export const runtime = "nodejs";

// Admin surface: LLM model setup (binds the LangGraph judge to a provider/model)
// and cross-user evaluation history. Gated server-side to the admin allow-list —
// a non-admin who navigates here is bounced back to the evaluator. An admin who
// is previewing the member experience ("view as member") is bounced too, so the
// test is faithful rather than just hiding the nav link.
export default async function AdminPage() {
  const session = await auth();
  if (!(await isAdmin(session?.user?.email)) || (await isViewingAsMember()))
    redirect("/evaluate");

  return (
    <EvalShell wide>
      <AdminDashboard />
    </EvalShell>
  );
}
