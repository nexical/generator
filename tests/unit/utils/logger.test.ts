import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@nexical/generator/utils/logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEBUG;
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info', () => {
    logger.info('test info');
    expect(console.info).toHaveBeenCalledWith('test info');
  });

  it('should log warn', () => {
    logger.warn('test warn');
    expect(console.warn).toHaveBeenCalledWith('test warn');
  });

  it('should log error', () => {
    logger.error('test error');
    expect(console.error).toHaveBeenCalledWith('test error');
  });

  it('should log error with object', () => {
    const err = new Error('nested');
    logger.error('test error', err);
    expect(console.error).toHaveBeenCalledWith('test error');
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('should log success as info', () => {
    logger.success('test success');
    expect(console.info).toHaveBeenCalledWith('test success');
  });

  it('should not log debug if DEBUG env is not set', () => {
    logger.debug('test debug');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('should log debug if DEBUG env is set', () => {
    process.env.DEBUG = 'true';
    logger.debug('test debug');
    expect(console.info).toHaveBeenCalledWith('test debug');
  });
});
