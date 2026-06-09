/**
 * RNG déterministe pour le mélange autoritatif (serveur). Réf. §4.4.
 * Le moteur n'utilise jamais Math.random : une permutation reproductible est
 * dérivée d'une graine, calculée par l'autorité, puis APPLIQUÉE par le reducer.
 */

/** PRNG sfc32 — rapide, déterministe, suffisant pour un mélange de partie. */
export function sfc32(
  a: number,
  b: number,
  c: number,
  d: number,
): () => number {
  return function () {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Hash de chaîne 32 bits (xmur3) → graines pour le PRNG. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function makeRng(seed: string): () => number {
  const s = xmur3(seed);
  return sfc32(s(), s(), s(), s());
}

/**
 * Permutation déterministe de [0..n-1] (Fisher-Yates) dérivée d'une graine.
 * `permutation[i]` = ancien index à placer en position i.
 */
export function permutationFromSeed(n: number, seed: string): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const rng = makeRng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}
