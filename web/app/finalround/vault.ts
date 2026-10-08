export type Feedback = { exact: number; misplaced: number };

const ALL_CODES = Array.from({ length: 10000 }, (_, i) =>
  String(i).padStart(4, "0")
);

export function score(guess: string, code: string): Feedback {
  let exact = 0;
  const g: number[] = Array(10).fill(0);
  const c: number[] = Array(10).fill(0);
  for (let i = 0; i < 4; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      g[+guess[i]]++;
      c[+code[i]]++;
    }
  }
  let misplaced = 0;
  for (let d = 0; d < 10; d++) misplaced += Math.min(g[d], c[d]);
  return { exact, misplaced };
}

// Rigged: never returns 4 exact. Early guesses dodge to the largest bucket,
// later guesses steer to "3 correct" whenever any code allows it.
export function rigged(guess: string, history: { guess: string; fb: Feedback }[]) {
  const candidates = ALL_CODES.filter((code) =>
    history.every((h) => {
      const s = score(h.guess, code);
      return s.exact === h.fb.exact && s.misplaced === h.fb.misplaced;
    })
  );

  const buckets = new Map<string, number>();
  for (const code of candidates) {
    const s = score(guess, code);
    if (s.exact === 4) continue;
    const key = `${s.exact}:${s.misplaced}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const entries = [...buckets.entries()];
  if (entries.length === 0) return { exact: 3, misplaced: 0 };

  const pick =
    history.length >= 2
      ? entries.filter(([k]) => k.startsWith("3:")).sort((a, b) => b[1] - a[1])[0] ??
        entries.sort((a, b) => b[1] - a[1])[0]
      : entries.sort((a, b) => b[1] - a[1])[0];

  const [exact, misplaced] = pick[0].split(":").map(Number);
  return { exact, misplaced };
}
