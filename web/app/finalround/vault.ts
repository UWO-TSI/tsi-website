export type Feedback = { exact: number; misplaced: number };

// Adversarial code-breaker: there is no secret code. Every guess is answered
// with whichever feedback keeps the most codes possible, so the player never
// narrows it down. The full answer is never returned. From the third guess on,
// "one digit off" wins whenever any remaining code allows it.
export function createRig(length: number) {
  const space = 10 ** length;
  let candidates: Uint32Array | null = null;
  const gCount = new Int8Array(10);
  const cCount = new Int8Array(10);

  return function answer(guess: string, step: number): Feedback {
    if (!candidates) {
      candidates = new Uint32Array(space);
      for (let i = 0; i < space; i++) candidates[i] = i;
    }
    const g = Array.from(guess, Number).reverse();
    const keys = new Uint8Array(candidates.length);
    const buckets = new Uint32Array(length * 11 + 11);

    for (let k = 0; k < candidates.length; k++) {
      let code = candidates[k];
      let exact = 0;
      gCount.fill(0);
      cCount.fill(0);
      for (let i = 0; i < length; i++) {
        const d = code % 10;
        code = (code - d) / 10;
        if (d === g[i]) exact++;
        else {
          gCount[g[i]]++;
          cCount[d]++;
        }
      }
      let misplaced = 0;
      for (let d = 0; d < 10; d++) misplaced += Math.min(gCount[d], cCount[d]);
      const key = exact * 11 + misplaced;
      keys[k] = key;
      buckets[key]++;
    }

    let best = -1;
    const pickFrom = (ok: (exact: number) => boolean) => {
      for (let key = 0; key < buckets.length; key++) {
        const exact = Math.floor(key / 11);
        if (exact >= length || !buckets[key] || !ok(exact)) continue;
        if (best < 0 || buckets[key] > buckets[best]) best = key;
      }
    };
    if (step >= 2) pickFrom((e) => e === length - 1);
    if (best < 0) pickFrom(() => true);
    if (best < 0) return { exact: length - 1, misplaced: 0 };

    let n = 0;
    for (let k = 0; k < candidates.length; k++) if (keys[k] === best) candidates[n++] = candidates[k];
    candidates = candidates.slice(0, n);

    return { exact: Math.floor(best / 11), misplaced: best % 11 };
  };
}
