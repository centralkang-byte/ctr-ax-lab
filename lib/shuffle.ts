// "Shuffled deck" sampling for the suggestion cards.
//
// Pure random sampling can show the same item twice in a row and leave others
// unseen. Instead we shuffle the whole pool into a deck and deal from the top,
// only reshuffling once the deck runs out — so every example gets surfaced
// before any repeats, and each refresh feels fresh rather than random.

export function shuffle<T>(items: readonly T[]): T[] {
  // Fisher–Yates. Caller decides when to run this (client-only) to avoid SSR
  // hydration mismatches.
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draw `count` items from `deck`, preferring category variety within the batch
// so a single refresh tends to show a spread of idea types. Returns the drawn
// batch plus the remaining deck. When the deck can't fill a batch it is refilled
// from `pool` (reshuffled, excluding anything still on screen) and dealing
// continues — guaranteeing no repeats until the whole pool has been shown.
export function dealBatch<T extends { id: string; category: string }>(
  deck: T[],
  pool: readonly T[],
  count: number,
  exclude: ReadonlySet<string> = new Set()
): { batch: T[]; rest: T[] } {
  let working = deck.slice();
  const batch: T[] = [];
  const usedCategories = new Set<string>();

  const refill = () => {
    const onScreen = new Set([...exclude, ...batch.map((b) => b.id)]);
    const fresh = shuffle(pool.filter((p) => !onScreen.has(p.id)));
    // Keep whatever was left on the old deck at the front so it still gets dealt.
    working = [...working, ...fresh];
  };

  // First pass: take items whose category hasn't appeared in this batch yet.
  let guard = 0;
  while (batch.length < count && guard++ < pool.length * 3) {
    if (working.length === 0) refill();
    if (working.length === 0) break; // pool smaller than count

    const idx = working.findIndex((it) => !usedCategories.has(it.category));
    if (idx === -1) {
      // Every remaining deck item repeats a category already in the batch.
      // Reshuffle a fresh deck once to look for variety; if still none, fall
      // back to taking the top item so we never spin forever.
      const before = working.length;
      refill();
      if (working.length === before) {
        const it = working.shift()!;
        batch.push(it);
        usedCategories.add(it.category);
      }
      continue;
    }

    const [it] = working.splice(idx, 1);
    batch.push(it);
    usedCategories.add(it.category);
  }

  return { batch, rest: working };
}
