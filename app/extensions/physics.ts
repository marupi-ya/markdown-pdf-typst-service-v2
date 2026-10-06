import type { Mapping, Value } from "../math-c/syntax";
import {
  extensionRegistry,
  object,
  string,
  number,
  array,
  point,
  id,
  type ExtensionDefinition,
  type ValidationContext,
} from "./registry";
import { SvgScene, xml, type Point2 } from "./layout";

const canvas = {
  width: number({ minimum: 200, maximum: 1600, default: 640 }),
  height: number({ minimum: 120, maximum: 1200, default: 360 }),
  caption: string({ default: "" }),
};
const labelFields = {
  label: string({ maxLength: 90, default: "" }),
  labelOffset: point(),
};
const coord = { ...point(), required: true };
const map = (value: Value) => value as Mapping;
const list = (config: Mapping, key: string) =>
  ((config[key] as Value[]) ?? []).map(map);
const p = (value: Value) => value as Point2;
const num = (value: Value) => Number(value);
function unique(items: Mapping[], context: ValidationContext, path: string) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const key = String(item.id);
    if (ids.has(key))
      context.issue(
        `${path}[${index}].id`,
        "DUPLICATE_ID",
        `ID ${key} が重複しています。`
      );
    ids.add(key);
  });
  return ids;
}
function inside(
  config: Mapping,
  context: ValidationContext,
  value: Value,
  path: string
) {
  const [x, y] = p(value);
  if (x < 0 || y < 0 || x > num(config.width) || y > num(config.height))
    context.issue(
      path,
      "INVALID_COORDINATE",
      `${path}: 図のwidth/height内の座標を指定してください。`
    );
}
function angle(
  scene: SvgScene,
  vertex: Point2,
  from: Point2,
  to: Point2,
  radius: number,
  label: string,
  offset?: Point2
) {
  let a = Math.atan2(from[1] - vertex[1], from[0] - vertex[0]);
  let b = Math.atan2(to[1] - vertex[1], to[0] - vertex[0]);
  let delta = b - a;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const start: [number, number] = [
    vertex[0] + radius * Math.cos(a),
    vertex[1] + radius * Math.sin(a),
  ];
  const end: [number, number] = [
    vertex[0] + radius * Math.cos(a + delta),
    vertex[1] + radius * Math.sin(a + delta),
  ];
  scene.elements.push(
    `<path d="M${start.join(" ")} A${radius} ${radius} 0 0 ${
      delta > 0 ? 1 : 0
    } ${end.join(" ")}" fill="none" stroke="#1769aa"/>`
  );
  scene.label(
    label,
    [
      vertex[0] + (radius + 10) * Math.cos(a + delta / 2),
      vertex[1] + (radius + 10) * Math.sin(a + delta / 2),
    ],
    offset
  );
}
const mechanics: ExtensionDefinition = {
  type: "mechanics-diagram",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object({
    ...canvas,
    bodies: array(
      object({
        id: id(),
        kind: string({ enum: ["block", "circle"], default: "block" }),
        position: coord,
        size: { ...point(), default: [64, 42] },
        radius: number({ minimum: 1, maximum: 200, default: 24 }),
        angle: number({ minimum: -180, maximum: 180, default: 0 }),
        ...labelFields,
      }),
      { default: [], maxItems: 80 }
    ),
    surfaces: array(
      object({
        kind: string({ enum: ["floor", "incline"], required: true }),
        from: coord,
        to: coord,
      }),
      { default: [], maxItems: 80 }
    ),
    strings: array(object({ from: coord, to: coord, ...labelFields }), {
      default: [],
      maxItems: 80,
    }),
    pulleys: array(
      object({
        id: id(),
        center: coord,
        radius: number({ minimum: 2, maximum: 120, default: 20 }),
        ...labelFields,
      }),
      { default: [], maxItems: 40 }
    ),
    springs: array(
      object({
        from: coord,
        to: coord,
        turns: { type: "integer", minimum: 2, maximum: 30, default: 8 },
        ...labelFields,
      }),
      { default: [], maxItems: 40 }
    ),
    vectors: array(
      object({
        id: id(),
        body: id(false),
        origin: coord,
        target: point(),
        direction: point(),
        kind: string({
          required: true,
          enum: [
            "gravity",
            "normal",
            "tension",
            "friction",
            "elastic",
            "external",
            "velocity",
            "acceleration",
          ],
        }),
        ...labelFields,
      }),
      { default: [], maxItems: 160 }
    ),
    distances: array(object({ from: coord, to: coord, ...labelFields }), {
      default: [],
      maxItems: 40,
    }),
    angles: array(
      object({
        vertex: coord,
        from: coord,
        to: coord,
        radius: number({ minimum: 5, maximum: 100, default: 24 }),
        ...labelFields,
      }),
      { default: [], maxItems: 40 }
    ),
  }),
  validate(config, context) {
    if (
      !["bodies", "surfaces", "strings", "pulleys", "springs", "vectors"].some(
        (key) => list(config, key).length
      )
    )
      context.issue(
        "bodies",
        "REQUIRED_PROPERTY_MISSING",
        "力学図には少なくとも1つの要素が必要です。"
      );
    const bodies = unique(list(config, "bodies"), context, "bodies");
    unique(list(config, "vectors"), context, "vectors");
    unique(list(config, "pulleys"), context, "pulleys");
    list(config, "bodies").forEach((body, i) => {
      inside(config, context, body.position, `bodies[${i}].position`);
      if (p(body.size).some((value) => value <= 0))
        context.issue(
          `bodies[${i}].size`,
          "INVALID_NUMERIC_RANGE",
          "物体の幅・高さは正の値にしてください。"
        );
    });
    list(config, "vectors").forEach((vector, i) => {
      const path = `vectors[${i}]`;
      if (!!vector.target === !!vector.direction)
        context.issue(
          path,
          "REQUIRED_PROPERTY_MISSING",
          "target または direction の一方だけを指定してください。"
        );
      if (vector.body && !bodies.has(String(vector.body)))
        context.issue(
          path + ".body",
          "INVALID_REFERENCE",
          `物体 ${vector.body} が未定義です。`
        );
      const target = vector.target
        ? p(vector.target)
        : vector.direction
        ? ([
            p(vector.origin)[0] + p(vector.direction)[0],
            p(vector.origin)[1] + p(vector.direction)[1],
          ] as Point2)
        : p(vector.origin);
      if (
        target[0] === p(vector.origin)[0] &&
        target[1] === p(vector.origin)[1]
      )
        context.issue(
          path,
          "INVALID_DIRECTION",
          "ベクトルの向きと長さを指定してください。"
        );
      inside(config, context, vector.origin, path + ".origin");
      inside(config, context, target, path + ".target");
    });
  },
  render(config) {
    const scene = new SvgScene(num(config.width), num(config.height));
    for (const surface of list(config, "surfaces")) {
      scene.line(p(surface.from), p(surface.to), 'stroke-width="3"');
      const [a, b] = [p(surface.from), p(surface.to)];
      for (let t = 0; t <= 1; t += 0.08) {
        const x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t;
        scene.line([x, y], [x - 8, y + 10], 'stroke-width="1"');
      }
    }
    for (const body of list(config, "bodies")) {
      const [x, y] = p(body.position),
        [w, h] = p(body.size);
      const theta = (num(body.angle) * Math.PI) / 180;
      if (body.kind === "circle")
        scene.elements.push(
          `<circle cx="${x}" cy="${y}" r="${body.radius}" fill="#edf5fb" stroke="#263542" stroke-width="2"/>`
        );
      else {
        const corners = [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ].map(([dx, dy]) => [
          x + dx * Math.cos(theta) - dy * Math.sin(theta),
          y + dx * Math.sin(theta) + dy * Math.cos(theta),
        ]);
        scene.elements.push(
          `<polygon points="${corners
            .map((q) => q.join(","))
            .join(" ")}" fill="#edf5fb" stroke="#263542" stroke-width="2"/>`
        );
      }
      scene.occupied.push({ x: x - w / 2, y: y - h / 2, w, h });
    }
    for (const line of list(config, "strings"))
      scene.line(p(line.from), p(line.to));
    for (const pulley of list(config, "pulleys")) {
      const [x, y] = p(pulley.center);
      scene.elements.push(
        `<circle cx="${x}" cy="${y}" r="${pulley.radius}" fill="white" stroke="#263542" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="#263542"/>`
      );
    }
    for (const spring of list(config, "springs")) {
      const [from, to] = [p(spring.from), p(spring.to)];
      const [dx, dy] = [to[0] - from[0], to[1] - from[1]],
        length = Math.hypot(dx, dy) || 1;
      const points = [
        from,
        ...Array.from({ length: num(spring.turns) * 2 }, (_, i) => {
          const t = (i + 1) / (num(spring.turns) * 2 + 1),
            zig = i % 2 === 0 ? 7 : -7;
          return [
            from[0] + dx * t - (dy / length) * zig,
            from[1] + dy * t + (dx / length) * zig,
          ];
        }),
        to,
      ];
      scene.elements.push(
        `<polyline points="${points
          .map((q) => q.join(","))
          .join(" ")}" fill="none" stroke="#263542" stroke-width="2"/>`
      );
    }
    for (const vector of list(config, "vectors")) {
      const origin = p(vector.origin),
        target = vector.target
          ? p(vector.target)
          : ([
              origin[0] + p(vector.direction)[0],
              origin[1] + p(vector.direction)[1],
            ] as Point2);
      scene.line(
        origin,
        target,
        `stroke="${
          vector.kind === "velocity" || vector.kind === "acceleration"
            ? "#1769aa"
            : "#9b352c"
        }"`,
        true
      );
    }
    for (const distance of list(config, "distances"))
      scene.line(p(distance.from), p(distance.to), 'stroke-dasharray="5 4"');
    for (const entry of list(config, "angles"))
      angle(
        scene,
        p(entry.vertex),
        p(entry.from),
        p(entry.to),
        num(entry.radius),
        String(entry.label),
        entry.labelOffset ? p(entry.labelOffset) : undefined
      );
    for (const body of list(config, "bodies"))
      if (body.label)
        scene.label(
          String(body.label),
          p(body.position),
          body.labelOffset ? p(body.labelOffset) : undefined
        );
    for (const key of ["vectors", "strings", "springs", "distances"])
      for (const entry of list(config, key))
        if (entry.label) {
          const a = p(entry.origin ?? entry.from),
            b = entry.target
              ? p(entry.target)
              : entry.to
              ? p(entry.to)
              : ([
                  a[0] + p(entry.direction)[0],
                  a[1] + p(entry.direction)[1],
                ] as Point2);
          scene.label(
            String(entry.label),
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            entry.labelOffset ? p(entry.labelOffset) : undefined
          );
        }
    for (const entry of list(config, "pulleys"))
      if (entry.label)
        scene.label(
          String(entry.label),
          p(entry.center),
          entry.labelOffset ? p(entry.labelOffset) : undefined
        );
    return scene.svg(String(config.caption || "力学図"));
  },
  documentation: {
    summary:
      "物体・床・斜面・糸・滑車・ばね・指定された力/速度/加速度・距離・角度。",
    restrictions: [
      "SVG座標は左上原点、x右向き/y下向き。力学法則・不足する力を推論しない。",
      "direction は描画変位、target は終点座標。一方だけ指定。",
      "labelOffsetで手動配置可能。",
    ],
    errorExample:
      "vectors:\n  - id: F\n    origin: [100, 100]\n    kind: gravity\n    direction: [0, 0]",
  },
  examples: [
    {
      name: "minimal",
      source: "bodies:\n  - id: B\n    position: [280, 200]\n    label: m",
    },
    {
      name: "standard",
      source:
        "caption: 水平面上の物体に指定した力\nsurfaces:\n  - kind: floor\n    from: [60, 250]\n    to: [580, 250]\nbodies:\n  - id: B\n    position: [280, 228]\n    label: m\nvectors:\n  - id: W\n    body: B\n    origin: [280, 228]\n    direction: [0, 100]\n    kind: gravity\n    label: mg\n  - id: N\n    body: B\n    origin: [280, 228]\n    direction: [0, -120]\n    kind: normal\n    label: N",
    },
  ],
  tests: ["physics-extensions.test.ts", "pdf-regression:physics-pack"],
};

const circuit: ExtensionDefinition = {
  type: "circuit-diagram",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object({
    ...canvas,
    nodes: array(object({ id: id(), position: coord, ...labelFields }), {
      required: true,
      minItems: 2,
      maxItems: 120,
    }),
    wires: array(
      object({
        from: id(),
        to: id(),
        via: array(point(), { default: [], maxItems: 20 }),
      }),
      { default: [], maxItems: 200 }
    ),
    components: array(
      object({
        id: id(),
        kind: string({
          required: true,
          enum: [
            "battery",
            "resistor",
            "switch",
            "capacitor",
            "ammeter",
            "voltmeter",
            "lamp",
          ],
        }),
        from: id(),
        to: id(),
        state: string({ enum: ["open", "closed"], default: "open" }),
        ...labelFields,
      }),
      { default: [], maxItems: 120 }
    ),
  }),
  validate(config, context) {
    const ids = unique(list(config, "nodes"), context, "nodes");
    unique(list(config, "components"), context, "components");
    for (const key of ["wires", "components"])
      list(config, key).forEach((entry, i) => {
        for (const ref of ["from", "to"])
          if (!ids.has(String(entry[ref])))
            context.issue(
              `${key}[${i}].${ref}`,
              "INVALID_REFERENCE",
              `接続点 ${entry[ref]} が未定義です。`
            );
        if (entry.from === entry.to)
          context.issue(
            `${key}[${i}]`,
            "INVALID_REFERENCE",
            "同じ接続点へ部品の両端を接続できません。"
          );
      });
    list(config, "nodes").forEach((node, i) =>
      inside(config, context, node.position, `nodes[${i}].position`)
    );
  },
  render(config) {
    const scene = new SvgScene(num(config.width), num(config.height)),
      nodes = new Map(
        list(config, "nodes").map((node) => [String(node.id), p(node.position)])
      );
    for (const wire of list(config, "wires")) {
      const pts = [
        nodes.get(String(wire.from))!,
        ...(wire.via as Value[]).map(p),
        nodes.get(String(wire.to))!,
      ];
      for (let i = 1; i < pts.length; i++) scene.line(pts[i - 1], pts[i]);
    }
    for (const component of list(config, "components")) {
      const a = nodes.get(String(component.from))!,
        b = nodes.get(String(component.to))!,
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy) || 1,
        u: [number, number] = [dx / length, dy / length],
        v: [number, number] = [-u[1], u[0]],
        center: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const q = (x: number, y = 0): Point2 => [
        center[0] + u[0] * x + v[0] * y,
        center[1] + u[1] * x + v[1] * y,
      ];
      scene.line(a, q(-26));
      scene.line(q(26), b);
      if (component.kind === "resistor") {
        const points = [
          q(-26),
          ...Array.from({ length: 9 }, (_, i) =>
            q(-22 + i * 5.5, i % 2 === 0 ? -9 : 9)
          ),
          q(26),
        ];
        scene.elements.push(
          `<polyline points="${points
            .map((x) => x.join(","))
            .join(" ")}" fill="none" stroke="#263542" stroke-width="2"/>`
        );
      } else if (
        component.kind === "battery" ||
        component.kind === "capacitor"
      ) {
        const n = component.kind === "battery" ? 16 : 13;
        scene.line(q(-6, -n), q(-6, n));
        scene.line(q(6, -10), q(6, 10));
        scene.line(q(-26), q(-6));
        scene.line(q(6), q(26));
      } else if (component.kind === "switch") {
        scene.line(q(-26), q(-14));
        scene.line(q(14), q(26));
        scene.line(q(-14), q(14, component.state === "closed" ? 0 : -15));
      } else {
        scene.elements.push(
          `<circle cx="${center[0]}" cy="${center[1]}" r="20" fill="white" stroke="#263542" stroke-width="2"/>`
        );
        scene.line(q(-26), q(-20));
        scene.line(q(20), q(26));
        if (component.kind === "lamp") {
          scene.line(q(-12, -12), q(12, 12));
          scene.line(q(-12, 12), q(12, -12));
        } else
          scene.elements.push(
            `<text x="${center[0]}" y="${
              center[1] + 5
            }" text-anchor="middle" font-size="16">${
              component.kind === "ammeter" ? "A" : "V"
            }</text>`
          );
      }
      if (component.label)
        scene.label(
          String(component.label),
          center,
          component.labelOffset ? p(component.labelOffset) : [10, -26]
        );
    }
    for (const node of list(config, "nodes")) {
      const [x, y] = p(node.position);
      scene.elements.push(`<circle cx="${x}" cy="${y}" r="3" fill="#263542"/>`);
      if (node.label)
        scene.label(
          String(node.label),
          [x, y],
          node.labelOffset ? p(node.labelOffset) : undefined
        );
    }
    return scene.svg(String(config.caption || "回路図"));
  },
  documentation: {
    summary: "接続IDと描画座標を分離した回路図。",
    restrictions: [
      "nodes.idを端子として部品・wireの接続を明示する。交差したwireを勝手に接続しない。",
      "部品は両端の中点に描画する。接続点間は60px以上を推奨。",
      "電圧・電流・回路動作は推論しない。",
    ],
    errorExample:
      "nodes: []\ncomponents:\n  - id: R\n    kind: resistor\n    from: missing\n    to: B",
  },
  examples: [
    {
      name: "minimal",
      source:
        "nodes:\n  - id: A\n    position: [100, 120]\n  - id: B\n    position: [400, 120]\ncomponents:\n  - id: R\n    kind: resistor\n    from: A\n    to: B\n    label: R",
    },
    {
      name: "standard",
      source:
        "caption: 抵抗と電源の回路\nnodes:\n  - id: A\n    position: [100, 100]\n  - id: B\n    position: [500, 100]\n  - id: C\n    position: [500, 260]\n  - id: D\n    position: [100, 260]\ncomponents:\n  - id: R\n    kind: resistor\n    from: A\n    to: B\n    label: R\n  - id: E\n    kind: battery\n    from: D\n    to: C\n    label: E\nwires:\n  - from: A\n    to: D\n  - from: B\n    to: C",
    },
  ],
  tests: ["physics-extensions.test.ts", "pdf-regression:physics-pack"],
};

const optics: ExtensionDefinition = {
  type: "optics-diagram",
  kind: "figure",
  version: 1,
  fallback: "source-visible",
  schema: object({
    ...canvas,
    axisY: number({ default: 180 }),
    elements: array(
      object({
        id: id(),
        kind: string({
          required: true,
          enum: ["lens", "convex-lens", "concave-lens", "mirror"],
        }),
        x: number({ required: true }),
        height: number({ minimum: 10, maximum: 500, default: 180 }),
        ...labelFields,
      }),
      { default: [], maxItems: 30 }
    ),
    focalPoints: array(object({ id: id(), position: coord, ...labelFields }), {
      default: [],
      maxItems: 60,
    }),
    objects: array(
      object({ id: id(), origin: coord, target: coord, ...labelFields }),
      { default: [], maxItems: 30 }
    ),
    images: array(
      object({
        id: id(),
        origin: coord,
        target: coord,
        virtual: { type: "boolean", default: false },
        ...labelFields,
      }),
      { default: [], maxItems: 30 }
    ),
    rays: array(
      object({
        id: id(),
        points: array(point(), { required: true, minItems: 2, maxItems: 30 }),
        kind: string({
          enum: ["parallel", "through-focus", "through-center", "specified"],
          default: "specified",
        }),
        dashed: { type: "boolean", default: false },
        ...labelFields,
      }),
      { default: [], maxItems: 120 }
    ),
  }),
  validate(config, context) {
    for (const key of ["elements", "focalPoints", "objects", "images", "rays"])
      unique(list(config, key), context, key);
    list(config, "rays").forEach((ray, i) =>
      (ray.points as Value[]).forEach((q, j) =>
        inside(config, context, q, `rays[${i}].points[${j}]`)
      )
    );
  },
  render(config) {
    const scene = new SvgScene(num(config.width), num(config.height)),
      axis = num(config.axisY);
    scene.line(
      [20, axis],
      [num(config.width) - 20, axis],
      'stroke-dasharray="7 5" stroke="#657786"'
    );
    for (const element of list(config, "elements")) {
      const x = num(element.x),
        h = num(element.height) / 2;
      scene.line(
        [x, axis - h],
        [x, axis + h],
        'stroke="#1769aa" stroke-width="3"'
      );
      if (element.kind === "convex-lens" || element.kind === "concave-lens") {
        const sign = element.kind === "convex-lens" ? -1 : 1;
        for (const end of [-1, 1]) {
          const y = axis + h * end;
          scene.line([x - 8, y + sign * end * 10], [x, y]);
          scene.line([x + 8, y + sign * end * 10], [x, y]);
        }
      }
      if (element.kind === "mirror")
        for (let y = axis - h; y <= axis + h; y += 14)
          scene.line([x, y], [x + 9, y - 7]);
      if (element.label)
        scene.label(
          String(element.label),
          [x, axis - h],
          element.labelOffset ? p(element.labelOffset) : [12, -5]
        );
    }
    for (const ray of list(config, "rays")) {
      const pts = (ray.points as Value[]).map(p);
      for (let i = 1; i < pts.length; i++)
        scene.line(
          pts[i - 1],
          pts[i],
          ray.dashed ? 'stroke-dasharray="5 4"' : "",
          i === pts.length - 1
        );
      if (ray.label)
        scene.label(
          String(ray.label),
          pts[0],
          ray.labelOffset ? p(ray.labelOffset) : undefined
        );
    }
    for (const key of ["objects", "images"])
      for (const entry of list(config, key)) {
        scene.line(
          p(entry.origin),
          p(entry.target),
          entry.virtual ? 'stroke-dasharray="5 4"' : "",
          true
        );
        if (entry.label)
          scene.label(
            String(entry.label),
            p(entry.target),
            entry.labelOffset ? p(entry.labelOffset) : undefined
          );
      }
    for (const focal of list(config, "focalPoints")) {
      const [x, y] = p(focal.position);
      scene.elements.push(
        `<circle cx="${x}" cy="${y}" r="3.5" fill="#263542"/>`
      );
      if (focal.label)
        scene.label(
          String(focal.label),
          [x, y],
          focal.labelOffset ? p(focal.labelOffset) : undefined
        );
    }
    return scene.svg(String(config.caption || "光線図"));
  },
  documentation: {
    summary: "光軸・凸/凹レンズ・鏡・物体・像・焦点・指定光線の図。",
    restrictions: [
      "rays.pointsで全経路を明示する。kindは意味ラベルであり光線の自動計算はしない。",
      "像の位置・倍率・屈折/反射方向を勝手に推論しない。",
    ],
    errorExample: "rays:\n  - id: ray1\n    points: [[10, 20]]",
  },
  examples: [
    {
      name: "minimal",
      source:
        "elements:\n  - id: L\n    kind: convex-lens\n    x: 320\n    label: L",
    },
    {
      name: "standard",
      source:
        "caption: 指定した平行光線と凸レンズ\nelements:\n  - id: L\n    kind: convex-lens\n    x: 320\n    label: L\nfocalPoints:\n  - id: F\n    position: [420, 180]\n    label: F\nobjects:\n  - id: O\n    origin: [100, 180]\n    target: [100, 100]\n    label: 物体\nrays:\n  - id: r1\n    kind: parallel\n    points: [[100, 100], [320, 100], [520, 260]]",
    },
  ],
  tests: ["physics-extensions.test.ts", "pdf-regression:physics-pack"],
};

for (const definition of [mechanics, circuit, optics])
  extensionRegistry.register(definition);
