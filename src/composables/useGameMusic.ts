/**
 * Musique de fond de la table — lecteur de PISTES LOCALES fournies par
 * l'exploitant de l'appli (AUCUNE piste embarquée : les musiques du MMO Wakfu
 * sont la propriété d'Ankama — on ne les redistribue pas ; l'utilisateur
 * dépose les fichiers qu'il possède dans `public/audio/music/` et les liste
 * dans `manifest.json`, cf. le README du dossier).
 *
 * - Lecture en BOUCLE de la playlist (ordre mélangé une fois au chargement),
 *   volume discret (0,25), enchaînement automatique des pistes.
 * - Désactivable : bouton (préférence persistée localStorage) ; la lecture ne
 *   démarre qu'au GESTE utilisateur (politique d'autoplay des navigateurs —
 *   le clic sur le bouton EST le geste).
 * - Sans manifeste ou playlist vide : `available` reste false (le bouton de
 *   la table ne s'affiche pas).
 */
import { ref } from "vue";

// Clé V2 : l'ancienne (« wakfu-table-music-on ») pouvait contenir un « 0 »
// écrit par un clic du temps où le bouton ne jouait rien (pas de playlist) —
// ce vieux réglage coupait la musique malgré le ON par défaut (retour
// utilisateur « toujours pas de musique »). On repart proprement : seul un
// opt-out fait APRÈS cette version compte.
const STORAGE_KEY = "wakfu-table-music-v2";

const available = ref(false);
const playing = ref(false);
const tracks = ref<string[]>([]);
let audio: HTMLAudioElement | null = null;
let index = 0;
let manifestPromise: Promise<void> | null = null;

function loadManifest(): Promise<void> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = doLoadManifest();
  return manifestPromise;
}

async function doLoadManifest(): Promise<void> {
  try {
    const res = await fetch("/audio/music/manifest.json");
    if (!res.ok) return;
    const list = (await res.json()) as unknown;
    if (!Array.isArray(list)) return;
    const items = list.filter((t): t is string => typeof t === "string");
    if (!items.length) return;
    // Mélange (Fisher-Yates) — une seule fois par session.
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    tracks.value = items.map((t) =>
      t.startsWith("/") ? t : `/audio/music/${t}`,
    );
    available.value = true;
  } catch {
    // manifeste absent/invalide → pas de musique, silencieusement.
  }
}

function playCurrent(): void {
  if (!tracks.value.length) return;
  if (!audio) {
    audio = new Audio();
    audio.volume = 0.25;
    audio.addEventListener("ended", () => {
      index = (index + 1) % tracks.value.length;
      playCurrent();
    });
  }
  audio.src = tracks.value[index];
  void audio.play().catch(() => {
    // Lecture refusée (autoplay) : on retentera au prochain geste.
    playing.value = false;
  });
}

function stop(): void {
  audio?.pause();
}

export function useGameMusic() {
  void loadManifest();
  function toggle(): void {
    playing.value = !playing.value;
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORAGE_KEY, playing.value ? "1" : "0");
    if (playing.value) playCurrent();
    else stop();
  }
  /**
   * Démarrage/reprise au premier GESTE utilisateur (politique d'autoplay).
   * ON PAR DÉFAUT dès qu'une playlist existe (retour utilisateur : « y'a
   * toujours pas de musique » — l'opt-in au bouton n'était pas découvert) ;
   * seule une désactivation EXPLICITE (« 0 » persisté) la coupe. ATTEND le
   * manifeste : au premier clic d'une partie, le fetch peut ne pas avoir
   * abouti — sans l'attente, la reprise était silencieusement perdue.
   */
  async function resumeIfWanted(): Promise<void> {
    if (playing.value) return;
    await loadManifest();
    if (!available.value) return;
    const pref =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (pref === "0") return; // opt-out explicite
    playing.value = true;
    playCurrent();
  }
  return { available, playing, toggle, resumeIfWanted };
}
