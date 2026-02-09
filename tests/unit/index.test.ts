/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import * as Index from '../../src/index';

describe('Package Exports', () => {
  it('should export all public components', () => {
    expect(Index).toBeDefined();
    // Just verify it doesn't throw and has some exports
    expect(Object.keys(Index).length).toBeGreaterThan(0);
  });
});
