import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app/studio-client.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const overflow = await readFile(new URL("../app/pagination/overflow.ts", import.meta.url), "utf8");

test("textbook color variants contain tokens only", () => {
  for (const variant of ["forest", "navy", "purple", "orange", "burgundy"]) {
    const block = css.match(new RegExp(`\\.design-academic-textbook\\.academic-color-${variant},\\s*\\.design-clean-textbook\\.academic-color-${variant}\\s*\\{([^}]*)\\}`, "u"));
    assert.ok(block, `${variant} token block should exist`);
    assert.match(block[1], /--theme-accent:/u);
    assert.match(block[1], /--theme-accent-strong:/u);
    assert.match(block[1], /--theme-accent-pale:/u);
    assert.doesNotMatch(block[1], /(?:margin|padding|display|position)\s*:/u);
  }
});

test("the shared Page DOM and measurement DOM receive the same design classes", () => {
  assert.match(client, /function lessonThemeClass\(settings: StudioSettings\)/u);
  assert.match(client, /`design-\$\{settings\.designTheme\}`/u);
  const uses = client.match(/lessonThemeClass\(settings\)/gu) ?? [];
  assert.ok(uses.length >= 2, "canonical pages and the measurement rack should share the class builder; PDF and batch clone those pages");
});

test("single and batch UIs expose textbook color controls", () => {
  assert.match(client, /aria-label="デザインテーマ"/u);
  assert.match(client, /aria-label="デザインカラー"/u);
  assert.match(client, /function AcademicColorPicker/u);
  assert.match(client, /activeOptions\.settings\.designTheme/u);
});

test("Clean Textbook uses the restrained reference treatment without layout-only color variants", () => {
  assert.match(css, /\.design-clean-textbook \.paper-content h2[^}]*border-bottom:[^}]*var\(--theme-accent-strong\)/su);
  assert.match(css, /\.design-clean-textbook \.callout-title svg\s*\{[^}]*display:\s*none/su);
  assert.match(css, /\.design-clean-textbook \.callout-example,[^}]*\.design-clean-textbook \.callout-solution/su);
  assert.match(css, /\.design-clean-textbook \.paper-content th\s*\{[^}]*background:\s*transparent/su);
  assert.doesNotMatch(css, /\.design-clean-textbook[^}]*grid-template-columns/su);
});

test("Clean Textbook marks its intentionally borderless explanation without disabling frame QA elsewhere", () => {
  assert.match(css, /\.lesson-callout\s*\{[^}]*--pagination-box-frame-mode:\s*required/su);
  assert.match(css, /\.design-clean-textbook \.callout-explanation\s*\{[^}]*--pagination-box-frame-mode:\s*intentional-none/su);
  assert.match(overflow, /getPropertyValue\("--pagination-box-frame-mode"\)/u);
  assert.match(overflow, /frameMode !== "intentional-none"/u);
});

test("semantic warning colors stay independent from theme accent", () => {
  const academic = css.match(/\.design-academic-textbook\s*\{([^}]*)\}/u);
  assert.ok(academic);
  assert.match(academic[1], /--semantic-warning:/u);
  assert.doesNotMatch(academic[1], /--semantic-warning:\s*var\(--theme-accent\)/u);
  assert.match(css, /\.design-academic-textbook \.callout-caution[^}]*var\(--semantic-warning-border\)/su);
});
