/**
 * A dummy tag function for use in .tsf (Virtual Document) files.
 * This allows IDEs (VSCode) to provide syntax highlighting and type checking
 * even though the actual parsing happens at runtime via the Generator's TemplateLoader.
 */
export const fragment = (strings: TemplateStringsArray, ...values: unknown[]) => '';
