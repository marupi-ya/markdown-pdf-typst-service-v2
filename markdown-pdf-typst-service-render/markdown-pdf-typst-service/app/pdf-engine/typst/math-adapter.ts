import { texToTypst } from "tex-to-typst";

const SUPPORTED_COMMANDS = new Set([
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "varrho", "sigma",
  "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "frac", "dfrac", "tfrac", "sqrt", "binom", "overline", "underline", "vec", "hat", "widehat", "bar",
  "mathbf", "mathrm", "mathit", "mathsf", "mathtt", "mathbb", "mathcal", "text", "operatorname",
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "exp", "lim", "max", "min", "sup", "inf", "det", "gcd",
  "sum", "prod", "int", "iint", "iiint", "oint", "partial", "nabla", "infty",
  "times", "cdot", "div", "pm", "mp", "le", "leq", "ge", "geq", "ne", "neq", "approx", "sim",
  "equiv", "propto", "ll", "gg", "in", "notin", "subset", "subseteq", "supset", "supseteq",
  "cup", "cap", "setminus", "emptyset", "forall", "exists", "therefore", "because",
  "to", "rightarrow", "leftarrow", "leftrightarrow", "Rightarrow", "Leftarrow", "Leftrightarrow",
  "left", "right", "bigl", "bigr", "Bigl", "Bigr", "begin", "end", "displaystyle", "textstyle",
  "quad", "qquad", "colon", "angle", "triangle", "perp", "parallel", "degree", "circ", "prime",
]);

const SUPPORTED_ENVIRONMENTS = new Set([
  "aligned", "align", "align*", "gathered", "gather", "gather*", "cases", "matrix", "pmatrix", "bmatrix",
]);

export class TypstMathAdapterError extends Error {
  code = "UNSUPPORTED_LATEX";
  sourceLine: number;
  latexSource: string;
  details: string[];

  constructor(message: string, sourceLine: number, latexSource: string, details: string[] = []) {
    super(message);
    this.name = "TypstMathAdapterError";
    this.sourceLine = sourceLine;
    this.latexSource = latexSource;
    this.details = details;
  }
}

function unsupportedCommands(source: string) {
  const unsupported = new Set<string>();
  for (const match of source.matchAll(/\\([A-Za-z]+|.)/gu)) {
    const command = match[1];
    if (command.length === 1) {
      if (!["\\", ",", ";", ":", "!", " ", "{", "}", "%", "_", "&", "#"].includes(command)) {
        unsupported.add(`\\${command}`);
      }
      continue;
    }
    if (!SUPPORTED_COMMANDS.has(command)) unsupported.add(`\\${command}`);
  }
  for (const match of source.matchAll(/\\(?:begin|end)\{([^}]+)\}/gu)) {
    if (!SUPPORTED_ENVIRONMENTS.has(match[1])) unsupported.add(match[0]);
  }
  return [...unsupported];
}

function normalizeLatex(source: string) {
  return source
    .trim()
    .replace(/\\displaystyle\b/gu, "")
    .replace(/\\textstyle\b/gu, "")
    .replace(/\\dfrac\b/gu, "\\frac")
    .replace(/\\tfrac\b/gu, "\\frac")
    .replace(/\\,/gu, "\\,")
    .replace(/\u2212/gu, "-");
}

function normalizeConvertedMath(source: string) {
  return source
    // tex-to-typst currently separates decimal digits around the decimal point.
    .replace(/(\d)\.\s+(\d)/gu, "$1.$2")
    .replace(/\\\//gu, "/")
    .replace(/\bupright\(\s*\)/gu, "")
    .replace(/[ \t]+\\[ \t]*/gu, " \\\n")
    .trim();
}

export function latexToTypstMath(latex: string, sourceLine: number) {
  if (!latex.trim()) {
    throw new TypstMathAdapterError("空の数式は変換できません。", sourceLine, latex);
  }
  if (/[#`"\u0000]/u.test(latex)) {
    throw new TypstMathAdapterError(
      "Typstコードとして解釈され得る記号が数式に含まれています。",
      sourceLine,
      latex,
      ["#、二重引用符、バッククォート、制御文字は数式入力で使用できません。"],
    );
  }
  const unsupported = unsupportedCommands(latex);
  if (unsupported.length) {
    throw new TypstMathAdapterError(
      `未対応のLaTeX記法があります: ${unsupported.join("、")}`,
      sourceLine,
      latex,
      unsupported,
    );
  }

  try {
    const converted = normalizeConvertedMath(String(texToTypst(normalizeLatex(latex)).value ?? ""));
    if (!converted || /\\[A-Za-z]+/u.test(converted)) {
      throw new Error("変換後に未解決のコマンドが残りました。");
    }
    return converted;
  } catch (error) {
    if (error instanceof TypstMathAdapterError) throw error;
    throw new TypstMathAdapterError(
      `数式をTypstへ変換できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      sourceLine,
      latex,
    );
  }
}
