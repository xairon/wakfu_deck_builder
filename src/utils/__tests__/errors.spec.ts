import { describe, it, expect } from "vitest";
import { AppError, ValidationError } from "../errors";

describe("Système de gestion d'erreurs", () => {
  describe("Classes d'erreurs", () => {
    it("devrait créer une AppError", () => {
      const error = new AppError("Test error", "TEST_ERROR", { foo: "bar" });
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.details).toEqual({ foo: "bar" });
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it("devrait créer une ValidationError", () => {
      const error = new ValidationError("Invalid data", { field: "name" });
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual({ field: "name" });
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });
});
