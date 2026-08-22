const MAX_RESPONSE_BYTES = 30_000_000;
const TIMEOUT_MS = 55_000;

function serviceUrl(path: "/health" | "/compile") {
  const configured = process.env.TYPST_SERVICE_URL?.trim();
  if (!configured) return null;
  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    return null;
  }
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "::1";
  if (base.protocol !== "https:" && !(local && base.protocol === "http:")) return null;
  return new URL(path, `${base.toString().replace(/\/$/u, "")}/`);
}

export function unavailableResponse() {
  return Response.json({
    available: false,
    stage: "compiler",
    code: "TYPST_COMPILER_UNAVAILABLE",
    message: "Typst Compiler Serviceが未設定です。公式Typst CLIを実行するサービスを起動し、TYPST_SERVICE_URLを設定してください。Legacy Engineは引き続き利用できます。",
  }, { status: 503, headers: { "cache-control": "no-store" } });
}

export async function proxyTypst(path: "/health" | "/compile", init: RequestInit = {}) {
  const target = serviceUrl(path);
  if (!target) return unavailableResponse();
  const headers = new Headers(init.headers);
  const token = process.env.TYPST_SERVICE_TOKEN?.trim();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target, { ...init, headers, signal: controller.signal, redirect: "error" });
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      return Response.json({ stage: "compiler", code: "TYPST_RESPONSE_TOO_LARGE", message: "Typstサービスの応答が30MBの上限を超えています。" }, { status: 502 });
    }
    const responseHeaders = new Headers({
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    for (const name of ["content-disposition", "x-typst-version", "x-pdf-pages", "x-text-validation"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(bytes, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return Response.json({
      stage: "compiler",
      code: timedOut ? "TYPST_SERVICE_TIMEOUT" : "TYPST_SERVICE_UNREACHABLE",
      message: timedOut
        ? "Typst PDF生成が55秒以内に完了しませんでした。"
        : "Typst Compiler Serviceへ接続できません。サービスURLと稼働状態を確認してください。",
    }, { status: 502, headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}

