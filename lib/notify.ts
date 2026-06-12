// Teams channel notification via an incoming-webhook URL (TEAMS_WEBHOOK_URL).
//
// CTR runs on M365, so the channel is wired with a Power Automate "post to a
// channel when a webhook request is received" flow — that endpoint expects the
// message+Adaptive-Card envelope below (the legacy O365 connector format is
// deprecated by Microsoft). Contract: a notification must NEVER break the
// action it follows — every failure path is swallowed after one console line,
// and with no URL configured this is a silent no-op (local dev, pilots
// without a channel).

const TIMEOUT_MS = 5000;

export async function notifyTeams(
  title: string,
  lines: string[],
  projectId?: string
): Promise<void> {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;

  // Deep link back into the app — only when we know our public origin.
  const base = (process.env.AUTH_URL ?? "").replace(/\/$/, "");
  const link = base && projectId ? `${base}/projects/${projectId}` : "";

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      { type: "TextBlock", text: title, weight: "Bolder", wrap: true },
      ...lines.filter(Boolean).map((text) => ({ type: "TextBlock", text, wrap: true, spacing: "Small" })),
    ],
    ...(link
      ? { actions: [{ type: "Action.OpenUrl", title: "CTR AX Lab에서 보기", url: link }] }
      : {}),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message",
        attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`notifyTeams: webhook responded ${res.status}`);
    }
  } catch (err) {
    console.warn("notifyTeams: webhook unreachable", err instanceof Error ? err.message : err);
  }
}
