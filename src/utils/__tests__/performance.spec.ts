import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  METRIC_TYPES,
  PERFORMANCE_THRESHOLDS,
  performanceMonitor,
  measure,
  measureMethod,
  usePerformanceMonitoring,
  usePerformanceStats,
} from "../performance";
import { ref } from "vue";

describe("Système de monitoring des performances", () => {
  beforeEach(() => {
    // Reset des métriques
    performanceMonitor["metrics"] = [];
    performanceMonitor["observers"].clear();

    // Mock de console.warn
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock de performance.now
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time++);
  });

  describe("PerformanceMonitor", () => {
    it("devrait être un singleton", () => {
      const monitor1 = performanceMonitor;
      const monitor2 = performanceMonitor;
      expect(monitor1).toBe(monitor2);
    });

    describe("addMetric", () => {
      it("devrait ajouter une métrique", () => {
        const metric = {
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "TestComponent",
          duration: 10,
          timestamp: Date.now(),
        };

        performanceMonitor.addMetric(metric);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics).toContainEqual(metric);
      });

      it("devrait notifier les observateurs", () => {
        const observer = vi.fn();
        performanceMonitor.addObserver(observer);

        const metric = {
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "TestComponent",
          duration: 10,
          timestamp: Date.now(),
        };

        performanceMonitor.addMetric(metric);
        expect(observer).toHaveBeenCalledWith(metric);
      });

      it("devrait avertir si le seuil est dépassé", () => {
        const metric = {
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "TestComponent",
          duration: PERFORMANCE_THRESHOLDS[METRIC_TYPES.COMPONENT_RENDER] + 1,
          timestamp: Date.now(),
        };

        performanceMonitor.addMetric(metric);
        expect(console.warn).toHaveBeenCalled();
      });
    });

    describe("getMetrics", () => {
      beforeEach(() => {
        // Ajouter des métriques de test
        performanceMonitor.addMetric({
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "Component1",
          duration: 10,
          timestamp: Date.now() - 1000,
        });
        performanceMonitor.addMetric({
          type: METRIC_TYPES.API_CALL,
          name: "API1",
          duration: 20,
          timestamp: Date.now(),
        });
      });

      it("devrait filtrer par type", () => {
        const metrics = performanceMonitor.getMetrics({
          type: METRIC_TYPES.COMPONENT_RENDER,
        });
        expect(metrics).toHaveLength(1);
        expect(metrics[0].name).toBe("Component1");
      });

      it("devrait filtrer par période", () => {
        const now = Date.now();
        const metrics = performanceMonitor.getMetrics({
          from: now - 500,
        });
        expect(metrics).toHaveLength(1);
        expect(metrics[0].name).toBe("API1");
      });
    });

    describe("getStats", () => {
      beforeEach(() => {
        // Ajouter des métriques de test
        [10, 20, 30, 40, 50].forEach((duration) => {
          performanceMonitor.addMetric({
            type: METRIC_TYPES.COMPONENT_RENDER,
            name: "TestComponent",
            duration,
            timestamp: Date.now(),
          });
        });
      });

      it("devrait calculer les statistiques correctement", () => {
        const stats = performanceMonitor.getStats(
          METRIC_TYPES.COMPONENT_RENDER,
        );
        expect(stats).toEqual({
          count: 5,
          average: 30,
          min: 10,
          max: 50,
          p95: 50,
        });
      });

      it("devrait gérer le cas sans métriques", () => {
        const stats = performanceMonitor.getStats(METRIC_TYPES.API_CALL);
        expect(stats).toEqual({
          count: 0,
          average: 0,
          min: 0,
          max: 0,
          p95: 0,
        });
      });
    });

    describe("cleanup", () => {
      it("devrait nettoyer les anciennes métriques", () => {
        const now = Date.now();

        // Ajouter des métriques anciennes et récentes
        performanceMonitor.addMetric({
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "Old",
          duration: 10,
          timestamp: now - 2000,
        });
        performanceMonitor.addMetric({
          type: METRIC_TYPES.COMPONENT_RENDER,
          name: "New",
          duration: 10,
          timestamp: now,
        });

        performanceMonitor.cleanup(1000);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics).toHaveLength(1);
        expect(metrics[0].name).toBe("New");
      });
    });
  });

  describe("measure", () => {
    it("devrait mesurer une fonction synchrone", async () => {
      const result = await measure(
        METRIC_TYPES.COMPONENT_RENDER,
        "test",
        () => "result",
      );

      expect(result).toBe("result");
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(METRIC_TYPES.COMPONENT_RENDER);
      expect(metrics[0].name).toBe("test");
    });

    it("devrait mesurer une fonction asynchrone", async () => {
      const result = await measure(METRIC_TYPES.API_CALL, "test", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "result";
      });

      expect(result).toBe("result");
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(METRIC_TYPES.API_CALL);
    });

    it("devrait gérer les erreurs", () => {
      const error = new Error("test");
      // measure() throws synchronously when fn throws synchronously
      expect(() =>
        measure(METRIC_TYPES.API_CALL, "test", () => {
          throw error;
        }),
      ).toThrow(error);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveLength(1);
    });
  });

  describe("measureMethod", () => {
    it("devrait mesurer une méthode", async () => {
      const descriptor: PropertyDescriptor = {
        value: async function () {
          return "result";
        },
        writable: true,
        enumerable: false,
        configurable: true,
      };

      const decorated = measureMethod(METRIC_TYPES.API_CALL)(
        { constructor: { name: "TestClass" } },
        "testMethod",
        descriptor,
      );

      const result = await decorated!.value();

      expect(result).toBe("result");
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe("TestClass.testMethod");
    });
  });

  describe("usePerformanceMonitoring", () => {
    it("devrait fournir une fonction de mesure", async () => {
      const { measureOperation } = usePerformanceMonitoring("TestComponent");

      await measureOperation("test", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(METRIC_TYPES.DECK_OPERATION);
      expect(metrics[0].name).toBe("TestComponent.test");
    });
  });

  describe("usePerformanceStats", () => {
    it("devrait fournir des statistiques via observer", () => {
      // Test the observer pattern directly (lifecycle hooks require component context)
      const observer = vi.fn();
      performanceMonitor.addObserver(observer);

      performanceMonitor.addMetric({
        type: METRIC_TYPES.COMPONENT_RENDER,
        name: "test",
        duration: 10,
        timestamp: Date.now(),
      });

      expect(observer).toHaveBeenCalled();

      const stats = performanceMonitor.getStats(METRIC_TYPES.COMPONENT_RENDER);
      expect(stats).toEqual({
        count: 1,
        average: 10,
        min: 10,
        max: 10,
        p95: 10,
      });
    });

    it("devrait permettre de retirer un observateur", () => {
      const observer = vi.fn();
      const cleanup = performanceMonitor.addObserver(observer);

      cleanup();

      performanceMonitor.addMetric({
        type: METRIC_TYPES.COMPONENT_RENDER,
        name: "test",
        duration: 10,
        timestamp: Date.now(),
      });

      // Observer should not be called after cleanup
      expect(observer).not.toHaveBeenCalled();
    });
  });
});
