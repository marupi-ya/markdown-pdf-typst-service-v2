import {
  extensionRegistry,
  object,
  string,
  number,
  array,
  point,
  id,
  type ExtensionDefinition,
  type ExtensionRenderContext,
} from "./registry";
import type { Mapping, Value } from "../math-c/syntax";
import { SvgScene, xml, textWidth, type Point2 } from "./layout";

const ELEMENTS = new Set(
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(
    " "
  )
);
export type ChemicalFormula = {
  formula: string;
  charge: number;
  elements: Record<string, number>;
  tokens: Array<{ text: string; subscript?: boolean }>;
};
/** Explicit finite chemical grammar, never an expression evaluator. */
export function parseChemicalFormula(input: string): ChemicalFormula {
  if (input.length > 240 || !input || /[^A-Za-z0-9()[\].·^+\-]/u.test(input))
    throw new Error(
      "化学式は元素記号・整数添字・括弧・電荷だけで指定してください。"
    );
  if (input === "e-")
    return { formula: "e", charge: -1, elements: {}, tokens: [{ text: "e" }] };
  let source = input,
    charge = 0;
  const explicit = source.match(/\^(\d*)([+-])$/u);
  if (explicit) {
    charge = (explicit[2] === "+" ? 1 : -1) * Number(explicit[1] || 1);
    source = source.slice(0, -explicit[0].length);
  } else if (/[+-]$/u.test(source)) {
    const monatomic = source.match(/^([A-Z][a-z]?)(\d+)([+-])$/u);
    if (monatomic) {
      charge = (monatomic[3] === "+" ? 1 : -1) * Number(monatomic[2]);
      source = monatomic[1];
    } else {
      charge = source.endsWith("+") ? 1 : -1;
      source = source.slice(0, -1);
    }
  }
  if (!Number.isSafeInteger(charge) || Math.abs(charge) > 20)
    throw new Error("電荷は整数で絶対値20以下にしてください。");
  if (/[+-]$/u.test(input) && charge === 0)
    throw new Error("明示的なイオン電荷の大きさは1以上にしてください。");
  let cursor = 0;
  const tokens: ChemicalFormula["tokens"] = [];
  const multiply = (
    target: Record<string, number>,
    items: Record<string, number>,
    factor: number
  ) => {
    for (const [element, count] of Object.entries(items)) {
      target[element] = (target[element] ?? 0) + count * factor;
      if (target[element] > 1000000)
        throw new Error("元素数が上限を超えています。");
    }
  };
  const readNumber = () => {
    const found = source.slice(cursor).match(/^\d+/u)?.[0];
    if (!found) return 1;
    cursor += found.length;
    const n = Number(found);
    if (!Number.isSafeInteger(n) || n < 1 || n > 1000)
      throw new Error("添字は1〜1000の整数にしてください。");
    tokens.push({ text: found, subscript: true });
    return n;
  };
  function group(close = "", depth = 0): Record<string, number> {
    if (depth > 8) throw new Error("化学式の括弧が深すぎます。");
    const elements: Record<string, number> = {};
    let count = 0;
    while (
      cursor < source.length &&
      source[cursor] !== close &&
      !".·".includes(source[cursor])
    ) {
      const char = source[cursor];
      if (char === "(" || char === "[") {
        cursor++;
        tokens.push({ text: char });
        const end = char === "(" ? ")" : "]";
        const nested = group(end, depth + 1);
        if (source[cursor] !== end)
          throw new Error("化学式の括弧が閉じていません。");
        cursor++;
        tokens.push({ text: end });
        multiply(elements, nested, readNumber());
        count++;
      } else {
        const symbol = source.slice(cursor).match(/^[A-Z][a-z]?/u)?.[0];
        if (!symbol || !ELEMENTS.has(symbol))
          throw new Error(`未対応または不正な元素記号: ${symbol ?? char}`);
        cursor += symbol.length;
        tokens.push({ text: symbol });
        elements[symbol] = (elements[symbol] ?? 0) + readNumber();
        count++;
      }
    }
    if (!count) throw new Error("空の化学式・括弧は使用できません。");
    return elements;
  }
  const elements: Record<string, number> = {};
  while (cursor < source.length) {
    let factor = 1;
    if (cursor > 0) {
      tokens.push({ text: "·" });
      cursor++;
      const coefficient = source.slice(cursor).match(/^\d+/u)?.[0];
      if (coefficient) {
        factor = Number(coefficient);
        cursor += coefficient.length;
        tokens.push({ text: coefficient });
        if (factor < 1 || factor > 1000)
          throw new Error("水和物係数は1〜1000にしてください。");
      }
    }
    multiply(elements, group(), factor);
    if (cursor < source.length && !".·".includes(source[cursor]))
      throw new Error("化学式に未対応の記号があります。");
  }
  return { formula: source, charge, elements, tokens };
}
export function chemicalContent(
  input: string,
  context: Pick<ExtensionRenderContext, "text">
) {
  const parsed = parseChemicalFormula(input);
  const body = parsed.tokens
    .map((token) =>
      token.subscript
        ? `#sub[${context.text(token.text)}]`
        : context.text(token.text)
    )
    .join("");
  const charge = parsed.charge
    ? `#super[${context.text(
        (Math.abs(parsed.charge) === 1 ? "" : String(Math.abs(parsed.charge))) +
          (parsed.charge > 0 ? "+" : "−")
      )}]`
    : "";
  return `#box[${body}${charge}]`;
}
export function reactionBalance(config: Mapping) {
  const side = (key: string) => {
    const elements: Record<string, number> = {};
    let charge = 0;
    for (const term of config[key] as Mapping[]) {
      const formula = parseChemicalFormula(String(term.formula)),
        coefficient = Number(term.coefficient);
      for (const [element, count] of Object.entries(formula.elements))
        elements[element] = (elements[element] ?? 0) + count * coefficient;
      charge += formula.charge * coefficient;
    }
    return { elements, charge };
  };
  const left = side("reactants"),
    right = side("products");
  const mismatches = [
    ...new Set([...Object.keys(left.elements), ...Object.keys(right.elements)]),
  ].filter(
    (element) =>
      (left.elements[element] ?? 0) !== (right.elements[element] ?? 0)
  );
  return {
    balanced: !mismatches.length && left.charge === right.charge,
    left,
    right,
    mismatches,
  };
}
const formula: ExtensionDefinition = {
  type: "chemical-formula",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  inlineProperty: "formula",
  schema: object({
    formula: string({ required: true, maxLength: 240 }),
    caption: string({ default: "" }),
  }),
  validate(config, context) {
    try {
      parseChemicalFormula(String(config.formula));
    } catch (error) {
      context.issue(
        "formula",
        "INVALID_CHEMICAL_FORMULA",
        (error as Error).message
      );
    }
  },
  renderInline: (config, context) =>
    chemicalContent(String(config.formula), context),
  render: (config, context) =>
    `#block(above:6pt,below:6pt)[${chemicalContent(
      String(config.formula),
      context
    )}${
      config.caption ? ` #h(8pt) ${context.text(String(config.caption))}` : ""
    }]`,
  textSamples: (config) => (config.caption ? [String(config.caption)] : []),
  documentation: {
    summary: "化学式の元素記号・添字・電荷を立体のコピー可能な文字で組む。",
    restrictions: [
      "{{chemical-formula:H2O}}のインライン表現も同じ定義を利用する。",
      "Fe3+は単原子の3価、NH4+はNH4の1価。多価の複合イオンはSO4^2-のように^を明示する。",
      "同位体・任意マクロ・化学式からの構造推定は未対応。",
    ],
    errorExample: "formula: Xx2O",
  },
  examples: [
    { name: "minimal", source: "formula: H2O" },
    { name: "standard", source: "formula: SO4^2-\ncaption: 硫酸イオン" },
  ],
  tests: ["chemistry-extensions.test.ts", "pdf-regression:chemistry-pack"],
};
const species = object({
  formula: string({ required: true, maxLength: 240 }),
  coefficient: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
  state: string({ enum: ["", "s", "l", "g", "aq"], default: "" }),
});
const reaction: ExtensionDefinition = {
  type: "chemical-reaction",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    reactants: array(species, { required: true, minItems: 1, maxItems: 40 }),
    products: array(species, { required: true, minItems: 1, maxItems: 40 }),
    arrow: string({ enum: ["forward", "equilibrium"], default: "forward" }),
    above: string({ default: "" }),
    below: string({ default: "" }),
    caption: string({ default: "" }),
  }),
  validate(config, context) {
    let valid = true;
    for (const key of ["reactants", "products"])
      (config[key] as Mapping[]).forEach((term, index) => {
        try {
          parseChemicalFormula(String(term.formula));
        } catch (error) {
          valid = false;
          context.issue(
            `${key}[${index}].formula`,
            "INVALID_CHEMICAL_FORMULA",
            (error as Error).message
          );
        }
      });
    if (valid) {
      const balance = reactionBalance(config);
      if (!balance.balanced)
        context.issue(
          "reactants",
          "REACTION_NOT_BALANCED",
          `元素数または総電荷が一致しません。元素: ${
            balance.mismatches.join("、") || "一致"
          }、電荷: ${balance.left.charge} → ${
            balance.right.charge
          }。反応式を自動変更しません。`,
          "warning"
        );
    }
  },
  render(config, context) {
    const side = (key: string) =>
      (config[key] as Mapping[])
        .map(
          (term) =>
            `${
              Number(term.coefficient) === 1
                ? ""
                : context.text(String(term.coefficient))
            }${chemicalContent(String(term.formula), context)}${
              term.state ? context.text(`(${term.state})`) : ""
            }`
        )
        .join(` ${context.text("+")} `);
    // Flexible grid aligns conditions over/under the arrow, with natural text
    // widths. All species retain native text; this is never a raster equation.
    const arrow = config.arrow === "equilibrium" ? "⇄" : "→";
    return `#block(breakable:false,above:8pt,below:8pt)[#grid(columns:(auto,auto,auto),align:horizon,gutter:8pt,[${side(
      "reactants"
    )}],[#align(center)[${context.text(
      String(config.above)
    )}\n#linebreak()\n${context.text(arrow)}\n#linebreak()\n${context.text(
      String(config.below)
    )}]],[${side("products")}])${
      config.caption
        ? `\n#studio-par[${context.text(String(config.caption))}]`
        : ""
    }]`;
  },
  textSamples: (config) =>
    [String(config.above), String(config.below), String(config.caption)].filter(
      Boolean
    ),
  documentation: {
    summary:
      "係数・状態・反応矢印・上下条件を持つ反応式。元素数と電荷だけを照合する。",
    restrictions: [
      "釣り合っていても反応が実際に起こることを保証しない。",
      "式は自動補正しない。不一致はQA warning。",
      "非常に多い反応物は横幅が不足するため、原稿側で意味を保つ段階分割が必要。",
    ],
    errorExample: "reactants:\n  - formula: Xx\nproducts:\n  - formula: H2O",
  },
  examples: [
    {
      name: "minimal",
      source:
        "reactants:\n  - formula: H2\n    coefficient: 2\n  - formula: O2\nproducts:\n  - formula: H2O\n    coefficient: 2",
    },
    {
      name: "standard",
      source:
        "reactants:\n  - formula: N2\n    state: g\n  - formula: H2\n    coefficient: 3\n    state: g\nproducts:\n  - formula: NH3\n    coefficient: 2\n    state: g\narrow: equilibrium\nabove: Fe触媒\nbelow: 加熱・加圧\ncaption: アンモニア合成の表示例",
    },
  ],
  tests: ["chemistry-extensions.test.ts", "pdf-regression:chemistry-pack"],
};

const structure: ExtensionDefinition = {
  type: "chemical-structure",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object({
    width: number({ default: 640, minimum: 200, maximum: 1600 }),
    height: number({ default: 260, minimum: 120, maximum: 1000 }),
    caption: string({ default: "" }),
    representation: string({
      enum: ["structural", "skeletal"],
      default: "structural",
    }),
    atoms: array(
      object({
        id: id(),
        element: string({ required: true, maxLength: 3 }),
        position: { ...point(), required: true },
        hydrogens: { type: "integer", minimum: 0, maximum: 4, default: 0 },
        charge: { type: "integer", minimum: -8, maximum: 8, default: 0 },
        labelOffset: point(),
      }),
      { required: true, minItems: 1, maxItems: 150 }
    ),
    bonds: array(
      object({
        from: id(),
        to: id(),
        order: { type: "integer", minimum: 1, maximum: 3, default: 1 },
        style: string({ enum: ["solid", "wedge", "dashed"], default: "solid" }),
      }),
      { default: [], maxItems: 220 }
    ),
  }),
  validate(config, context) {
    const atoms = config.atoms as Mapping[],
      ids = new Set<string>();
    atoms.forEach((atom, i) => {
      if (ids.has(String(atom.id)))
        context.issue(
          `atoms[${i}].id`,
          "DUPLICATE_ID",
          `原子ID ${atom.id} が重複しています。`
        );
      ids.add(String(atom.id));
      if (!ELEMENTS.has(String(atom.element)))
        context.issue(
          `atoms[${i}].element`,
          "INVALID_ELEMENT",
          `元素記号 ${atom.element} は使用できません。`
        );
    });
    (config.bonds as Mapping[]).forEach((bond, i) => {
      if (
        !ids.has(String(bond.from)) ||
        !ids.has(String(bond.to)) ||
        bond.from === bond.to
      )
        context.issue(
          `bonds[${i}]`,
          "INVALID_REFERENCE",
          "結合の両端は異なる定義済み原子IDを指定してください。"
        );
    });
  },
  render(config) {
    const scene = new SvgScene(Number(config.width), Number(config.height)),
      atoms = new Map(
        (config.atoms as Mapping[]).map((atom) => [String(atom.id), atom])
      );
    const atomLabel = (atom: Mapping) => {
      const h = Number(atom.hydrogens),
        charge = Number(atom.charge);
      return (
        String(atom.element) +
        (h ? "H" + (h === 1 ? "" : "₀₁₂₃₄"[h]) : "") +
        (charge
          ? (Math.abs(charge) === 1 ? "" : String(Math.abs(charge))) +
            (charge > 0 ? "⁺" : charge < 0 ? "⁻" : "")
          : "")
      );
    };
    for (const bond of config.bonds as Mapping[]) {
      const from = atoms.get(String(bond.from))!,
        to = atoms.get(String(bond.to))!,
        a = from.position as Point2,
        b = to.position as Point2,
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy) || 1,
        ux = dx / length,
        uy = dy / length;
      const visible = (atom: Mapping) =>
        config.representation !== "skeletal" ||
        atom.element !== "C" ||
        Number(atom.charge) !== 0;
      const trim = (atom: Mapping) =>
        visible(atom)
          ? Math.min(
              length * 0.35,
              (Math.abs(ux) * textWidth(atomLabel(atom), 18)) / 2 +
                Math.abs(uy) * 12 +
                5
            )
          : 0;
      const trimA = trim(from),
        trimB = trim(to),
        start: [number, number] = [a[0] + ux * trimA, a[1] + uy * trimA],
        end: [number, number] = [b[0] - ux * trimB, b[1] - uy * trimB];
      if (bond.style === "wedge")
        scene.elements.push(
          `<polygon points="${start.join(",")} ${[
            end[0] - uy * 5,
            end[1] + ux * 5,
          ].join(",")} ${[end[0] + uy * 5, end[1] - ux * 5].join(
            ","
          )}" fill="#263542"/>`
        );
      else
        for (let i = 0; i < Number(bond.order); i++) {
          const offset = (i - (Number(bond.order) - 1) / 2) * 5;
          scene.line(
            [start[0] - uy * offset, start[1] + ux * offset],
            [end[0] - uy * offset, end[1] + ux * offset],
            bond.style === "dashed" ? 'stroke-dasharray="4 4"' : ""
          );
        }
    }
    for (const atom of atoms.values()) {
      if (
        config.representation === "skeletal" &&
        atom.element === "C" &&
        Number(atom.charge) === 0
      )
        continue;
      const [x, y] = atom.position as Point2,
        offset = (atom.labelOffset ?? [0, 0]) as Point2;
      scene.elements.push(
        `<text x="${x + offset[0]}" y="${
          y + offset[1] + 5
        }" text-anchor="middle" font-size="18">${xml(atomLabel(atom))}</text>`
      );
    }
    return scene.svg(String(config.caption || "明示的な化学構造式"));
  },
  documentation: {
    summary: "明示的な原子・結合グラフから構造式/骨格式のSVGを描く。",
    restrictions: [
      "SMILES解析・自動構造推定・自動水素付加・立体化学の真偽判定は未対応。",
      "骨格式のCラベル省略はrepresentation: skeletalで明示した場合のみ。",
      "分子式/示性式はchemical-formulaを利用する。外部ライブラリを追加しない。",
    ],
    errorExample:
      "atoms:\n  - id: C\n    element: C\n    position: [100, 100]\nbonds:\n  - from: C\n    to: missing",
  },
  examples: [
    {
      name: "minimal",
      source:
        "atoms:\n  - id: O\n    element: O\n    hydrogens: 2\n    position: [280, 100]",
    },
    {
      name: "standard",
      source:
        "caption: エタノールの明示構造\natoms:\n  - id: C1\n    element: C\n    hydrogens: 3\n    position: [140, 130]\n  - id: C2\n    element: C\n    hydrogens: 2\n    position: [290, 130]\n  - id: O\n    element: O\n    hydrogens: 1\n    position: [440, 130]\nbonds:\n  - from: C1\n    to: C2\n  - from: C2\n    to: O",
    },
  ],
  tests: ["chemistry-extensions.test.ts", "pdf-regression:chemistry-pack"],
};
for (const definition of [formula, reaction, structure])
  extensionRegistry.register(definition);
