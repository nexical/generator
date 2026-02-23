import { describe, it, expect } from 'vitest';
import { toPascalCase, toCamelCase, toKebabCase } from '@nexical/generator/utils/string.js';

describe('string utils', () => {
  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('my-project-api')).toBe('MyProjectApi');
    });

    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('myProjectApi')).toBe('MyProjectApi');
    });

    it('should handle empty strings', () => {
      expect(toPascalCase('')).toBe('');
      // @ts-expect-error - testing null handling
      expect(toPascalCase(null as unknown as string)).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('my-project-api')).toBe('myProjectApi');
    });

    it('should handle empty strings', () => {
      expect(toCamelCase('')).toBe('');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('MyProjectApi')).toBe('my-project-api');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('myProjectApi')).toBe('my-project-api');
    });

    it('should handle spaces and underscores', () => {
      expect(toKebabCase('My Project_Api')).toBe('my-project-api');
    });

    it('should handle empty strings', () => {
      expect(toKebabCase('')).toBe('');
    });
  });
});
