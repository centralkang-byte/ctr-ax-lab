"use client";

import EvalShell from "@/components/EvalShell";
import BrainstormWorkspace from "@/components/BrainstormWorkspace";
import { useI18n } from "@/lib/i18n/I18nProvider";

// The brainstorm workspace: a 3-panel layout — brainstorm chat (left), the
// one-page proposal for submission with Markdown/PDF export (middle), and
// proposal history (right). All state lives in BrainstormWorkspace.
export default function EvaluatePage() {
  const { locale } = useI18n();
  return (
    <EvalShell wide>
      <BrainstormWorkspace locale={locale} />
    </EvalShell>
  );
}
