/** Bounded recursive-descent arithmetic. Never eval or Function. */
export type Variables = { x?: number; y?: number; t?: number; theta?: number };
type Fn = (v: Variables) => number;
export function expression(source: string): Fn {
  if (source.length > 400) throw new Error("式は400文字以内にしてください");
  const tokens =
    source.match(/(?:\d*\.)?\d+(?:e[+-]?\d+)?|[a-zA-Z]+|\*\*|[+\-*/^(),]/g) ??
    [];
  if (tokens.join("") !== source.replace(/\s/g, ""))
    throw new Error(
      `未対応の式「${source}」。乗算は *、絶対値は abs(x) を使用してください`
    );
  let i = 0,
    depth = 0;
  const funcs: Record<string, (x: number) => number> = {
    abs: Math.abs,
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    exp: Math.exp,
    log: Math.log,
  };
  function primary(): Fn {
    if (++depth > 40) throw new Error("式のネストが深すぎます");
    const token = tokens[i++];
    let fn: Fn;
    if (token === "(") {
      fn = add();
      if (tokens[i++] !== ")") throw new Error("閉じ括弧 ) が必要です");
    } else if (/^(?:\d|\.)/.test(token ?? "")) {
      const n = Number(token);
      fn = () => n;
    } else if (["x", "y", "t", "theta"].includes(token))
      fn = (v) => v[token as keyof Variables] ?? NaN;
    else if (token === "pi" || token === "e")
      fn = () => (token === "pi" ? Math.PI : Math.E);
    else if (funcs[token]) {
      if (tokens[i++] !== "(")
        throw new Error(`${token}(...) を期待しています`);
      const a = add();
      if (tokens[i++] !== ")") throw new Error("閉じ括弧 ) が必要です");
      fn = (v) => funcs[token](a(v));
    } else throw new Error(`未対応の値「${token ?? "式の末尾"}」`);
    depth--;
    return fn;
  }
  function power(): Fn {
    const a = primary();
    if (["^", "**"].includes(tokens[i])) {
      i++;
      const b = unary();
      return (v) => a(v) ** b(v);
    }
    return a;
  }
  function unary(): Fn {
    if (tokens[i] === "+" || tokens[i] === "-") {
      const s = tokens[i++] === "-" ? -1 : 1;
      const a = unary();
      return (v) => s * a(v);
    }
    return power();
  }
  function mul(): Fn {
    let a = unary();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++],
        l = a,
        r = unary();
      a = (v) => (op === "*" ? l(v) * r(v) : l(v) / r(v));
    }
    return a;
  }
  function add(): Fn {
    let a = mul();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++],
        l = a,
        r = mul();
      a = (v) => (op === "+" ? l(v) + r(v) : l(v) - r(v));
    }
    return a;
  }
  const fn = add();
  if (i !== tokens.length)
    throw new Error("式の連結には演算子が必要です（例: 2*x）");
  return fn;
}
export function relation(source: string) {
  const m = source.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
  if (!m)
    throw new Error(
      "condition/equation は x + y <= 4 のように比較演算子を1つ指定してください"
    );
  const a = expression(m[1]),
    b = expression(m[3]);
  return {
    value: (x: number, y: number) => a({ x, y }) - b({ x, y }),
    strict: m[2] === "<" || m[2] === ">",
    test: (x: number, y: number) => {
      const d = a({ x, y }) - b({ x, y });
      return (
        Number.isFinite(d) &&
        (m[2] === "<="
          ? d <= 0
          : m[2] === ">="
          ? d >= 0
          : m[2] === "<"
          ? d < 0
          : m[2] === ">"
          ? d > 0
          : Math.abs(d) < 1e-10)
      );
    },
  };
}
