import { parseFigureSource, type Mapping, type Value } from "../math-c/syntax";

/** Deliberately bounded JSON-Schema subset, serialized unchanged for authors. */
export type Schema = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  default?: Value;
  enum?: readonly Value[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: Schema;
  properties?: Record<string, Schema>;
};
export type ExtensionDiagnostic = {
  severity: "error" | "warning" | "info" | "fatal";
  code: string;
  path: string;
  sourceLine: number;
  message: string;
};
export type ValidationContext = {
  sourceLine: number;
  at: (path: string) => number;
  issue: (
    path: string,
    code: string,
    message: string,
    severity?: ExtensionDiagnostic["severity"]
  ) => void;
};
export type ExtensionRenderContext = {
  sourceLine: number;
  outputMode: "complete" | "questions" | "answers";
  text: (value: string) => string;
  inline: (value: string) => string;
  assetPath?: string;
  assetPaths?: Record<string, string>;
  assets?: Record<string, MaterialAsset>;
  references?: Record<string, ExtensionAnchor>;
};
export type ExtensionAnchor = { key: string; label: string; path?: string };
export type ExtensionReference = { key: string; path: string };
export type MaterialAsset = {
  assetId: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  size: number;
  width: number;
  height: number;
  source?: string;
  license?: string;
  attribution?: string;
  alt: string;
  /** Transport payload lives outside Markdown and is validated at both ends. */
  data: string;
};
export type ExtensionDefinition = {
  type: string;
  kind: "figure" | "content";
  version: number;
  schema: Schema;
  validate?: (config: Mapping, context: ValidationContext) => void;
  render: (config: Mapping, context: ExtensionRenderContext) => string;
  /** Optional native Typst composition of existing validated assets and SVG. */
  renderPdf?: (config: Mapping, context: ExtensionRenderContext) => string;
  assetIds?: (config: Mapping) => string[];
  validateResources?: (
    config: Mapping,
    context: ValidationContext,
    assets: Record<string, MaterialAsset>
  ) => void;
  inlineProperty?: string;
  renderInline?: (config: Mapping, context: ExtensionRenderContext) => string;
  textSamples?: (
    config: Mapping,
    context: Pick<ExtensionRenderContext, "outputMode">
  ) => string[];
  anchors?: (config: Mapping) => ExtensionAnchor[];
  references?: (config: Mapping) => ExtensionReference[];
  documentation: {
    summary: string;
    restrictions: string[];
    errorExample: string;
  };
  examples: Array<{ name: string; source: string }>;
  tests: string[];
  fallback: "source-visible";
};
export type ExtensionResult = {
  ok: boolean;
  config: Mapping;
  diagnostics: ExtensionDiagnostic[];
};

export const object = (properties: Record<string, Schema>): Schema => ({
  type: "object",
  properties,
});
export const string = (overrides: Partial<Schema> = {}): Schema => ({
  type: "string",
  maxLength: 12000,
  ...overrides,
});
export const number = (overrides: Partial<Schema> = {}): Schema => ({
  type: "number",
  minimum: -10000,
  maximum: 10000,
  ...overrides,
});
export const boolean = (defaultValue = false): Schema => ({
  type: "boolean",
  default: defaultValue,
});
export const array = (
  items: Schema,
  overrides: Partial<Schema> = {}
): Schema => ({ type: "array", items, maxItems: 500, ...overrides });
export const point = (normalized = false): Schema =>
  array(
    number({
      minimum: normalized ? 0 : -10000,
      maximum: normalized ? 1 : 10000,
    }),
    { minItems: 2, maxItems: 2 }
  );
export const id = (required = true): Schema =>
  string({ required, minLength: 1, maxLength: 100 });

function clone(value: Value): Value {
  return JSON.parse(JSON.stringify(value));
}
function applySchema(
  value: Value | undefined,
  schema: Schema,
  path: string,
  context: ValidationContext
): Value | undefined {
  if (value === undefined) {
    if (schema.default !== undefined) value = clone(schema.default);
    else {
      if (schema.required)
        context.issue(
          path,
          "REQUIRED_PROPERTY_MISSING",
          `${path} は必須です。`
        );
      return value;
    }
  }
  const actual = Array.isArray(value)
    ? "array"
    : value === null
    ? "null"
    : typeof value;
  const type = schema.type === "integer" ? "number" : schema.type;
  if (
    actual !== type ||
    (schema.type === "integer" && !Number.isInteger(value))
  ) {
    context.issue(
      path,
      "INVALID_PROPERTY_TYPE",
      `${path || "設定"} は ${schema.type} で指定してください。`
    );
    return value;
  }
  if (
    schema.enum &&
    !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))
  )
    context.issue(
      path,
      "INVALID_ENUM",
      `${path}: ${schema.enum.join(" / ")} のいずれかを指定してください。`
    );
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      value < (schema.minimum ?? -Infinity) ||
      value > (schema.maximum ?? Infinity))
  )
    context.issue(
      path,
      "INVALID_NUMERIC_RANGE",
      `${path}: ${schema.minimum ?? "下限なし"}〜${
        schema.maximum ?? "上限なし"
      } の有限数を指定してください。`
    );
  if (
    typeof value === "string" &&
    (value.length < (schema.minLength ?? 0) ||
      value.length > (schema.maxLength ?? 12000))
  )
    context.issue(
      path,
      "INVALID_TEXT_LENGTH",
      `${path}: 文字数を確認してください。`
    );
  if (Array.isArray(value)) {
    if (
      value.length < (schema.minItems ?? 0) ||
      value.length > (schema.maxItems ?? 500)
    )
      context.issue(
        path,
        "INVALID_ARRAY_LENGTH",
        `${path}: ${schema.minItems ?? 0}〜${
          schema.maxItems ?? 500
        }件にしてください。`
      );
    return value
      .slice(0, 500)
      .map(
        (item, index) =>
          applySchema(item, schema.items!, `${path}[${index}]`, context) ?? null
      );
  }
  if (value && typeof value === "object") {
    const output: Mapping = {};
    for (const key of Object.keys(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (["__proto__", "constructor", "prototype"].includes(key))
        context.issue(
          childPath,
          "UNSAFE_PROPERTY",
          `${childPath}: 使用できないキーです。`,
          "fatal"
        );
      else if (!Object.hasOwn(schema.properties ?? {}, key))
        context.issue(
          childPath,
          "UNKNOWN_PROPERTY",
          `${childPath}: 未対応の項目です。`
        );
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      const child = applySchema(
        (value as Mapping)[key],
        childSchema,
        path ? `${path}.${key}` : key,
        context
      );
      if (child !== undefined) output[key] = child;
    }
    return output;
  }
  return value;
}

/** Reuse the same schema checker for JSON sidecars, without a second parser. */
export function validateSchemaValue(value: unknown, schema: Schema) {
  const diagnostics: ExtensionDiagnostic[] = [];
  const context: ValidationContext = {
    sourceLine: 0,
    at: () => 0,
    issue: (path, code, message, severity = "error") =>
      diagnostics.push({ path, code, message, severity, sourceLine: 0 }),
  };
  const normalized = applySchema(value as Value, schema, "", context);
  return { value: normalized, diagnostics };
}

export class ExtensionRegistry {
  private readonly definitions = new Map<string, ExtensionDefinition>();
  register(definition: ExtensionDefinition) {
    if (
      !/^[a-z][a-z0-9-]{1,70}$/u.test(definition.type) ||
      this.definitions.has(definition.type)
    )
      throw new Error(
        `Duplicate or invalid extension type: ${definition.type}`
      );
    if (
      definition.schema.type !== "object" ||
      !definition.examples.length ||
      !definition.tests.length
    )
      throw new Error("Extension needs object schema, examples and tests");
    this.definitions.set(definition.type, definition);
  }
  get(type: string, kind?: ExtensionDefinition["kind"]) {
    const definition = this.definitions.get(type);
    return definition && (!kind || kind === definition.kind)
      ? definition
      : undefined;
  }
  list() {
    return [...this.definitions.values()].sort((a, b) =>
      a.type.localeCompare(b.type)
    );
  }
  parse(type: string, raw: string, sourceLine: number): ExtensionResult {
    const definition = this.get(type);
    if (!definition)
      return {
        ok: false,
        config: {},
        diagnostics: [
          {
            severity: "warning",
            code: "UNKNOWN_EXTENSION_TYPE",
            path: "",
            sourceLine,
            message: `未対応の記法 ${type} です。入力を代替表示します。`,
          },
        ],
      };
    let config: Mapping;
    let locations: Map<string, number>;
    try {
      ({ config, locations } = parseFigureSource(raw, type, sourceLine));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fatal = /__proto__|constructor|prototype|タグ・アンカー/u.test(
        message
      );
      return {
        ok: false,
        config: {},
        diagnostics: [
          {
            severity: fatal ? "fatal" : "error",
            code: fatal ? "UNSAFE_EXTENSION_INPUT" : "INVALID_EXTENSION_SYNTAX",
            path: "",
            sourceLine: Number(message.match(/(\d+)行目/u)?.[1] ?? sourceLine),
            message,
          },
        ],
      };
    }
    const diagnostics: ExtensionDiagnostic[] = [];
    const at = (path: string): number => {
      if (!path) return sourceLine;
      const parent = path.replace(/(?:\.[^.]+|\[\d+\])$/u, "");
      return locations.get(path) ?? (parent === path ? sourceLine : at(parent));
    };
    const context: ValidationContext = {
      sourceLine,
      at,
      issue: (path, code, message, severity = "error") =>
        diagnostics.push({
          severity,
          code,
          path,
          sourceLine: at(path),
          message,
        }),
    };
    const normalized = applySchema(
      config,
      definition.schema,
      "",
      context
    ) as Mapping;
    if (
      !diagnostics.some(
        (issue) => issue.severity === "fatal" || issue.severity === "error"
      )
    )
      definition.validate?.(normalized, context);
    return {
      ok: !diagnostics.some(
        (issue) => issue.severity === "fatal" || issue.severity === "error"
      ),
      config: normalized,
      diagnostics,
    };
  }
  specification() {
    return this.list().map(
      ({
        render: _render,
        renderPdf: _pdf,
        assetIds: _assets,
        validateResources: _resources,
        renderInline: _inline,
        validate: _validate,
        textSamples: _samples,
        anchors: _anchors,
        references: _references,
        ...definition
      }) => ({
        ...definition,
        syntax: `\`\`\`${definition.kind} ${definition.type}\n<YAML mapping>\n\`\`\``,
        ...(definition.inlineProperty
          ? {
              inlineSyntax: `{{${definition.type}:<${definition.inlineProperty}>}}`,
            }
          : {}),
      })
    );
  }
}

export const extensionRegistry = new ExtensionRegistry();
export function assertSafeExtension(result: ExtensionResult) {
  const fatal = result.diagnostics.find((issue) => issue.severity === "fatal");
  if (fatal)
    throw Object.assign(new Error(fatal.message), {
      code: fatal.code,
      sourceLine: fatal.sourceLine,
    });
  return result;
}
