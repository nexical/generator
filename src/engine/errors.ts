export class GeneratorError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'GeneratorError';
    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, GeneratorError.prototype);
  }
}
