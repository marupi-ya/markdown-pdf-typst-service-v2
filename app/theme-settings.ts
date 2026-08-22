export type ThemePreset =
  | "standard"
  | "practice"
  | "explanation"
  | "english"
  | "compact"
  | "answer";

export type DesignTheme = "default" | "academic-textbook" | "clean-textbook";

export type AcademicColorVariant =
  | "forest"
  | "navy"
  | "purple"
  | "orange"
  | "burgundy";

export type PageNumberPosition = "left" | "center" | "right";

export type StudioSettings = {
  themePreset: ThemePreset;
  designTheme: DesignTheme;
  academicColor: AcademicColorVariant;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  headingSize: number;
  includeCover: boolean;
  showHeader: boolean;
  showFooter: boolean;
  pageNumberPosition: PageNumberPosition;
  copyright: string;
  showExampleBox: boolean;
  showExerciseBox: boolean;
  showSolutionBox: boolean;
  showNoticeBox: boolean;
  tableFontSize: number;
  codeFontSize: number;
  tolerant: boolean;
  autoUpdate: boolean;
};

export const THEME_PRESET_LABELS: Record<ThemePreset, string> = {
  standard: "標準教材",
  practice: "問題演習中心",
  explanation: "解説中心",
  english: "英語長文",
  compact: "コンパクト印刷",
  answer: "解答解説",
};

export const DESIGN_THEME_LABELS: Record<DesignTheme, string> = {
  default: "Default",
  "academic-textbook": "Academic Textbook",
  "clean-textbook": "Clean Textbook",
};

export const ACADEMIC_COLOR_LABELS: Record<AcademicColorVariant, string> = {
  forest: "Forest Green",
  navy: "Navy Blue",
  purple: "Deep Purple",
  orange: "Warm Orange",
  burgundy: "Burgundy Red",
};

export const ACADEMIC_COLOR_HEX: Record<AcademicColorVariant, string> = {
  forest: "#176b42",
  navy: "#0b4a8b",
  purple: "#6b2b84",
  orange: "#d8560a",
  burgundy: "#9c1133",
};

type ThemeLayout = Omit<StudioSettings, "themePreset" | "designTheme" | "academicColor" | "copyright" | "tolerant" | "autoUpdate">;

export const THEME_PRESETS: Record<ThemePreset, ThemeLayout> = {
  standard: {
    fontSize: 8.5,
    lineHeight: 1.7,
    paragraphSpacing: 6,
    marginTop: 17,
    marginRight: 17,
    marginBottom: 17,
    marginLeft: 17,
    headingSize: 12,
    includeCover: false,
    showHeader: false,
    showFooter: true,
    pageNumberPosition: "center",
    showExampleBox: true,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 8,
    codeFontSize: 8,
  },
  practice: {
    fontSize: 9,
    lineHeight: 1.65,
    paragraphSpacing: 7,
    marginTop: 18,
    marginRight: 20,
    marginBottom: 20,
    marginLeft: 20,
    headingSize: 12.5,
    includeCover: false,
    showHeader: true,
    showFooter: true,
    pageNumberPosition: "center",
    showExampleBox: true,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 8.5,
    codeFontSize: 8,
  },
  explanation: {
    fontSize: 9.5,
    lineHeight: 1.85,
    paragraphSpacing: 8,
    marginTop: 19,
    marginRight: 19,
    marginBottom: 19,
    marginLeft: 19,
    headingSize: 13,
    includeCover: false,
    showHeader: true,
    showFooter: true,
    pageNumberPosition: "center",
    showExampleBox: true,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 8.5,
    codeFontSize: 8.5,
  },
  english: {
    fontSize: 9.5,
    lineHeight: 1.9,
    paragraphSpacing: 8,
    marginTop: 18,
    marginRight: 20,
    marginBottom: 19,
    marginLeft: 20,
    headingSize: 12.5,
    includeCover: false,
    showHeader: true,
    showFooter: true,
    pageNumberPosition: "right",
    showExampleBox: false,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 8.5,
    codeFontSize: 8,
  },
  compact: {
    fontSize: 8,
    lineHeight: 1.35,
    paragraphSpacing: 3,
    marginTop: 10,
    marginRight: 10,
    marginBottom: 10,
    marginLeft: 10,
    headingSize: 11,
    includeCover: false,
    showHeader: false,
    showFooter: true,
    pageNumberPosition: "center",
    showExampleBox: true,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 7,
    codeFontSize: 7,
  },
  answer: {
    fontSize: 9,
    lineHeight: 1.75,
    paragraphSpacing: 7,
    marginTop: 18,
    marginRight: 18,
    marginBottom: 18,
    marginLeft: 18,
    headingSize: 12.5,
    includeCover: false,
    showHeader: true,
    showFooter: true,
    pageNumberPosition: "center",
    showExampleBox: true,
    showExerciseBox: true,
    showSolutionBox: true,
    showNoticeBox: true,
    tableFontSize: 8.5,
    codeFontSize: 8.5,
  },
};

export const DEFAULT_SETTINGS: StudioSettings = {
  themePreset: "standard",
  designTheme: "default",
  academicColor: "forest",
  ...THEME_PRESETS.standard,
  copyright: "©ミライコーチング",
  tolerant: true,
  autoUpdate: true,
};

const THEME_PRESET_KEYS = new Set(Object.keys(THEME_PRESETS));
const DESIGN_THEME_KEYS = new Set(Object.keys(DESIGN_THEME_LABELS));
const ACADEMIC_COLOR_KEYS = new Set(Object.keys(ACADEMIC_COLOR_LABELS));
const PAGE_NUMBER_POSITIONS = new Set<PageNumberPosition>(["left", "center", "right"]);

const NUMBER_RANGES: Record<keyof StudioSettings, [number, number] | undefined> = {
  themePreset: undefined,
  designTheme: undefined,
  academicColor: undefined,
  fontSize: [8, 16],
  lineHeight: [1.1, 2],
  paragraphSpacing: [0, 16],
  marginTop: [8, 30],
  marginRight: [8, 30],
  marginBottom: [8, 30],
  marginLeft: [8, 30],
  headingSize: [10, 24],
  includeCover: undefined,
  showHeader: undefined,
  showFooter: undefined,
  pageNumberPosition: undefined,
  copyright: undefined,
  showExampleBox: undefined,
  showExerciseBox: undefined,
  showSolutionBox: undefined,
  showNoticeBox: undefined,
  tableFontSize: [7, 14],
  codeFontSize: [7, 14],
  tolerant: undefined,
  autoUpdate: undefined,
};

const BOOLEAN_KEYS: Array<keyof StudioSettings> = [
  "includeCover",
  "showHeader",
  "showFooter",
  "showExampleBox",
  "showExerciseBox",
  "showSolutionBox",
  "showNoticeBox",
  "tolerant",
  "autoUpdate",
];

export function applyThemePreset(current: StudioSettings, preset: ThemePreset): StudioSettings {
  return {
    ...current,
    ...THEME_PRESETS[preset],
    themePreset: preset,
  };
}

const ACADEMIC_TEXTBOOK_LAYOUT: ThemeLayout = {
  fontSize: 9,
  lineHeight: 1.72,
  paragraphSpacing: 7,
  marginTop: 17,
  marginRight: 17,
  marginBottom: 18,
  marginLeft: 17,
  headingSize: 13.5,
  includeCover: false,
  showHeader: true,
  showFooter: true,
  pageNumberPosition: "right",
  showExampleBox: true,
  showExerciseBox: true,
  showSolutionBox: true,
  showNoticeBox: true,
  tableFontSize: 8.5,
  codeFontSize: 8,
};

const CLEAN_TEXTBOOK_LAYOUT: ThemeLayout = {
  fontSize: 9.2,
  lineHeight: 1.76,
  paragraphSpacing: 6,
  marginTop: 17,
  marginRight: 15,
  marginBottom: 18,
  marginLeft: 15,
  headingSize: 13,
  includeCover: false,
  showHeader: false,
  showFooter: true,
  pageNumberPosition: "right",
  showExampleBox: true,
  showExerciseBox: true,
  showSolutionBox: true,
  showNoticeBox: true,
  tableFontSize: 8.5,
  codeFontSize: 8,
};

export function designThemeSupportsColor(designTheme: DesignTheme) {
  return designTheme === "academic-textbook" || designTheme === "clean-textbook";
}

export function applyDesignTheme(current: StudioSettings, designTheme: DesignTheme): StudioSettings {
  if (designTheme === "academic-textbook") {
    return { ...current, ...ACADEMIC_TEXTBOOK_LAYOUT, designTheme };
  }
  if (designTheme === "clean-textbook") {
    return { ...current, ...CLEAN_TEXTBOOK_LAYOUT, designTheme };
  }
  return { ...current, ...THEME_PRESETS[current.themePreset], designTheme };
}

export function normalizeThemeSettings(input: unknown): {
  settings: StudioSettings;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { settings: DEFAULT_SETTINGS, warnings: ["設定JSONのルートはオブジェクトにしてください。"] };
  }

  const envelope = input as Record<string, unknown>;
  const raw = envelope.settings && typeof envelope.settings === "object" && !Array.isArray(envelope.settings)
    ? envelope.settings as Record<string, unknown>
    : envelope;
  const legacyTheme = raw.theme;
  const requestedPreset = typeof raw.themePreset === "string" && THEME_PRESET_KEYS.has(raw.themePreset)
    ? raw.themePreset as ThemePreset
    : legacyTheme === "navy"
      ? "explanation"
      : legacyTheme === "mono"
        ? "compact"
        : "standard";
  if (raw.themePreset !== undefined && requestedPreset === "standard" && raw.themePreset !== "standard") {
    warnings.push(`themePreset「${String(raw.themePreset)}」は未対応のため標準教材を使用しました。`);
  }
  let settings: StudioSettings = applyThemePreset(DEFAULT_SETTINGS, requestedPreset);
  const requestedDesignTheme = typeof raw.designTheme === "string" && DESIGN_THEME_KEYS.has(raw.designTheme)
    ? raw.designTheme as DesignTheme
    : "default";
  const requestedAcademicColor = typeof raw.academicColor === "string" && ACADEMIC_COLOR_KEYS.has(raw.academicColor)
    ? raw.academicColor as AcademicColorVariant
    : "forest";
  if (raw.designTheme !== undefined && requestedDesignTheme === "default" && raw.designTheme !== "default") {
    warnings.push(`designTheme「${String(raw.designTheme)}」は未対応のためDefaultを使用しました。`);
  }
  if (raw.academicColor !== undefined && requestedAcademicColor === "forest" && raw.academicColor !== "forest") {
    warnings.push(`academicColor「${String(raw.academicColor)}」は未対応のためForest Greenを使用しました。`);
  }
  settings = applyDesignTheme({ ...settings, academicColor: requestedAcademicColor }, requestedDesignTheme);

  const legacyMargin = raw.margin;
  if (typeof legacyMargin === "number" && Number.isFinite(legacyMargin)) {
    const value = Math.min(30, Math.max(8, legacyMargin));
    settings = { ...settings, marginTop: value, marginRight: value, marginBottom: value, marginLeft: value };
  }

  for (const [key, range] of Object.entries(NUMBER_RANGES) as Array<[keyof StudioSettings, [number, number] | undefined]>) {
    if (!range || raw[key] === undefined) continue;
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      warnings.push(`${key}は数値ではないため無視しました。`);
      continue;
    }
    if (value < range[0] || value > range[1]) {
      warnings.push(`${key}は${range[0]}〜${range[1]}の範囲外のため補正しました。`);
    }
    (settings as unknown as Record<string, unknown>)[key] = Math.min(range[1], Math.max(range[0], value));
  }

  for (const key of BOOLEAN_KEYS) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "boolean") warnings.push(`${key}はtrue/falseではないため無視しました。`);
    else (settings as unknown as Record<string, unknown>)[key] = raw[key];
  }

  if (raw.pageNumberPosition !== undefined) {
    if (typeof raw.pageNumberPosition === "string" && PAGE_NUMBER_POSITIONS.has(raw.pageNumberPosition as PageNumberPosition)) {
      settings.pageNumberPosition = raw.pageNumberPosition as PageNumberPosition;
    } else warnings.push("pageNumberPositionはleft/center/rightではないため無視しました。");
  }
  if (raw.copyright !== undefined) {
    if (typeof raw.copyright === "string") settings.copyright = raw.copyright.slice(0, 120);
    else warnings.push("copyrightは文字列ではないため無視しました。");
  }

  return { settings, warnings };
}

export function serializeThemeSettings(settings: StudioSettings) {
  return JSON.stringify({ schemaVersion: 2, themePreset: settings.themePreset, settings }, null, 2);
}
