export function parseFields(fields: string): Record<string, boolean> {
  if (!fields) {
    return {};
  }

  return fields.split(',').reduce((acc, field) => {
    acc[field.trim()] = true;
    return acc;
  }, {});
}
