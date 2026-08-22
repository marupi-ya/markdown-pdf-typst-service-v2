import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app/studio-client.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("page navigation is kept in the dedicated preview title row", () => {
  const titleRow = client.match(/<div className="preview-title-row">([\s\S]*?)<\/div>\s*<div className="preview-controls">/u);
  assert.ok(titleRow, "preview title row should be separate from the settings toolbar");
  assert.match(titleRow[1], /className="preview-page-controls"/u);
  assert.match(titleRow[1], /label="前のページ"/u);
  assert.match(titleRow[1], /label="次のページ"/u);
});

test("preview controls can shrink without clipping page navigation", () => {
  assert.match(css, /\.preview-titlebar\s*\{[^}]*flex-direction:\s*column;/su);
  assert.match(css, /\.preview-title-row\s*\{[^}]*min-width:\s*0;/su);
  assert.match(css, /\.preview-page-controls\s*\{[^}]*flex-shrink:\s*0;/su);
  assert.match(css, /\.preview-controls\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(106px,\s*1fr\)\);/su);
  assert.doesNotMatch(css, /\.preview-controls button:nth-child/u);
});

test("mobile preview keeps page arrows and simplifies only zoom controls", () => {
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.preview-controls\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/u);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.preview-zoom-controls button\s*\{\s*display:\s*none;/u);
  assert.doesNotMatch(css, /@media \(max-width:\s*760px\)[\s\S]*?\.preview-page-controls[^}]*display:\s*none;/u);
});
