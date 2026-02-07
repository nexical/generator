import { type JsxAttributeConfig } from '../../types.js';

export class JsxAttributePrimitive {
  constructor(private config: JsxAttributeConfig) {}

  generate(): string {
    const { name, value } = this.config;
    if (value === undefined) {
      return name; // Boolean prop e.g. <Component enabled />
    }

    if (typeof value === 'string') {
      return `${name}="${value}"`;
    }

    // It's an expression { expr }
    return `${name}={${value.expression}}`;
  }
}
