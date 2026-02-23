/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Normalizer } from '../../../src/utils/normalizer.js';

describe('Normalizer', () => {
  describe('normalize', () => {
    it('should normalize quotes', () => {
      expect(Normalizer.normalize("const x = 'hello';")).toBe('const x = "hello";');
      expect(Normalizer.normalize('const y = `world`;')).toBe('const y = "world";');
    });

    it('should collapse whitespace', () => {
      expect(Normalizer.normalize('const   x   =  1;')).toBe('const x = 1;');
      expect(Normalizer.normalize('{\n  return;\n}')).toBe('{return;}');
    });

    it('should handle empty input', () => {
      expect(Normalizer.normalize('')).toBe('');
    });
  });

  describe('normalizeType', () => {
    it('should remove whitespace and delimiters', () => {
      expect(Normalizer.normalizeType(' string | number ')).toBe('string|number');
      expect(Normalizer.normalizeType('Promise<void>;')).toBe('Promise<void>');
    });

    it('should remove import qualifiers', () => {
      expect(Normalizer.normalizeType('import("foo").Bar')).toBe('Bar');
    });

    it('should handle empty input', () => {
      expect(Normalizer.normalizeType('')).toBe('');
    });

    it('should handle generic types by removing all whitespace and delimiters', () => {
      expect(Normalizer.normalizeType('Map< string, number >')).toBe('Map<stringnumber>');
    });
  });
});
