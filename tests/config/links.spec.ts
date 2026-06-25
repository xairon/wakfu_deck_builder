import { describe, it, expect } from "vitest";
import {
  DISCORD_INVITE_URL,
  WTCG_RETURN_URL,
  ANKAMA_URL,
} from "@/config/links";

describe("external links", () => {
  it("pointe vers l'invitation Discord de la communauté", () => {
    expect(DISCORD_INVITE_URL).toBe("https://discord.com/invite/PjA8Z6SCYm");
  });
  it("référence le site de Safranil et Ankama", () => {
    expect(WTCG_RETURN_URL).toContain("wtcg-return.fr");
    expect(ANKAMA_URL).toContain("ankama.com");
  });
});
