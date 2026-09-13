/** Deliberately small YAML subset: maps, lists, flow arrays, quoted/plain scalars.
 * No tags, aliases, implicit dates or executable expressions. */
export type Value =
  | string
  | number
  | boolean
  | null
  | Value[]
  | { [key: string]: Value };
export type Mapping = { [key: string]: Value };
export const MATH_C_TYPES = new Set([
  "vector-diagram",
  "complex-plane",
  "region-plot",
  "solid-geometry",
  "parametric-curve",
  "polar-graph",
]);
export function parseFigureSource(raw: string, type: string, sourceLine = 0) {
  const locations = new Map<string, number>();
  const fail = (line: number, message: string): never => {
    throw new Error(`${type}: ${sourceLine + line + 1}行目 ${message}`);
  };
  if (raw.length > 60000) fail(0, "図表は60000文字以内にしてください");
  const lines = raw
    .split(/\r?\n/)
    .map((s, i) => {
      if (/\t/.test(s))
        fail(i, "インデントにはタブではなくスペースを使用してください");
      return {
        text: s.trim(),
        indent: s.length - s.trimStart().length,
        line: i,
      };
    })
    .filter((l) => l.text && !l.text.startsWith("#"));
  function scalar(s: string, line: number): Value {
    s = s.trim();
    if (s.startsWith("[")) {
      if (!s.endsWith("]")) fail(line, "配列の閉じ括弧 ] が必要です");
      const parts: string[] = [];
      let depth = 0,
        quote = "",
        start = 1;
      for (let i = 1; i < s.length - 1; i++) {
        const c = s[i];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === "," && depth === 0) {
          parts.push(s.slice(start, i));
          start = i + 1;
        }
      }
      if (quote || depth) fail(line, "配列または引用符が閉じていません");
      if (s.slice(start, -1).trim()) parts.push(s.slice(start, -1));
      return parts.map((p) => scalar(p, line));
    }
    if (s.startsWith('"') || s.startsWith("'")) {
      if (s.at(-1) !== s[0] || s.length < 2)
        fail(line, "引用符が閉じていません");
      return s.slice(1, -1); // preserve LaTeX backslashes verbatim
    }
    if (s === "true" || s === "false") return s === "true";
    if (s === "null") return null;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return Number(s);
    if (/^[&*!{]/.test(s))
      fail(line, "タグ・アンカー・フロー形式の辞書には対応していません");
    return s;
  }
  let pos = 0;
  function mapEntry(
    target: Mapping,
    text: string,
    indent: number,
    line: number,
    path: string,
    depth: number
  ) {
    const match = text.match(/^([\w-]+):(?:\s+(.*)|\s*)$/);
    if (!match) fail(line, "key: value 形式を期待しています");
    const key = match![1],
      p = path ? `${path}.${key}` : key;
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      Object.hasOwn(target, key)
    )
      fail(line, `${p}: 重複または使用できないキーです`);
    locations.set(p, sourceLine + line + 1);
    if (match![2]?.trim()) target[key] = scalar(match![2], line);
    else if (pos < lines.length && lines[pos].indent > indent)
      target[key] = block(lines[pos].indent, p, depth + 1);
    else target[key] = null;
  }
  function block(indent: number, path: string, depth: number): Value {
    if (depth > 12) fail(lines[pos].line, "ネストが深すぎます（最大12段）");
    const list = lines[pos].text.startsWith("- ");
    const result: Value[] | Mapping = list ? [] : {};
    while (pos < lines.length && lines[pos].indent === indent) {
      const l = lines[pos++];
      if (list) {
        if (!l.text.startsWith("- "))
          fail(l.line, "リスト項目には - が必要です");
        const value = l.text.slice(2),
          p = `${path}[${(result as Value[]).length}]`;
        locations.set(p, sourceLine + l.line + 1);
        if (/^[\w-]+:/.test(value)) {
          const obj: Mapping = {};
          mapEntry(obj, value, indent + 2, l.line, p, depth);
          while (pos < lines.length && lines[pos].indent === indent + 2) {
            const next = lines[pos++];
            mapEntry(obj, next.text, indent + 2, next.line, p, depth);
          }
          (result as Value[]).push(obj);
        } else (result as Value[]).push(scalar(value, l.line));
      } else mapEntry(result as Mapping, l.text, indent, l.line, path, depth);
      if (pos < lines.length && lines[pos].indent > indent)
        fail(
          lines[pos].line,
          "インデントが不正です。リスト内のキーは - の2文字右に揃えてください"
        );
    }
    return result;
  }
  const config = lines.length ? block(lines[0].indent, "", 0) : {};
  if (pos !== lines.length || Array.isArray(config))
    fail(lines[pos]?.line ?? 0, "図表の最上位はキーと値の辞書にしてください");
  return { config: config as Mapping, locations };
}
