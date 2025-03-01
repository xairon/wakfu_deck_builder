import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppError,
  ValidationError,
  NetworkError,
  StorageError,
  LimitError,
  withRetry,
  validate,
  errorHandler
} from '../errors';

describe('Système de gestion d\'erreurs', () => {
  describe('Classes d\'erreurs', () => {
    it('devrait créer une AppError', () => {
      const error = new AppError('Test error', 'TEST_ERROR', { foo: 'bar' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('devrait créer une ValidationError', () => {
      const error = new ValidationError('Invalid data', { field: 'name' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('devrait créer une NetworkError', () => {
      const error = new NetworkError('Network failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NetworkError);
    });

    it('devrait créer une StorageError', () => {
      const error = new StorageError('Storage failed');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(StorageError);
    });

    it('devrait créer une LimitError', () => {
      const error = new LimitError('Limit exceeded');
      expect(error.code).toBe('LIMIT_ERROR');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(LimitError);
    });
  });

  describe('withRetry', () => {
    let operation: () => Promise<string>;
    let failingOperation: () => Promise<never>;

    beforeEach(() => {
      operation = vi.fn().mockResolvedValue('success');
      failingOperation = vi.fn().mockRejectedValue(new NetworkError('Failed'));
      vi.useFakeTimers();
    });

    it('devrait réussir au premier essai', async () => {
      const result = await withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('devrait réessayer en cas d\'échec', async () => {
      failingOperation
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValueOnce('success');

      const result = await withRetry(failingOperation);
      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(2);
    });

    it('devrait respecter le nombre maximum de tentatives', async () => {
      await expect(withRetry(failingOperation, { retries: 2 }))
        .rejects
        .toThrow(NetworkError);
      expect(failingOperation).toHaveBeenCalledTimes(2);
    });

    it('devrait utiliser un backoff exponentiel', async () => {
      failingOperation.mockRejectedValue(new NetworkError('Failed'));

      const promise = withRetry(failingOperation, {
        retries: 3,
        baseDelay: 1000
      });

      // Première tentative échoue
      await vi.advanceTimersByTimeAsync(0);
      expect(failingOperation).toHaveBeenCalledTimes(1);

      // Deuxième tentative après 1s
      await vi.advanceTimersByTimeAsync(1000);
      expect(failingOperation).toHaveBeenCalledTimes(2);

      // Troisième tentative après 2s
      await vi.advanceTimersByTimeAsync(2000);
      expect(failingOperation).toHaveBeenCalledTimes(3);

      await expect(promise).rejects.toThrow(NetworkError);
    });
  });

  describe('validate', () => {
    const schema = {
      name: (value: string) => value.length >= 3,
      age: (value: number) => value >= 18
    };

    it('devrait valider des données correctes', () => {
      const data = { name: 'John', age: 20 };
      const result = validate(data, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('devrait détecter les erreurs de validation', () => {
      const data = { name: 'Jo', age: 16 };
      const result = validate(data, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('devrait utiliser les messages personnalisés', () => {
      const data = { name: 'Jo', age: 16 };
      const messages = {
        name: 'Nom trop court',
        age: 'Doit être majeur'
      };

      const result = validate(data, schema, { customMessages: messages });
      expect(result.errors).toContain('Nom trop court');
      expect(result.errors).toContain('Doit être majeur');
    });

    it('devrait lancer une erreur si demandé', () => {
      const data = { name: 'Jo', age: 16 };
      expect(() => validate(data, schema, { throwOnError: true }))
        .toThrow(ValidationError);
    });
  });

  describe('ErrorHandler', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('devrait être un singleton', () => {
      const handler1 = ErrorHandler.getInstance();
      const handler2 = ErrorHandler.getInstance();
      expect(handler1).toBe(handler2);
    });

    it('devrait gérer les erreurs applicatives', () => {
      const error = new ValidationError('Invalid data');
      errorHandler.handle(error);
      expect(console.error).toHaveBeenCalledWith(
        'Erreur de validation:',
        'Invalid data',
        undefined
      );
    });

    it('devrait gérer les erreurs inconnues', () => {
      const error = new Error('Unknown error');
      errorHandler.handle(error);
      expect(console.error).toHaveBeenCalledWith(
        'Erreur inconnue:',
        error
      );
    });
  });
}); 