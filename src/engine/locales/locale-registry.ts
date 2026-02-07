export class LocaleRegistry {
  private static instance: LocaleRegistry;
  private locales: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): LocaleRegistry {
    if (!LocaleRegistry.instance) {
      LocaleRegistry.instance = new LocaleRegistry();
    }
    return LocaleRegistry.instance;
  }

  /**
   * Registers a semantic key with its default English text.
   * Returns the key so it can be used inline in code generation.
   * const title = LocaleRegistry.register('user.table.title', 'User Management');
   */
  public static register(key: string, defaultText: string): string {
    const registry = LocaleRegistry.getInstance();
    if (!registry.locales.has(key)) {
      registry.locales.set(key, defaultText);
    }
    return key;
  }

  public static getAll(): Record<string, unknown> {
    const registry = LocaleRegistry.getInstance();
    // Convert Map to nested object structure for JSON output
    const output: Record<string, unknown> = {};

    for (const [key, value] of registry.locales.entries()) {
      const parts = key.split('.');
      let current = output;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = value;
        } else {
          current[part] = (current[part] || {}) as Record<string, unknown>;
          current = current[part] as Record<string, unknown>;
        }
      }
    }

    return output;
  }

  public static clear(): void {
    LocaleRegistry.getInstance().locales.clear();
  }
}
