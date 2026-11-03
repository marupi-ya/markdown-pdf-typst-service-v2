import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildTypstAst } from "../app/pdf-engine/typst/ast";
import { generateTypstProject } from "../app/pdf-engine/typst/generator";
import { extensionRegistry } from "../app/extensions/registry";
import { DEFAULT_SETTINGS } from "../app/theme-settings";
import type { Mapping } from "../app/math-c/syntax";

const reading = extensionRegistry.get("reading-passage")!;
const source = (value: Record<string, unknown>, outputMode: "complete" | "questions" = "complete") =>
  reading.render(value as Mapping, { sourceLine: 1, outputMode, text: text => `#text(${JSON.stringify(text)})`, inline: text => `#text(${JSON.stringify(text)})` });

const sample = {
  id: "passage1", title: "", paragraphNumbers: false, sentenceNumbers: false,
  annotationPresentation: "interlinear", levels: { complete: "detailed", questions: "minimal" },
  paragraphs: [{ id: "p1", sentences: [{ id: "s1", originalText: "Students read books.", annotations: [
    { id: "internal-outer", start: 0, end: 8, role: "S", label: "", style: "underline" },
    { id: "internal-inner", start: 0, end: 8, role: "phrase", label: "", parent: "internal-outer" },
    { id: "internal-third", start: 0, end: 8, role: "modifier", label: "", parent: "internal-inner" },
    { id: "internal-v", start: 9, end: 13, role: "V", label: "" },
    { id: "internal-o", start: 14, end: 19, role: "O", label: "" },
  ] }] }], vocabulary: [], notes: [], vocabularyPlacement: "passage-end", lineNumbers: false,
};

test("nested reading roles use compact parent-first lines without exposing IDs", () => {
  const rendered = source(sample);
  assert.match(rendered, /reading-span-unit\(\[#text\("Students"\)\]/);
  assert.match(rendered, /label:"S",depth:0/);
  assert.match(rendered, /label:"句",depth:1/);
  assert.match(rendered, /label:"修飾",depth:2/);
  assert.equal((rendered.match(/label:"S",depth:0/g) ?? []).length, 6);
  assert.doesNotMatch(rendered, /Paragraph 1|internal-outer \[|internal-inner \[/);
  assert.match(rendered, /used:"interlinear"/);
});

test("one short phrase keeps one centered author label", () => {
  const value = structuredClone(sample);
  value.paragraphs[0].sentences[0].originalText = "The cook keeps a book warm.";
  value.paragraphs[0].sentences[0].annotations = [
    { id: "o1", start: 15, end: 21, role: "O", label: "O1", style: "underline" },
  ];
  const rendered = source(value);
  assert.match(rendered, /reading-span-unit\(\[#text\("a book"\)\]/);
  // The generated Typst contains measured alternatives; one is selected for output.
  assert.equal((rendered.match(/label:"O1"/g) ?? []).length, 6);
  assert.doesNotMatch(rendered, /label:"O",/);
});

test("hierarchy keeps author ranges and places outer roles above inner roles", () => {
  const value = structuredClone(sample);
  value.annotationPresentation = "hierarchy";
  const rendered = source(value);
  assert.match(rendered, /let hierarchy = true/);
  assert.match(rendered, /label:"S",depth:0,role:"S"/);
  assert.match(rendered, /label:"句",depth:1,role:"phrase"/);
  assert.match(rendered, /label:"修飾",depth:2,role:"modifier"/);
  assert.match(rendered, /top-entries = if hierarchy/);
  assert.match(rendered, /lower = if hierarchy/);
  assert.equal((rendered.match(/役割色:/g) ?? []).length, 1);
  assert.doesNotMatch(rendered, /internal-outer \[|internal-inner \[/);
});

test("safe fallback shows labels and reason even at minimal display", () => {
  const value = structuredClone(sample);
  value.paragraphs[0].sentences[0].originalText = "Students\nread books.";
  const rendered = source(value, "questions");
  assert.match(rendered, /注釈を凡例に切替/);
  assert.match(rendered, /S “Students”/);
  assert.doesNotMatch(rendered, /\[internal-outer\]/);
  value.levels.questions = "plain";
  assert.doesNotMatch(source(value, "questions"), /注釈を凡例に切替|S “Students”/);
});

test("blockquote markers are stripped and blank quoted line keeps two paragraphs", () => {
  const markdown = "> First quoted paragraph.\n>\n> Second quoted paragraph.";
  const ast = buildTypstAst(markdown);
  const quoted = ast.children.filter(node => node.type === "Paragraph");
  assert.equal(quoted.length, 2);
  assert.ok(quoted.every(node => node.type === "Paragraph" && node.quoted));
  const project = generateTypstProject({ markdown, outputMode: "complete", includeQuestionInAnswer: true, settings: DEFAULT_SETTINGS, theme: "prep-school-burgundy" });
  assert.equal((project.source.match(/#studio-quote\[/g) ?? []).length, 2);
  assert.doesNotMatch(project.source, /#text\(">/);
});

test("answer-only exercise without title uses visible ordinal", () => {
  const markdown = ':::exercise id="Q01.a"\nWhat is the answer?\n:::\n\n:::solution for="Q01.a"\nThe answer is yes.\n:::';
  const project = generateTypstProject({ markdown, outputMode: "answers", includeQuestionInAnswer: true, settings: DEFAULT_SETTINGS, theme: "prep-school-burgundy" });
  assert.doesNotMatch(project.source, /問題 Q01\.a/);
});
