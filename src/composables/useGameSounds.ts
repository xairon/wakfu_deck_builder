/**
 * Sons de table (façon MTGA, discrets) — SFX synthétisés en Web Audio, AUCUN
 * asset externe (pas de question de licence). Chaque repère est court
 * (< 350 ms), doux (master ~0,22) et conçu comme un « bruitage d'interface » :
 * pioche (souffle bref), pose de carte (toc feutré), inclinaison (tic),
 * attaque (tambour grave), dommages (impact mat), victoire/défaite (arpège).
 *
 * - Coupure : bouton (persistée localStorage), AUCUN son tant que l'utilisateur
 *   n'a pas interagi (l'AudioContext ne se crée qu'au premier geste — politique
 *   d'autoplay des navigateurs, et politesse élémentaire).
 * - Anti-mitraille : un même repère ne rejoue pas avant 90 ms (les 6 pioches
 *   d'ouverture ne font pas une rafale).
 * - Le MAPPING journal → repère est une fonction pure exportée (testable sans
 *   AudioContext).
 */
import { ref } from "vue";

export type SfxKind =
  | "draw"
  | "play"
  | "tap"
  | "attack"
  | "damage"
  | "victory"
  | "defeat";

const STORAGE_KEY = "wakfu-table-sound-muted";

const muted = ref(
  typeof localStorage !== "undefined" &&
    localStorage.getItem(STORAGE_KEY) === "1",
);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayed = new Map<SfxKind, number>();

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Oscillateur enveloppé (attaque brève, décroissance exponentielle). */
function tone(
  freq: number,
  dur: number,
  opts?: {
    type?: OscillatorType;
    gain?: number;
    sweepTo?: number;
    at?: number;
  },
): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts?.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts?.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts?.sweepTo)
    osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts?.gain ?? 0.5, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Souffle filtré (bruit blanc court → passe-bande) — pioche, impacts. */
function whoosh(
  dur: number,
  opts?: { freq?: number; q?: number; gain?: number; sweepTo?: number },
): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(opts?.freq ?? 900, t0);
  if (opts?.sweepTo)
    bp.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  bp.Q.value = opts?.q ?? 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts?.gain ?? 0.35, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
}

const RECIPES: Record<SfxKind, () => void> = {
  // Pioche : souffle bref qui monte (carte qui glisse).
  draw: () => whoosh(0.12, { freq: 700, sweepTo: 1600, gain: 0.22 }),
  // Pose : « toc » feutré (sinus grave très court + pointe de souffle).
  play: () => {
    tone(190, 0.14, { gain: 0.5 });
    whoosh(0.05, { freq: 2200, gain: 0.1 });
  },
  // Inclinaison : tic discret.
  tap: () => tone(880, 0.05, { type: "triangle", gain: 0.18 }),
  // Attaque : tambour grave (sweep descendant).
  attack: () => tone(150, 0.22, { gain: 0.6, sweepTo: 62 }),
  // Dommages : impact mat (thump + souffle sombre).
  damage: () => {
    tone(95, 0.16, { gain: 0.55, sweepTo: 55 });
    whoosh(0.12, { freq: 350, gain: 0.2 });
  },
  // Victoire : petit arpège majeur ascendant.
  victory: () => {
    tone(523, 0.16, { gain: 0.32 });
    tone(659, 0.16, { gain: 0.32, at: 0.11 });
    tone(784, 0.26, { gain: 0.34, at: 0.22 });
  },
  // Défaite : deux notes descendantes, sobres.
  defeat: () => {
    tone(392, 0.2, { gain: 0.3 });
    tone(262, 0.32, { gain: 0.3, at: 0.16 });
  },
};

/**
 * MAPPING journal → repère sonore. PUR (testable). Renvoie null pour les
 * lignes sans repère (la plupart). Les libellés viennent de describe()/say()
 * du gameStore — verrouillés par les specs du journal.
 */
export function sfxForLogLine(text: string): SfxKind | null {
  if (/\bpioche (une|\d+) cartes?\b/.test(text)) return "draw";
  if (/\bjoue\b|\bmet .+ en jeu\b/.test(text)) return "play";
  if (/\bincline\b/.test(text)) return "tap";
  if (/dommages?\b/i.test(text)) return "damage";
  return null;
}

export function useGameSounds() {
  function play(kind: SfxKind): void {
    if (muted.value) return;
    const now = Date.now();
    // Anti-mitraille par repère (rafales de pioche/inclinaisons).
    if (now - (lastPlayed.get(kind) ?? 0) < 90) return;
    lastPlayed.set(kind, now);
    if (!ensureCtx()) return;
    RECIPES[kind]();
  }
  function toggleMute(): void {
    muted.value = !muted.value;
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORAGE_KEY, muted.value ? "1" : "0");
  }
  return { muted, play, toggleMute };
}
