import { WTCG_RETURN_URL, ANKAMA_URL } from "@/config/links";

export interface CreditEntry {
  name: string;
  role: string;
  description: string;
  url?: string;
}

export const CREDITS: CreditEntry[] = [
  {
    name: "Ankama",
    role: "Créateur de l'univers",
    description:
      "Wakfu, le Wakfu TCG, ses cartes et ses illustrations sont la création d'Ankama. Tout l'univers, les personnages et les visuels leur appartiennent. Cette application est un hommage indépendant, sans aucune affiliation ni approbation d'Ankama.",
    url: ANKAMA_URL,
  },
  {
    name: "Safranil — Wakfu TCG Return",
    role: "Préservation & partage",
    description:
      "Un immense merci à Safranil pour son site Wakfu TCG Return, et pour son travail de partage des illustrations des cartes et des listes de decks. Cette base de données communautaire est le socle sans lequel cette application n'aurait pas pu exister.",
    url: WTCG_RETURN_URL,
  },
  {
    name: "La communauté Discord",
    role: "Joueurs & contributeurs",
    description:
      "Merci aux joueuses et joueurs du Discord pour leurs retours, leurs tests, et le relevé des listes de decks publiées par Ankama dans les Dofus Mag.",
  },
  {
    name: "Technologies",
    role: "Outils open source",
    description:
      "Application construite avec Vue 3, Pinia, Vite, Tailwind CSS & DaisyUI, Supabase et Tauri.",
  },
];
