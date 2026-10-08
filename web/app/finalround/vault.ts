// Per-digit feedback: 2 = right digit, right spot. 1 = in the code, wrong spot. 0 = not in the code.
export type Mark = 0 | 1 | 2;
export type Feedback = Mark[];

export const greens = (fb: Feedback) => fb.filter((m) => m === 2).length;

// Adversarial code-breaker: there is no secret code. Every answer stays
// consistent with all earlier answers, but is picked so the player keeps
// gaining greens (it feels close) while the most codes stay possible. The
// all-green answer is never given.
export function createRig(length: number) {
  const space = 10 ** length;
  const patterns = 3 ** length;
  let candidates: Uint32Array | null = null;
  const left = new Int8Array(10);
  const digits = new Int8Array(length);

  const decode = (key: number): Feedback =>
    Array.from({ length }, (_, i) => (Math.floor(key / 3 ** i) % 3) as Mark);

  return function answer(guess: string, step: number, minGreens: number): Feedback {
    if (!candidates) {
      candidates = new Uint32Array(space);
      for (let i = 0; i < space; i++) candidates[i] = i;
    }
    const g = Array.from(guess, Number);
    const keys = new Uint16Array(candidates.length);
    const buckets = new Uint32Array(patterns);

    for (let k = 0; k < candidates.length; k++) {
      let code = candidates[k];
      for (let i = length - 1; i >= 0; i--) {
        const d = code % 10;
        digits[i] = d;
        code = (code - d) / 10;
      }
      left.fill(0);
      let key = 0;
      for (let i = 0; i < length; i++) {
        if (digits[i] === g[i]) key += 2 * 3 ** i;
        else left[digits[i]]++;
      }
      for (let i = 0; i < length; i++) {
        if (digits[i] !== g[i] && left[g[i]] > 0) {
          left[g[i]]--;
          key += 3 ** i;
        }
      }
      keys[k] = key;
      buckets[key]++;
    }

    const greenCount = new Uint8Array(patterns);
    for (let key = 0; key < patterns; key++) {
      let n = 0;
      for (let i = 0; i < length; i++) if (Math.floor(key / 3 ** i) % 3 === 2) n++;
      greenCount[key] = n;
    }

    let best = -1;
    for (let key = 0; key < patterns; key++) {
      const n = greenCount[key];
      if (!buckets[key] || n >= length || n < minGreens) continue;
      if (best < 0 || buckets[key] > buckets[best]) best = key;
    }
    // Nothing reaches the target: give the most greens still possible.
    if (best < 0) {
      for (let key = 0; key < patterns; key++) {
        if (!buckets[key] || greenCount[key] >= length) continue;
        if (best < 0 || greenCount[key] > greenCount[best] || (greenCount[key] === greenCount[best] && buckets[key] > buckets[best])) best = key;
      }
    }
    if (best < 0) {
      const miss = step % length;
      return Array.from({ length }, (_, i) => (i === miss ? 0 : 2) as Mark);
    }

    let n = 0;
    for (let k = 0; k < candidates.length; k++) if (keys[k] === best) candidates[n++] = candidates[k];
    candidates = candidates.slice(0, n);
    return decode(best);
  };
}
