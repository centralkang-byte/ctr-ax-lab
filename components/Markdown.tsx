import type { ReactNode } from "react";

// Minimal markdown rendering — enough for chat prose and the one-page proposal:
// # / ## / ### headings, - and 1. lists, **bold**, and [text](url) links.
// Avoids pulling in a full markdown dependency.

const TOKEN = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(s)) !== null) {
    if (m.index > last) out.push(<span key={key++}>{s.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={key++} className="font-semibold text-text">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (link) {
        out.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {link[1]}
          </a>
        );
      } else {
        out.push(<span key={key++}>{tok}</span>);
      }
    }
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(<span key={key++}>{s.slice(last)}</span>);
  return out;
}

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let items: string[] = [];
  let ordered = false;

  const flush = () => {
    if (!items.length) return;
    const li = items.map((it, i) => (
      <li key={i} className="flex gap-2">
        {ordered ? (
          <span className="tabular-nums text-muted">{i + 1}.</span>
        ) : (
          <span className="text-primary">•</span>
        )}
        <span>{inline(it)}</span>
      </li>
    ));
    out.push(
      ordered ? (
        <ol key={`ol-${out.length}`} className="my-1.5 ml-1 space-y-1">
          {li}
        </ol>
      ) : (
        <ul key={`ul-${out.length}`} className="my-1.5 ml-1 space-y-1">
          {li}
        </ul>
      )
    );
    items = [];
  };

  const pushItem = (content: string, isOrdered: boolean) => {
    if (items.length && ordered !== isOrdered) flush();
    ordered = isOrdered;
    items.push(content);
  };

  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) {
      flush();
      out.push(
        <h3 key={`h1-${i}`} className="mt-1 mb-2 text-base font-semibold text-text first:mt-0">
          {inline(line.replace(/^#\s+/, ""))}
        </h3>
      );
    } else if (/^#{2,3}\s+/.test(line)) {
      flush();
      // Swiss section header — uppercase + tracked with a hairline underline,
      // mirroring the proposal's PDF-export stylesheet so screen and print match.
      out.push(
        <h4
          key={`h-${i}`}
          className="hairline-b mb-1.5 mt-4 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-text/70 first:mt-0"
        >
          {inline(line.replace(/^#{2,3}\s+/, ""))}
        </h4>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      pushItem(line.replace(/^\d+\.\s+/, ""), true);
    } else if (/^[-*]\s+/.test(line)) {
      pushItem(line.replace(/^[-*]\s+/, ""), false);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed">
          {inline(line)}
        </p>
      );
    }
  });
  flush();
  return <>{out}</>;
}
