import {
  extensionRegistry,
  type MaterialAsset,
  type ExtensionDiagnostic,
} from "./registry";
import { parseFigureSource } from "../math-c/syntax";
import type { ExtensionEntry } from "./document";
export function inspectExtensionResources(
  entries: ExtensionEntry[],
  assets: Record<string, MaterialAsset>
) {
  const diagnostics: Array<ExtensionDiagnostic & { ownerId: string }> = [];
  for (const entry of entries) {
    const definition = extensionRegistry.get(entry.type);
    if (!definition) continue;
    const parsed = entry.config
      ? { ok: true, config: entry.config }
      : extensionRegistry.parse(entry.type, entry.raw ?? "", entry.sourceLine);
    if (!parsed.ok) continue;
    const locations = entry.raw
      ? parseFigureSource(entry.raw, entry.type, entry.sourceLine).locations
      : new Map<string, number>();
    const at = (path: string) => locations.get(path) ?? entry.sourceLine;
    const context = {
      sourceLine: entry.sourceLine,
      at,
      issue: (
        path: string,
        code: string,
        message: string,
        severity: ExtensionDiagnostic["severity"] = "error"
      ) =>
        diagnostics.push({
          ownerId: entry.id,
          path,
          code,
          message,
          severity,
          sourceLine: at(path),
        }),
    };
    for (const key of definition.assetIds?.(parsed.config) ?? [])
      if (!Object.hasOwn(assets, key))
        context.issue(
          "assetId",
          "ASSET_NOT_FOUND",
          `画像 ${key} が登録されていません。画像を取り込むかasset bundleを読み込んでください。`
        );
    if (
      !diagnostics.some(
        (issue) => issue.ownerId === entry.id && issue.severity === "error"
      )
    )
      definition.validateResources?.(parsed.config, context, assets);
  }
  return diagnostics;
}
