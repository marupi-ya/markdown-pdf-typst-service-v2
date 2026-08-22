import { buildTypstAst, collectExpectedText } from "./ast";
import { generateFigureSvg } from "./figure-svg";
import { latexToTypstMath } from "./math-adapter";
import { renderTypstTheme } from "./theme";
import type {
  GeneratedTypstProject,
  TypstBlockNode,
  TypstCompileRequest,
  TypstDocumentAst,
  TypstInlineNode,
  TypstSourceMapEntry,
} from "./types";

function typstString(value: string) {
  return JSON.stringify(value.replace(/\u0000/gu, ""));
}

function marker(node: Pick<TypstBlockNode, "sourceLine" | "type">) {
  return `// studio-source:${node.sourceLine}:${node.type}`;
}

function renderInlines(nodes: TypstInlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "InlineText") return `#text(${typstString(node.value)})`;
    if (node.type === "Strong") return `#strong[${renderInlines(node.children)}]`;
    if (node.type === "Emphasis") return `#emph[${renderInlines(node.children)}]`;
    return `$${latexToTypstMath(node.latex, node.sourceLine)}$`;
  }).join("");
}

function inlineLength(nodes: TypstInlineNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "InlineText") return total + node.value.length;
    if (node.type === "InlineMath") return total + Math.max(2, node.latex.length * 0.65);
    return total + inlineLength(node.children);
  }, 0);
}

function inlineWeight(nodes: TypstInlineNode[]) {
  const length = inlineLength(nodes);
  return Math.max(1, Math.min(3.5, Math.sqrt(Math.max(1, length))));
}

function renderTable(node: Extract<TypstBlockNode, { type: "Table" }>) {
  const columns = Math.max(1, node.header.length, ...node.rows.map((row) => row.length));
  const pad = (row: TypstInlineNode[][]) => [
    ...row,
    ...Array.from({ length: Math.max(0, columns - row.length) }, () => [] as TypstInlineNode[]),
  ];
  const header = pad(node.header).map((cell) => `[${renderInlines(cell)}]`).join(",\n    ");
  const rows = node.rows.flatMap((row) => pad(row)).map((cell) => `[${renderInlines(cell)}]`).join(",\n  ");
  const columnWidths = Array.from({ length: columns }, (_, column) => {
    const cells = [node.header[column] ?? [], ...node.rows.map((row) => row[column] ?? [])];
    return Math.max(...cells.map(inlineWeight));
  }).map((weight) => `${weight.toFixed(2)}fr`).join(", ");
  return `${marker(node)}
#block(above: 7pt, below: 8pt)[
  #table(
    columns: (${columnWidths},),
    inset: (x: 5pt, y: 4pt),
    align: left + horizon,
    stroke: 0.55pt + rgb("#c8d2da"),
    fill: (x, y) => if y == 0 { secondary-color } else if calc.even(y) { rgb("#fafcfd") } else { white },
    table.header(repeat: true,
      ${header}
    ),
    ${rows}
  )
]`;
}

function renderBox(node: Extract<TypstBlockNode, { type: "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning" }>) {
  const kind = node.type.toLowerCase();
  const body = node.children.map(renderBlock).join("\n\n");
  return `${marker(node)}
#studio-box(
  ${typstString(kind)},
  [${renderInlines(node.title)}],
  breakable: ${node.policy.allowBreak ? "true" : "false"},
  [
    ${body}
  ],
)`;
}

function renderBlock(node: TypstBlockNode): string {
  if (node.type === "Heading") {
    return `${marker(node)}\n#heading(level: ${node.level})[${renderInlines(node.children)}]`;
  }
  if (node.type === "Paragraph") {
    return `${marker(node)}\n#par()[${renderInlines(node.children)}]`;
  }
  if (node.type === "DisplayMath") {
    const math = latexToTypstMath(node.latex, node.sourceLine);
    return `${marker(node)}
#block(width: 100%, breakable: false, above: 6pt, below: 7pt)[
  #align(center)[$ ${math} $]
]`;
  }
  if (node.type === "List") {
    const renderer = node.ordered ? "enum" : "list";
    const items = node.items.map((item) => `[${renderInlines(item)}]`).join(",\n  ");
    return `${marker(node)}\n#${renderer}(tight: false,\n  ${items}\n)`;
  }
  if (node.type === "Table") return renderTable(node);
  if (["Problem", "Answer", "Explanation", "Point", "Example", "Warning"].includes(node.type)) {
    return renderBox(node as Extract<TypstBlockNode, { type: "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning" }>);
  }
  if (node.type === "Figure") {
    const caption = node.caption.length ? `[${renderInlines(node.caption)}]` : "none";
    return `${marker(node)}
#studio-figure(
  image(${typstString(node.assetPath)}, width: 94%),
  caption: ${caption},
)`;
  }
  if (node.type === "PageBreak") return `${marker(node)}\n#pagebreak()`;
  if (node.type === "Code") {
    return `${marker(node)}\n#raw(${typstString(node.value)}, block: true, lang: ${typstString(node.language || "text")})`;
  }
  return `${marker(node)}\n#line(length: 100%, stroke: 0.6pt + muted-color)`;
}

function sourceMapFromMarkers(source: string): TypstSourceMapEntry[] {
  const lines = source.split("\n");
  const markers: Array<{ line: number; sourceLine: number; nodeType: TypstSourceMapEntry["nodeType"] }> = [];
  lines.forEach((line, index) => {
    const match = line.match(/^\/\/ studio-source:(\d+):([A-Za-z]+)$/u);
    if (!match) return;
    markers.push({
      line: index + 1,
      sourceLine: Number(match[1]),
      nodeType: match[2] as TypstSourceMapEntry["nodeType"],
    });
  });
  return markers.map((item, index) => ({
    generatedStartLine: item.line,
    generatedEndLine: (markers[index + 1]?.line ?? lines.length + 1) - 1,
    sourceLine: item.sourceLine,
    nodeType: item.nodeType,
  }));
}

function documentVariables(ast: TypstDocumentAst) {
  return `#let document-title = ${typstString(ast.metadata.title)}
#let document-subject = ${typstString(ast.metadata.subject)}
#let document-unit = ${typstString(ast.metadata.difficulty)}
#let document-author = ${typstString(ast.metadata.author)}
#let document-copyright = ${typstString(ast.metadata.copyright)}
`;
}

function cover() {
  return `// studio-source:1:Document
#block(height: 75%, width: 100%)[
  #align(center + horizon)[
    #text(size: 24pt, weight: "bold", fill: heading-color)[#document-title]
    #v(14pt)
    #text(size: 12pt, fill: muted-color)[#document-subject　#document-unit]
  ]
]
#pagebreak()`;
}

function collectFigures(nodes: TypstBlockNode[]): Extract<TypstBlockNode, { type: "Figure" }>[] {
  const result: Extract<TypstBlockNode, { type: "Figure" }>[] = [];
  const visit = (node: TypstBlockNode) => {
    if (node.type === "Figure") result.push(node);
    if (["Problem", "Answer", "Explanation", "Point", "Example", "Warning"].includes(node.type)) {
      (node as Extract<TypstBlockNode, { type: "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning" }>).children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return result;
}

export function generateTypstProject(request: TypstCompileRequest): GeneratedTypstProject {
  const ast = buildTypstAst(request.markdown, request.outputMode, request.includeQuestionInAnswer);
  const body = ast.children.map(renderBlock).join("\n\n");
  const source = [
    documentVariables(ast),
    renderTypstTheme(request.theme, request.settings),
    request.settings.includeCover ? cover() : "",
    body,
    "",
  ].filter(Boolean).join("\n");

  const assets = collectFigures(ast.children).map((figure) => {
    try {
      return {
        path: figure.assetPath,
        contents: generateFigureSvg(figure, request.mermaidAssets),
        mediaType: "image/svg+xml" as const,
      };
    } catch (error) {
      throw Object.assign(new Error(
        `${figure.sourceLine}行目の${figure.figureType}をSVGへ変換できません: ${error instanceof Error ? error.message : String(error)}`,
      ), {
        code: "FIGURE_SVG_GENERATION_FAILED",
        sourceLine: figure.sourceLine,
        nodeType: "Figure",
        source: figure.raw,
      });
    }
  });

  return {
    ast,
    source,
    sourceMap: sourceMapFromMarkers(source),
    assets,
    expectedText: collectExpectedText(ast),
  };
}
