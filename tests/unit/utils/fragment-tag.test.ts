import { describe, it, expect } from 'vitest';
import { fragment } from '@nexical/generator/utils/fragment-tag.js';

describe('fragment tag', () => {
  it('should return an empty string', () => {
    const result = fragment`some code ${123}`;
    expect(result).toBe('');
  });
});
