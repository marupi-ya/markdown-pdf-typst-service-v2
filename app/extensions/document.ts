import { extensionRegistry, type ExtensionAnchor } from "./registry";
import type { Mapping } from "../math-c/syntax";

/** Namespaces use an unambiguous tuple, never displayed words or text search. */
export const referenceKey = (...parts: string[]) => JSON.stringify(parts);
export const referenceLabel = (key: string) =>
  `studio-target-${Array.from(key)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-")}`;
export const anchorMarkup = (key: string, sourceLine = 0) =>
  `#context metadata((studioAnchor: ${JSON.stringify(
    key
  )},sourceLine:${sourceLine},page:here().page())) <${referenceLabel(key)}>`;
export type ExtensionEntry = {
  id: string;
  type: string;
  raw?: string;
  config?: Mapping;
  sourceLine: number;
  rootId?: string;
};
export function inspectExtensionDocument(entries: ExtensionEntry[]) {
  const anchors: Record<
    string,
    ExtensionAnchor & { ownerId: string; rootId: string; sourceLine: number }
  > = Object.create(null);
  const references: Array<{
    key: string;
    path: string;
    ownerId: string;
    sourceLine: number;
  }> = [];
  const diagnostics: Array<{
    code: string;
    message: string;
    sourceLine: number;
  }> = [];
  const duplicates = new Set<string>();
  for (const entry of entries) {
    const definition = extensionRegistry.get(entry.type);
    if (!definition) continue;
    const parsed = entry.config
      ? { ok: true, config: entry.config }
      : extensionRegistry.parse(entry.type, entry.raw ?? "", entry.sourceLine);
    if (!parsed.ok) continue;
    for (const anchor of definition.anchors?.(parsed.config) ?? []) {
      if (anchors[anchor.key] || duplicates.has(anchor.key)) {
        duplicates.add(anchor.key);
        delete anchors[anchor.key];
        diagnostics.push({
          code: "DUPLICATE_REFERENCE_TARGET",
          message: `参照対象IDが重複しています: ${anchor.key}`,
          sourceLine: entry.sourceLine,
        });
      } else
        anchors[anchor.key] = {
          ...anchor,
          ownerId: entry.id,
          rootId: entry.rootId ?? entry.id,
          sourceLine: entry.sourceLine,
        };
    }
    references.push(
      ...(definition.references?.(parsed.config) ?? []).map((ref) => ({
        ...ref,
        ownerId: entry.id,
        sourceLine: entry.sourceLine,
      }))
    );
  }
  for (const ref of references)
    if (!anchors[ref.key])
      diagnostics.push({
        code: "INVALID_REFERENCE",
        message: `${ref.path}: 一意な参照対象がありません: ${ref.key}`,
        sourceLine: ref.sourceLine,
      });
  return { anchors, references, diagnostics };
}
