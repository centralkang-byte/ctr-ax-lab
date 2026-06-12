"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Shuffle, Sparkles } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { TrackId } from "@/lib/evaluator-meta";
import { CATEGORY_META, EXAMPLES_POOL, type Example } from "@/lib/examples";
import { dealBatch, shuffle } from "@/lib/shuffle";
import { fadeRiseFor, staggerContainer } from "@/lib/motion";

const BATCH = 3;


const STR: Record<Locale, { heading: string; shuffle: string }> = {
  kr: { heading: "이런 아이디어로 시작해 보세요", shuffle: "다른 예시" },
  en: { heading: "Start from an idea like these", shuffle: "Shuffle" },
};

// Suggestion cards above the input. Draws a varied batch from a shuffled deck so
// every example gets surfaced before any repeats; the shuffle button deals the
// next batch. Clicking a card hands its full text up to the page to paste.
export default function SuggestionCards({
  track,
  locale,
  onPick,
}: {
  track: TrackId;
  locale: Locale;
  onPick: (text: string) => void;
}) {
  const pool = useMemo(() => EXAMPLES_POOL.filter((e) => e.track === track), [track]);

  const [deck, setDeck] = useState<Example[]>([]);
  const [batch, setBatch] = useState<Example[]>([]);

  // Deal the first batch from a SHUFFLED deck. dealBatch only reshuffles when its
  // deck runs dry, so handing it the raw (ordered) pool would deterministically
  // return the first example of each category every load — shuffle up front.
  useEffect(() => {
    const { batch: first, rest } = dealBatch(shuffle(pool), pool, BATCH);
    setBatch(first);
    setDeck(rest);
  }, [pool]);

  function reshuffle() {
    const exclude = new Set(batch.map((b) => b.id));
    const { batch: next, rest } = dealBatch(deck, pool, BATCH, exclude);
    setBatch(next);
    setDeck(rest);
  }

  const reduce = useReducedMotion() ?? false;

  if (batch.length === 0) return null;
  const t = STR[locale];

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Sparkles strokeWidth={1.8} className="h-3.5 w-3.5 text-primary/70" />
          {t.heading}
        </div>
        <button
          type="button"
          onClick={reshuffle}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/50 hover:text-text"
        >
          <Shuffle strokeWidth={1.8} className="h-3.5 w-3.5" />
          {t.shuffle}
        </button>
      </div>

      <motion.div
        className="grid gap-2 sm:grid-cols-3"
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="show"
      >
        {batch.map((ex) => (
          <motion.button
            key={ex.id}
            variants={fadeRiseFor(reduce)}
            type="button"
            onClick={() => onPick(ex[locale].text)}
            title={ex[locale].text}
            className="group flex h-full flex-col gap-1.5 border border-border/55 bg-panel2/30 p-3 text-left transition-colors hover:border-primary/55 hover:bg-panel2/60"
          >
            <span className="inline-flex w-fit items-center border border-border/55 bg-panel/60 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
              {CATEGORY_META[ex.category][locale]}
            </span>
            <span className="text-sm font-medium leading-snug text-text decoration-primary/40 underline-offset-2 group-hover:text-primary group-hover:underline">
              {ex[locale].label}
            </span>
            <span className="line-clamp-2 text-xs leading-relaxed text-muted">
              {ex[locale].text}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
