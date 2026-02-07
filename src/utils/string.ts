export function toPascalCase(str: string): string {
  if (!str) return '';
  return (
    str
      // Handle camelCase by inserting a delimiter
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .split(/[\s\-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  );
}

export function toCamelCase(str: string): string {
  if (!str) return '';
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
