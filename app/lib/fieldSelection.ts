export interface FieldSelectionConfig<T extends Record<string, unknown>> {
  allowedFields: (keyof T & string)[];
  defaultFields: (keyof T & string)[];
}

export function parseFieldSelection<T extends Record<string, unknown>>(
  fieldsParam: string | null,
  config: FieldSelectionConfig<T>
): { ok: true; fields: (keyof T & string)[] } | { ok: false; error: string; invalid: string[] } {
  if (!fieldsParam) {
    return { ok: true, fields: config.defaultFields };
  }

  const requested = fieldsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return { ok: true, fields: config.defaultFields };
  }

  const allowedSet = new Set(config.allowedFields);
  const invalid = requested.filter((f) => !allowedSet.has(f));

  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Invalid fields: ${invalid.join(", ")}. Allowed: ${config.allowedFields.join(", ")}`,
      invalid,
    };
  }

  return { ok: true, fields: requested };
}

export function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      (result as Record<string, unknown>)[field] = obj[field];
    }
  }
  return result;
}
