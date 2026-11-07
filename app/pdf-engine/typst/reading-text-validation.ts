import { functionGroupSegments } from "../../extensions/english";
import type { Mapping } from "../../math-c/syntax";
import type { TypstBlockNode, TypstDocumentAst } from "./types";

const roleNames: Record<string, string> = { phrase: "句", clause: "節", modifier: "修飾", relative: "関係", conjunction: "接続", ellipsis: "省略", apposition: "同格" };
export type ReadingTextSample = { original: string; displayed: string; labels: Set<string> };
const compact = (text: string) => text.replace(/\s+/gu, "");

/** Preserve authored punctuation; remove only complete extraction lines made of role labels. */
export function matchesReadingText(extracted: string, sample: ReadingTextSample) {
  const lines = extracted.split(/\r?\n/).filter(line => {
    const value = line.trim();
    return !sample.labels.has(value) && !value.split(/\s+/u).every(word => sample.labels.has(word));
  });
  return compact(lines.join("\n")).includes(compact(sample.displayed));
}

/** Exact decorated source for reading blocks; role glyphs never become expected body text. */
export function readingTextSamples(ast: TypstDocumentAst) {
  const samples: ReadingTextSample[] = [];
  const visit = (node: TypstBlockNode) => {
    if (node.type === "Extension" && node.extensionType === "reading-passage") {
      const plain = (node.config.levels as Mapping)[node.outputMode] === "plain";
      const sentences = (node.config.paragraphs as Mapping[]).flatMap(p => p.sentences as Mapping[]);
      // A PDF line can contain the end of one sentence and labels from the next.
      const labels = new Set(sentences.flatMap(s => (s.annotations as Mapping[]).map(a => String(a.label || roleNames[String(a.role)] || a.role))));
      for (const sentence of sentences) {
        const original = String(sentence.originalText);
        samples.push({ original, displayed: plain ? original : functionGroupSegments(original, (sentence.functionGroups ?? []) as Mapping[]).map(s => s.text).join(""), labels: plain ? new Set() : labels });
      }
    } else if ("children" in node && ["Problem", "Answer", "Explanation", "Point", "Example", "Warning"].includes(node.type)) {
      (node.children as TypstBlockNode[]).forEach(visit);
    }
  };
  ast.children.forEach(visit);
  return samples;
}
