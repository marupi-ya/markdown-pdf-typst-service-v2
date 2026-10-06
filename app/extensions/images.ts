import {
  extensionRegistry,
  object,
  string,
  number,
  array,
  point,
  id,
  boolean,
  type ExtensionDefinition,
  type ExtensionRenderContext,
} from "./registry";
import type { Mapping } from "../math-c/syntax";
import { SvgScene, xml, inspectSvgViewport, type Point2 } from "./layout";
import { referenceKey, referenceLabel, anchorMarkup } from "./document";
import { assetIdIsSafe } from "../material-assets";

const base = {
  id: id(),
  assetId: id(),
  caption: string({ default: "" }),
  alt: string({ default: "" }),
  width: number({
    minimum: 20,
    maximum: 100,
    default: 94,
    description: "本文幅に対する%",
  }),
  maxWidth: number({ minimum: 20, maximum: 100, default: 100 }),
  maxHeight: number({
    minimum: 20,
    maximum: 240,
    default: 160,
    description: "mm。containの上限、切り取らない",
  }),
  fit: string({ enum: ["contain"], default: "contain" }),
  publicUse: boolean(false),
};
const annotations = array(
  object({
    id: id(),
    kind: string({
      required: true,
      enum: [
        "label",
        "arrow",
        "line",
        "circle",
        "rectangle",
        "marker",
        "numbered-marker",
      ],
    }),
    position: { ...point(true), required: true },
    end: point(true),
    radius: number({ minimum: 0.005, maximum: 0.5, default: 0.035 }),
    label: string({ default: "", maxLength: 60 }),
    number: { type: "integer", minimum: 1, maximum: 999, default: 1 },
    labelOffset: point(),
  }),
  { default: [], maxItems: 200 }
);
const levels = object({
  complete: string({
    enum: ["none", "numbered", "detailed"],
    default: "detailed",
  }),
  questions: string({
    enum: ["none", "numbered", "detailed"],
    default: "numbered",
  }),
  answers: string({
    enum: ["none", "numbered", "detailed"],
    default: "detailed",
  }),
});
function commonValidation(
  config: Mapping,
  context: Parameters<NonNullable<ExtensionDefinition["validate"]>>[1]
) {
  if (!assetIdIsSafe(String(config.assetId)))
    context.issue(
      "assetId",
      "INVALID_ASSET_ID",
      "assetIdは80文字以内の英小文字・数字・_・-にしてください。"
    );
}
const path = (config: Mapping, context: ExtensionRenderContext) =>
  context.assetPaths?.[String(config.assetId)];
const alt = (config: Mapping, context: ExtensionRenderContext) =>
  String(
    config.alt ||
      context.assets?.[String(config.assetId)]?.alt ||
      config.caption ||
      config.id
  );
function picture(config: Mapping, context: ExtensionRenderContext) {
  const asset = context.assets![String(config.assetId)],
    ratio = asset.height / asset.width;
  return `#context layout(size => { let w=calc.min(size.width, ${Number(
    config.maxHeight
  )}mm / ${ratio}); image(${JSON.stringify(
    path(config, context)
  )},width:w,alt:${JSON.stringify(alt(config, context))}) })`;
}
const tests = ["image-assets.test.ts", "pdf-regression:image-materials"];
const resourceValidation: NonNullable<
  ExtensionDefinition["validateResources"]
> = (config, context, assets) => {
  const asset = assets[String(config.assetId)];
  if (!asset.alt && !config.alt)
    context.issue(
      "alt",
      "ASSET_ALT_MISSING",
      "画像のalt textを登録してください。",
      "warning"
    );
  if (config.publicUse) {
    const missing = ["source", "license", "attribution"].filter(
      (key) => !asset[key as "source" | "license" | "attribution"]
    );
    if (missing.length)
      context.issue(
        "publicUse",
        "ASSET_RIGHTS_MISSING",
        `公開用資料の権利情報を確認してください: ${missing.join(
          ", "
        )}。Studioは権利状態を判定しません。`,
        "warning"
      );
  }
};
const image: ExtensionDefinition = {
  type: "image-asset",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object(base),
  validate: commonValidation,
  assetIds: (config) => [String(config.assetId)],
  validateResources: resourceValidation,
  render: () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"/>',
  renderPdf: picture,
  anchors: (config) => [
    {
      key: referenceKey("figure", String(config.id)),
      label: String(config.caption || config.id),
    },
  ],
  documentation: {
    summary:
      "検証済みPNG・JPEG・SVGのassetIdを既存Figure経路でnative Typst imageへ配置する。",
    restrictions: [
      "URL・filesystem path・Markdown内base64は指定しない。",
      "fitはcontainのみ。幅は本文%、maxHeightはmm。自動cropをしない。",
      "古いfigure image/srcの未対応経路は変更しない。新規正規記法はimage-asset。",
    ],
    errorExample: "id: bad\nassetId: ../secret\nfit: cover",
  },
  examples: [
    { name: "minimal", source: "id: cell-photo\nassetId: cell" },
    {
      name: "standard",
      source:
        "id: cell-photo\nassetId: cell\ncaption: 細胞資料\nalt: 教材用の細胞模式図\nwidth: 80\nmaxHeight: 130\npublicUse: true",
    },
  ],
  tests,
};
function annotationLayer(config: Mapping, context: ExtensionRenderContext) {
  const asset = context.assets?.[String(config.assetId)],
    ratio = asset ? asset.height / asset.width : 0.6;
  if (ratio > 8 || ratio < 0.125)
    throw Object.assign(
      new Error(
        "画像注釈の縦横比は1:8〜8:1で指定してください。元画像のみはimage-assetで利用できます。"
      ),
      { code: "ANNOTATION_ASPECT_RATIO" }
    );
  const padding = 48,
    baseWidth = 1000,
    baseHeight = 1000 * ratio,
    scene = new SvgScene(baseWidth + 2 * padding, baseHeight + 2 * padding);
  const p = (value: unknown): Point2 => {
    const point = value as Point2;
    return [padding + point[0] * baseWidth, padding + point[1] * baseHeight];
  };
  const display = String((config.levels as Mapping)[context.outputMode]);
  if (display !== "none")
    for (const annotation of config.annotations as Mapping[]) {
      const position = p(annotation.position),
        end = annotation.end ? p(annotation.end) : position;
      const marker =
        annotation.kind === "marker" || annotation.kind === "numbered-marker";
      if (display === "numbered" && !marker) continue;
      if (annotation.kind === "arrow" || annotation.kind === "line")
        scene.line(
          position,
          end,
          'stroke="#b53234" stroke-width="3"',
          annotation.kind === "arrow"
        );
      if (annotation.kind === "rectangle")
        scene.elements.push(
          `<rect x="${Math.min(position[0], end[0])}" y="${Math.min(
            position[1],
            end[1]
          )}" width="${Math.abs(end[0] - position[0])}" height="${Math.abs(
            end[1] - position[1]
          )}" fill="none" stroke="#b53234" stroke-width="2"/>`
        );
      if (annotation.kind === "circle")
        scene.elements.push(
          `<circle cx="${position[0]}" cy="${position[1]}" r="${
            Number(annotation.radius) * Math.min(baseWidth, baseHeight)
          }" fill="none" stroke="#b53234" stroke-width="2"/>`
        );
      if (marker) {
        scene.occupied.push({
          x: position[0] - 26,
          y: position[1] - 26,
          w: 52,
          h: 52,
        });
        scene.elements.push(
          `<circle cx="${position[0]}" cy="${
            position[1]
          }" r="24" fill="white" stroke="#b53234" stroke-width="3"/><text x="${
            position[0]
          }" y="${position[1] + 9}" text-anchor="middle" font-size="28">${xml(
            annotation.kind === "numbered-marker"
              ? annotation.number
              : annotation.label || "•"
          )}</text>`
        );
      }
      if (
        display === "detailed" &&
        annotation.label &&
        annotation.kind !== "marker"
      )
        scene.label(
          String(annotation.label),
          position,
          annotation.labelOffset as Point2 | undefined,
          28
        );
    }
  const inspected = inspectSvgViewport(scene.svg(alt(config, context)));
  return { ...inspected, padding, baseWidth, baseHeight };
}
const annotated: ExtensionDefinition = {
  type: "image-annotation",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object({ ...base, annotations, levels: { ...levels, default: {} } }),
  assetIds: (config) => [String(config.assetId)],
  validateResources(config, context, assets) {
    resourceValidation(config, context, assets);
    const asset = assets[String(config.assetId)],
      ratio = asset.height / asset.width;
    if (ratio < 0.125 || ratio > 8)
      context.issue(
        "assetId",
        "ANNOTATION_ASPECT_RATIO",
        "注釈付き画像の縦横比は1:8〜8:1にしてください。image-assetでは元画像のみを配置できます。"
      );
    else if (
      (Number(config.maxHeight) * 28 * (72 / 25.4)) / (1000 * ratio + 96) < 8 ||
      Number(config.width) < 50
    )
      context.issue(
        "maxHeight",
        "ANNOTATION_TEXT_SIZE",
        "指定された表示サイズでは注釈が8pt未満になる可能性があります。表示幅・高さを増やすか、元画像と説明を別に配置してください。",
        "warning"
      );
  },
  validate(config, context) {
    commonValidation(config, context);
    const ids = new Set<string>();
    (config.annotations as Mapping[]).forEach((item, i) => {
      if (ids.has(String(item.id)))
        context.issue(
          `annotations[${i}].id`,
          "DUPLICATE_ID",
          "annotationIdは図内で一意にしてください。"
        );
      ids.add(String(item.id));
      if (
        ["arrow", "line", "rectangle"].includes(String(item.kind)) &&
        !item.end
      )
        context.issue(
          `annotations[${i}].end`,
          "REQUIRED_PROPERTY_MISSING",
          "線・矢印・長方形にはendが必要です。"
        );
      if (item.kind === "label" && !item.label)
        context.issue(
          `annotations[${i}].label`,
          "REQUIRED_PROPERTY_MISSING",
          "label注釈には文字が必要です。"
        );
    });
  },
  render: (config, context) => annotationLayer(config, context).svg,
  renderPdf(config, context) {
    const layer = annotationLayer(config, context),
      [x, y, cw, ch] = layer.viewBox;
    const anchors = [
      referenceKey("figure", String(config.id)),
      ...(config.annotations as Mapping[]).map((item) =>
        referenceKey("figure", String(config.id), String(item.id))
      ),
    ]
      .filter((key) => context.references?.[key])
      .map((key) => anchorMarkup(key, context.sourceLine))
      .join("");
    return `${anchors}#context layout(size => { let w=calc.min(size.width, ${Number(
      config.maxHeight
    )}mm * ${cw / ch}); let h=w*${
      ch / cw
    }; block(width:w,height:h)[#place(top+left,dx:w*${
      (layer.padding - x) / cw
    },dy:w*${(layer.padding - y) / cw})[#image(${JSON.stringify(
      path(config, context)
    )},width:w*${layer.baseWidth / cw},height:w*${
      layer.baseHeight / cw
    },fit:"contain",alt:${JSON.stringify(
      alt(config, context)
    )})]\n#place(top+left)[#image(${JSON.stringify(
      context.assetPath
    )},width:w,height:h)]] })`;
  },
  anchors: (config) => [
    {
      key: referenceKey("figure", String(config.id)),
      label: String(config.caption || config.id),
    },
    ...(config.annotations as Mapping[]).map((item) => ({
      key: referenceKey("figure", String(config.id), String(item.id)),
      label: String(item.label || item.number || item.id),
    })),
  ],
  documentation: {
    summary:
      "元assetと正規化された教育用Annotation Layerをnative画像+SVGとして重ねる。",
    restrictions: [
      "position/endは画像左上を(0,0)、右下を(1,1)とする。radiusは短辺割合。labelOffsetはSVG内部px。",
      "表示レベルはnone/numbered/detailed。元画像を直接変更しない。",
      "図・注釈の参照はID。表示文字や丸数字を参照キーにしない。",
      "注釈付き画像は縦横比1:8〜8:1。極端な縦長/横長資料はimage-assetで配置する。",
    ],
    errorExample:
      "id: bad\nassetId: cell\nannotations:\n  - id: A\n    kind: arrow\n    position: [1.2, 0.5]",
  },
  examples: [
    {
      name: "minimal",
      source:
        "id: cell-view\nassetId: cell\nannotations:\n  - id: nucleus\n    kind: numbered-marker\n    position: [0.5, 0.5]\n    number: 1",
    },
    {
      name: "standard",
      source:
        "id: cell-view\nassetId: cell\ncaption: 元画像と注釈レイヤー\nannotations:\n  - id: nucleus\n    kind: numbered-marker\n    position: [0.52, 0.46]\n    number: 1\n    label: 核\n  - id: arrow-to-nucleus\n    kind: arrow\n    position: [0.2, 0.2]\n    end: [0.5, 0.45]\n    label: 注目する位置",
    },
  ],
  tests,
};
const ref: ExtensionDefinition = {
  type: "figure-reference",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    label: string({ required: true }),
    figureId: id(),
    annotationId: id(false),
  }),
  references: (config) => [
    {
      key: referenceKey(
        "figure",
        String(config.figureId),
        ...(config.annotationId ? [String(config.annotationId)] : [])
      ),
      path: "annotationId",
    },
  ],
  render(config, context) {
    const key = referenceKey(
        "figure",
        String(config.figureId),
        ...(config.annotationId ? [String(config.annotationId)] : [])
      ),
      anchor = context.references?.[key];
    return `#par[${
      anchor
        ? `#link(label(${JSON.stringify(referenceLabel(key))}))[${context.text(
            String(config.label)
          )}]`
        : context.text(`${config.label} [参照先未確認: ${key}]`)
    }]`;
  },
  textSamples: (config) => [String(config.label)],
  documentation: {
    summary: "本文・設問から図と注釈を一意に参照する。",
    restrictions: [
      "PDFリンクは対象図の位置を指す。表示は著者指定labelのみ。対象注釈の名称を自動追記しない（問題版への解答漏えい防止）。",
      "未解決参照はQA warning。表示文字が同じでもfigureId/annotationIdで区別する。",
    ],
    errorExample: "label: ①を参照",
  },
  examples: [
    { name: "minimal", source: "label: 図を参照\nfigureId: cell-view" },
    {
      name: "standard",
      source:
        "label: ①の名称を答えなさい\nfigureId: cell-view\nannotationId: nucleus",
    },
  ],
  tests,
};
// Image-asset also needs its native figure reference anchor.
image.renderPdf = (config, context) =>
  `${
    context.references?.[referenceKey("figure", String(config.id))]
      ? anchorMarkup(
          referenceKey("figure", String(config.id)),
          context.sourceLine
        )
      : ""
  }${picture(config, context)}`;
for (const definition of [image, annotated, ref])
  extensionRegistry.register(definition);
