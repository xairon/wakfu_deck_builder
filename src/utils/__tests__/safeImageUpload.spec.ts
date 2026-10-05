import { describe, it, expect } from "vitest";
import {
  verifyImageMagicBytes,
  containsMaliciousPayload,
  validateAndSanitizeImageFile,
} from "../safeImageUpload";

describe("safeImageUpload", () => {
  describe("verifyImageMagicBytes", () => {
    it("détecte correctement une signature JPEG", () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(verifyImageMagicBytes(bytes)).toBe("jpeg");
    });

    it("détecte correctement une signature PNG", () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(verifyImageMagicBytes(bytes)).toBe("png");
    });

    it("détecte correctement une signature GIF", () => {
      const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
      expect(verifyImageMagicBytes(bytes)).toBe("gif");
    });

    it("détecte correctement une signature WebP", () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(verifyImageMagicBytes(bytes)).toBe("webp");
    });

    it("rejette les faux fichiers ou scripts", () => {
      const bytes = new Uint8Array(Buffer.from("<script>alert(1)</script>"));
      expect(verifyImageMagicBytes(bytes)).toBeNull();
    });
  });

  describe("containsMaliciousPayload", () => {
    it("détecte les balises de script et SVG malveillantes", () => {
      expect(containsMaliciousPayload(new Uint8Array(Buffer.from("<svg onload=alert(1)>")))).toBe(true);
      expect(containsMaliciousPayload(new Uint8Array(Buffer.from("<?xml version='1.0'?><svg>")))).toBe(true);
      expect(containsMaliciousPayload(new Uint8Array(Buffer.from("<html><body><script>")))).toBe(true);
      expect(containsMaliciousPayload(new Uint8Array(Buffer.from("javascript:alert(1)")))).toBe(true);
    });

    it("ne lève pas de fausse alerte sur des octets binaires réguliers", () => {
      const normalBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x12, 0x34, 0x56, 0x78]);
      expect(containsMaliciousPayload(normalBytes)).toBe(false);
    });
  });

  describe("validateAndSanitizeImageFile", () => {
    it("rejette immédiatement les extensions dangereuses comme SVG ou HTML", async () => {
      const fakeSvg = new File(["<svg></svg>"], "exploit.svg", { type: "image/svg+xml" });
      const result = await validateAndSanitizeImageFile(fakeSvg);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("strictement interdit");
    });

    it("rejette les fichiers dépassant la taille limite", async () => {
      const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "huge.png", { type: "image/png" });
      const result = await validateAndSanitizeImageFile(bigFile, { maxSizeBytes: 2 * 1024 * 1024 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("trop volumineux");
    });

    it("rejette les fichiers avec un faux MIME type mais du contenu binaire invalide", async () => {
      const fakePng = new File(["ceci n'est pas un png"], "test.png", { type: "image/png" });
      const result = await validateAndSanitizeImageFile(fakePng);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Alerte de sécurité");
    });
  });
});
