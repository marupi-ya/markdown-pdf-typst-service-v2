import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("../app/theme-settings.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const theme = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("six theme presets are available with safe settings", () => {
  assert.deepEqual(Object.keys(theme.THEME_PRESETS), [
    "standard", "practice", "explanation", "english", "compact", "answer",
  ]);
  for (const preset of Object.values(theme.THEME_PRESETS)) {
    assert.ok(preset.fontSize >= 8 && preset.fontSize <= 16);
    assert.ok(preset.lineHeight >= 1.1 && preset.lineHeight <= 2);
    assert.ok(preset.marginTop >= 8 && preset.marginTop <= 30);
    assert.ok(preset.tableFontSize >= 7 && preset.tableFontSize <= 14);
    assert.ok(preset.codeFontSize >= 7 && preset.codeFontSize <= 14);
  }
});

test("Academic Textbook is an opt-in design with five tokenized colors", () => {
  assert.equal(theme.DEFAULT_SETTINGS.designTheme, "default");
  assert.deepEqual(Object.keys(theme.DESIGN_THEME_LABELS), [
    "default", "academic-textbook", "clean-textbook",
  ]);
  assert.deepEqual(Object.keys(theme.ACADEMIC_COLOR_LABELS), [
    "forest", "navy", "purple", "orange", "burgundy",
  ]);
  const academic = theme.applyDesignTheme(theme.DEFAULT_SETTINGS, "academic-textbook");
  assert.equal(academic.designTheme, "academic-textbook");
  assert.equal(academic.showHeader, true);
  assert.equal(academic.showFooter, true);
  assert.equal(academic.pageNumberPosition, "right");
  const restored = theme.applyDesignTheme(academic, "default");
  assert.equal(restored.designTheme, "default");
  assert.equal(restored.showHeader, theme.THEME_PRESETS.standard.showHeader);
});

test("Clean Textbook is opt-in and reuses the five color variants", () => {
  const clean = theme.applyDesignTheme(theme.DEFAULT_SETTINGS, "clean-textbook");
  assert.equal(clean.designTheme, "clean-textbook");
  assert.equal(clean.showHeader, false);
  assert.equal(clean.showFooter, true);
  assert.equal(clean.pageNumberPosition, "right");
  assert.equal(theme.designThemeSupportsColor("clean-textbook"), true);
  assert.equal(theme.designThemeSupportsColor("academic-textbook"), true);
  assert.equal(theme.designThemeSupportsColor("default"), false);
});

test("preset switching keeps operational and copyright settings", () => {
  const current = { ...theme.DEFAULT_SETTINGS, copyright: "©教材", tolerant: false, autoUpdate: false };
  const next = theme.applyThemePreset(current, "english");
  assert.equal(next.themePreset, "english");
  assert.equal(next.copyright, "©教材");
  assert.equal(next.tolerant, false);
  assert.equal(next.autoUpdate, false);
});

test("import clamps only unsafe numeric values and reports warnings", () => {
  const result = theme.normalizeThemeSettings({
    themePreset: "compact",
    fontSize: 30,
    lineHeight: 0.5,
    marginLeft: 2,
    tableFontSize: 6,
    codeFontSize: 20,
  });
  assert.equal(result.settings.themePreset, "compact");
  assert.equal(result.settings.fontSize, 16);
  assert.equal(result.settings.lineHeight, 1.1);
  assert.equal(result.settings.marginLeft, 8);
  assert.equal(result.settings.tableFontSize, 7);
  assert.equal(result.settings.codeFontSize, 14);
  assert.equal(result.warnings.length, 5);
});

test("invalid fields do not stop the remaining theme import", () => {
  const result = theme.normalizeThemeSettings({
    settings: {
      themePreset: "answer",
      showHeader: true,
      showFooter: "yes",
      pageNumberPosition: "outside",
      copyright: "©解答",
    },
  });
  assert.equal(result.settings.themePreset, "answer");
  assert.equal(result.settings.showHeader, true);
  assert.equal(result.settings.showFooter, true);
  assert.equal(result.settings.pageNumberPosition, "center");
  assert.equal(result.settings.copyright, "©解答");
  assert.equal(result.warnings.length, 2);
});

test("legacy margin and color theme settings migrate safely", () => {
  const result = theme.normalizeThemeSettings({ margin: 20, theme: "navy", fontSize: 10 });
  assert.equal(result.settings.themePreset, "explanation");
  assert.equal(result.settings.marginTop, 20);
  assert.equal(result.settings.marginRight, 20);
  assert.equal(result.settings.marginBottom, 20);
  assert.equal(result.settings.marginLeft, 20);
  assert.equal(result.settings.fontSize, 10);
});

test("theme JSON round-trips without losing custom settings", () => {
  const custom = {
    ...theme.applyThemePreset(theme.DEFAULT_SETTINGS, "practice"),
    marginLeft: 23,
    showExerciseBox: false,
    pageNumberPosition: "right",
  };
  const restored = theme.normalizeThemeSettings(JSON.parse(theme.serializeThemeSettings(custom)));
  assert.deepEqual(restored.settings, custom);
  assert.deepEqual(restored.warnings, []);
});
