import {
  createRenderDocument,
  parseDocument,
  type OutputMode,
  type StudioBlock,
} from "../../studio-core";
import type {
  TypstBlockNode,
  TypstBoxVariant,
  TypstBreakPolicy,
  TypstDocumentAst,
  TypstInlineNode,
} from "./types";

function pushText(nodes: TypstInlineNode[], value: string) {
  if (!value) return;
  const previous = nodes.at(-1);
  if (previous?.type === "InlineText") previous.value += value;
  else nodes.push({ type: "InlineText", value });
}

function findUnescaped(source: string, token: string, from: number) {
  let cursor = from;
  while (cursor < source.length) {
    const index = source.indexOf(token, cursor);
    if (index === -1) return -1;
    let backslashes = 0;
    for (let probe = index - 1; probe >= 0 && source[probe] === "\\"; probe -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return index;
    cursor = index + token.length;
  }
  return -1;
}

/**
 * Parse the inline subset already used by教材Markdown into a small semantic
 * tree. User text never becomes raw Typst code later in the pipeline.
 */
export function parseTypstInline(source: string, sourceLine: number): TypstInlineNode[] {
  const normalized = source.replace(/\r\n?/gu, "\n").replace(/\n+/gu, " ");
  const nodes: TypstInlineNode[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    if (normalized[cursor] === "\\" && cursor + 1 < normalized.length) {
      pushText(nodes, normalized[cursor + 1]);
      cursor += 2;
      continue;
    }

    if (normalized.startsWith("**", cursor)) {
      const close = findUnescaped(normalized, "**", cursor + 2);
      if (close !== -1) {
        nodes.push({
          type: "Strong",
          children: parseTypstInline(normalized.slice(cursor + 2, close), sourceLine),
        });
        cursor = close + 2;
        continue;
      }
    }

    if (normalized[cursor] === "*" || normalized[cursor] === "_") {
      const marker = normalized[cursor];
      const close = findUnescaped(normalized, marker, cursor + 1);
      if (close > cursor + 1) {
        nodes.push({
          type: "Emphasis",
          children: parseTypstInline(normalized.slice(cursor + 1, close), sourceLine),
        });
        cursor = close + 1;
        continue;
      }
    }

    if (normalized[cursor] === "$" && normalized[cursor + 1] !== "$") {
      const close = findUnescaped(normalized, "$", cursor + 1);
      if (close > cursor + 1) {
        nodes.push({
          type: "InlineMath",
          latex: normalized.slice(cursor + 1, close),
          sourceLine,
        });
        cursor = close + 1;
        continue;
      }
    }

    if (normalized[cursor] === "[") {
      const labelEnd = findUnescaped(normalized, "]", cursor + 1);
      if (labelEnd !== -1 && normalized[labelEnd + 1] === "(") {
        const urlEnd = findUnescaped(normalized, ")", labelEnd + 2);
        if (urlEnd !== -1) {
          nodes.push(...parseTypstInline(normalized.slice(cursor + 1, labelEnd), sourceLine));
          cursor = urlEnd + 1;
          continue;
        }
      }
    }

    if (normalized[cursor] === "`" && normalized[cursor + 1] !== "`") {
      const close = findUnescaped(normalized, "`", cursor + 1);
      if (close !== -1) {
        pushText(nodes, normalized.slice(cursor + 1, close));
        cursor = close + 1;
        continue;
      }
    }

    let next = cursor + 1;
    while (next < normalized.length && !"\\*_[$`".includes(normalized[next])) next += 1;
    pushText(nodes, normalized.slice(cursor, next));
    cursor = next;
  }

  return nodes;
}

function textLength(inlines: TypstInlineNode[]): number {
  return inlines.reduce((total, node) => {
    if (node.type === "InlineText") return total + node.value.length;
    if (node.type === "InlineMath") return total + node.latex.length;
    return total + textLength(node.children);
  }, 0);
}

type TypstBoxNode = Extract<TypstBlockNode, {
  type: "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning";
}>;

function isTypstBoxNode(node: TypstBlockNode): node is TypstBoxNode {
  return node.type === "Problem"
    || node.type === "Answer"
    || node.type === "Explanation"
    || node.type === "Point"
    || node.type === "Example"
    || node.type === "Warning";
}

function nodeTextLength(nodes: TypstBlockNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "Paragraph" || node.type === "Heading") return total + textLength(node.children);
    if (node.type === "DisplayMath") return total + node.latex.length;
    if (node.type === "List") return total + node.items.reduce((sum, item) => sum + textLength(item), 0);
    if (node.type === "Table") {
      return total + [...node.header, ...node.rows.flat()].reduce((sum, cell) => sum + textLength(cell), 0);
    }
    if (isTypstBoxNode(node)) {
      return total + textLength(node.title) + nodeTextLength(node.children);
    }
    if (node.type === "Code") return total + node.value.length;
    return total;
  }, 0);
}

function defaultPolicy(overrides: Partial<TypstBreakPolicy> = {}): TypstBreakPolicy {
  return {
    keepTogether: false,
    keepWithNext: false,
    allowBreak: true,
    ...overrides,
  };
}

function parseList(block: StudioBlock): TypstBlockNode {
  const lines = block.markdown.split("\n");
  const ordered = /^\s*\d+[.)]\s+/u.test(lines[0] ?? "");
  const items = lines
    .filter((line) => /^(?:\s*[-+*]\s+|\s*\d+[.)]\s+)/u.test(line))
    .map((line) => parseTypstInline(
      line.replace(/^(?:\s*[-+*]\s+|\s*\d+[.)]\s+)/u, ""),
      block.startLine,
    ));
  return {
    id: block.id,
    type: "List",
    sourceLine: block.startLine,
    ordered,
    items,
    policy: defaultPolicy(),
  };
}

function splitTableRow(line: string) {
  const normalized = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of normalized) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function parseTable(block: StudioBlock): TypstBlockNode {
  const lines = block.markdown.split("\n").filter((line) => line.trim());
  const header = splitTableRow(lines[0] ?? "").map((cell) => parseTypstInline(cell, block.startLine));
  const rows = lines.slice(2).map((line, rowIndex) =>
    splitTableRow(line).map((cell) => parseTypstInline(cell, block.startLine + rowIndex + 2))
  );
  return {
    id: block.id,
    type: "Table",
    sourceLine: block.startLine,
    header,
    rows,
    policy: defaultPolicy(),
  };
}

export function typstFigureAssetPath(block: Pick<StudioBlock, "startLine" | "figureType">) {
  const type = (block.figureType || "figure").replace(/[^a-z0-9-]/giu, "-").toLowerCase();
  return `assets/figure-${block.startLine}-${type}.svg`;
}

function calloutType(blockName?: string): Extract<TypstBlockNode["type"], "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning"> {
  if (blockName === "exercise" || blockName === "answer-question") return "Problem";
  if (blockName === "solution") return "Answer";
  if (blockName === "key-point") return "Point";
  if (blockName === "example") return "Example";
  if (blockName === "caution") return "Warning";
  return "Explanation";
}

function defaultCalloutTitle(block: StudioBlock, type: ReturnType<typeof calloutType>) {
  if (block.title) {
    // 「例題32辺…」のように問題番号と本文が連結して見えないよう、
    // 教材でよく使う番号付きタイトルだけに明確な区切りを補う。
    return block.title.replace(
      /^((?:例題|演習|問題|練習)\s*\d+)\s+(.+)$/u,
      "$1：$2",
    );
  }
  if (type === "Problem") return "問題";
  if (type === "Answer") return "解答・解説";
  if (type === "Point") return "ポイント";
  if (type === "Example") return "例題";
  if (type === "Warning") return "注意";
  if (block.blockName === "learning-goals") return "学習目標";
  if (block.blockName === "definition") return "定義";
  if (block.blockName === "summary") return "まとめ";
  return "解説";
}

function calloutVariant(blockName?: string): TypstBoxVariant {
  if (blockName === "learning-goals") return "learning-goals";
  if (blockName === "definition") return "definition";
  if (blockName === "key-point") return "key-point";
  if (blockName === "example") return "example";
  if (blockName === "exercise") return "exercise";
  if (blockName === "answer-question") return "answer-question";
  if (blockName === "solution") return "solution";
  if (blockName === "caution") return "caution";
  if (blockName === "summary") return "summary";
  return "explanation";
}

function containsLargeFixedChild(nodes: TypstBlockNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "Figure" || node.type === "Table") return true;
    return isTypstBoxNode(node) && containsLargeFixedChild(node.children);
  });
}

function blockToTypstNode(block: StudioBlock): TypstBlockNode {
  if (block.type === "heading") {
    return {
      id: block.id,
      type: "Heading",
      sourceLine: block.startLine,
      level: Math.min(4, Math.max(1, block.level ?? 2)),
      children: parseTypstInline(block.markdown, block.startLine),
      policy: defaultPolicy({ keepTogether: true, keepWithNext: true, allowBreak: false }),
    };
  }
  if (block.type === "paragraph") {
    return {
      id: block.id,
      type: "Paragraph",
      sourceLine: block.startLine,
      children: parseTypstInline(block.markdown, block.startLine),
      policy: defaultPolicy(),
    };
  }
  if (block.type === "math") {
    return {
      id: block.id,
      type: "DisplayMath",
      sourceLine: block.startLine,
      latex: block.raw ?? block.markdown.replace(/^\$\$|\$\$$/gu, ""),
      policy: defaultPolicy({ keepTogether: true, allowBreak: false }),
    };
  }
  if (block.type === "list") return parseList(block);
  if (block.type === "table") return parseTable(block);
  if (block.type === "figure") {
    return {
      id: block.id,
      type: "Figure",
      sourceLine: block.startLine,
      figureType: block.figureType ?? "unknown",
      raw: block.raw ?? "",
      params: { ...(block.params ?? {}) },
      caption: parseTypstInline(block.params?.caption ?? "", block.startLine),
      assetPath: typstFigureAssetPath(block),
      policy: defaultPolicy({ keepTogether: true, allowBreak: false }),
    };
  }
  if (block.type === "page-break") {
    return {
      id: block.id,
      type: "PageBreak",
      sourceLine: block.startLine,
      policy: defaultPolicy({ keepTogether: true, allowBreak: false }),
    };
  }
  if (block.type === "code") {
    return {
      id: block.id,
      type: "Code",
      sourceLine: block.startLine,
      language: block.blockName ?? "text",
      value: block.raw ?? block.markdown,
      policy: defaultPolicy(),
    };
  }
  if (block.type === "hr") {
    return {
      id: block.id,
      type: "Divider",
      sourceLine: block.startLine,
      policy: defaultPolicy({ keepTogether: true, allowBreak: false }),
    };
  }

  const type = calloutType(block.blockName);
  const children = (block.children?.length ? block.children : [{
    ...block,
    id: `${block.id}-body`,
    type: "paragraph" as const,
    markdown: block.markdown,
    children: undefined,
  }]).map(blockToTypstNode);
  const length = nodeTextLength(children);
  const meaningfulChildren = children.filter((child) => child.type !== "Divider").length;
  const variant = calloutVariant(block.blockName);
  const hasLargeFixedChild = containsLargeFixedChild(children);
  const shortProblem = type === "Problem"
    && length <= 900
    && meaningfulChildren <= 7
    && !hasLargeFixedChild;
  const shortAnswer = type === "Answer"
    && length <= 900
    && meaningfulChildren <= 16
    && !hasLargeFixedChild;
  const shortNotice = ["Point", "Example", "Warning"].includes(type) && length <= 620 && meaningfulChildren <= 4;
  const shortReferenceBox = type === "Explanation"
    && ["definition", "learning-goals", "summary"].includes(variant)
    && length <= 850
    && meaningfulChildren <= 9
    && !hasLargeFixedChild;
  const keepTogether = shortProblem || shortAnswer || shortNotice || shortReferenceBox;
  return {
    id: block.id,
    type,
    variant,
    sourceLine: block.startLine,
    title: parseTypstInline(defaultCalloutTitle(block, type), block.startLine),
    children,
    policy: defaultPolicy({ keepTogether, allowBreak: !keepTogether }),
  };
}

export function buildTypstAst(
  source: string,
  outputMode: Exclude<OutputMode, "split"> = "complete",
  includeQuestionInAnswer = true,
): TypstDocumentAst {
  const parsed = parseDocument(source);
  const errors = parsed.issues.filter((issue) => issue.severity === "error");
  if (errors.length) {
    const error = errors[0];
    throw Object.assign(new Error(`${error.line}行目: ${error.title}。${error.reason}`), {
      code: "MARKDOWN_VALIDATION_FAILED",
      sourceLine: error.line,
      nodeType: error.blockType,
      details: errors.map((issue) => `${issue.line}行目: ${issue.title}`),
    });
  }
  const renderDocument = createRenderDocument(parsed, outputMode, includeQuestionInAnswer);
  return {
    type: "Document",
    metadata: renderDocument.metadata,
    children: renderDocument.blocks.map(blockToTypstNode),
  };
}

export function collectExpectedText(ast: TypstDocumentAst) {
  const samples: string[] = [];
  const inlineText = (nodes: TypstInlineNode[]): string => nodes.map((node): string => {
    if (node.type === "InlineText") return node.value;
    if (node.type === "InlineMath") return "";
    return inlineText(node.children);
  }).join("");
  const visit = (node: TypstBlockNode) => {
    if (node.type === "Heading" || node.type === "Paragraph") {
      const value = inlineText(node.children).trim();
      if (value.length >= 4) samples.push(value.slice(0, 80));
    } else if (isTypstBoxNode(node)) {
      const title = inlineText(node.title).trim();
      if (title) samples.push(title);
      node.children.forEach(visit);
    } else if (node.type === "List") {
      node.items.forEach((item) => {
        const value = inlineText(item).trim();
        if (value.length >= 4) samples.push(value.slice(0, 80));
      });
    }
  };
  ast.children.forEach(visit);
  return [...new Set(samples)].slice(0, 30);
}
