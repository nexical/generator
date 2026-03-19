// GENERATED CODE - DO NOT MODIFY
import bcrypt from 'bcryptjs';

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export const factories = {
  teamApi: (index: number) => {
    return {
      name: `name_${index}`,
    };
  },
};
