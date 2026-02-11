import { type ModelDef } from '../../types.js';

export class ZodHelper {
  static generateSchema(model: ModelDef, allModels: ModelDef[], includeFields?: string[]): string {
    const fields = Object.entries(model.fields)
      .filter(([name, f]) => {
        const typeName = f.type.replace('[]', '');
        const isModel = allModels.some((m) => m.name === typeName);
        const isIdWithDefault =
          name === 'id' && f.attributes?.some((a) => a.startsWith('@default'));

        const isExplicitlyIncluded = includeFields && includeFields.includes(name);

        return (
          (isExplicitlyIncluded ||
            ((!['id', 'createdAt', 'updatedAt', 'passwordUpdatedAt', 'emailVerified'].includes(
              name,
            ) ||
              (name === 'id' && !isIdWithDefault)) &&
              f.api !== false &&
              !f.private)) &&
          !f.isRelation &&
          !isModel
        );
      })
      .map(([name, f]) => {
        let validator = 'z.';
        if (f.isEnum && f.enumValues) {
          validator += `enum([${f.enumValues.map((v) => `'${v}'`).join(', ')}])`;
        } else if (f.isEnum) {
          validator += `nativeEnum(${f.type})`;
        } else {
          switch (f.type) {
            case 'Int':
              validator += 'number().int()';
              break;
            case 'Float':
            case 'Decimal':
              validator += 'number()';
              break;
            case 'Boolean':
              validator += 'boolean()';
              break;
            case 'DateTime':
              validator +=
                'union([z.instanceof(Date), z.string(), z.number()]).pipe(z.coerce.date())';
              break;
            case 'Json':
              validator += 'unknown()';
              break;
            default:
              validator += 'string()';
          }
        }
        if (f.isList) {
          validator = `z.array(${validator})`;
        }
        // Add specific validations if needed (e.g. email)
        if (name === 'email') validator += '.email()';

        if (!f.isRequired || f.isRelation || f.attributes?.some((a) => a.startsWith('@default'))) {
          validator += '.optional().nullable()';
        }

        return `${name}: ${validator}`;
      });

    if (fields.length === 0) {
      return `z.object({})`;
    }

    return `z.object({
    ${fields.join(',\n    ')}
})`;
  }
}
