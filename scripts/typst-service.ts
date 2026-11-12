import runtimeContract from "../app/production/runtime-manifest.json";
import {readFileSync} from "node:fs";
import {FIGURE_TYPES} from "../app/studio-core";
import { MAX_LAYOUT_BYTES, PDF_LAYOUT_CONTENT_TYPE } from "../app/pdf-engine/typst/layout-inspection";
import { MATH_C_TYPES } from "../app/math-c/syntax";
import { extensionRegistry } from "../app/extensions";
import { TYPST_MAX_REQUEST_BYTES } from "../app/material-assets";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { compileWithTypstCli, getCachedCompilerStatus, TypstCompilerError } from "../server/typst-cli-compiler";
import { typstErrorPayload } from "../app/pdf-engine/typst/errors";
import { TYPST_THEME_LABELS } from "../app/pdf-engine/typst/theme";

const port = Number(process.env.PORT ?? 8789);
// Render and other container hosts inject PORT and require the server to bind
// to every interface. Keep localhost as the safe default for local use.
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const token = process.env.TYPST_SERVICE_TOKEN ?? "";
const MAX_BODY_BYTES = TYPST_MAX_REQUEST_BYTES;
let activeCompiles=0;
const MAX_CONCURRENT_COMPILES=1;
// Advertise the renderer actually loaded by this service, not a stale manifest.
const runtime={...runtimeContract,rendererFingerprint:createHash("sha256").update(readFileSync(new URL("../app/pdf-engine/typst/figure-svg.ts",import.meta.url))).digest("hex")};

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function authorized(request: IncomingMessage) {
  if (!token) return true;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/iu, "") ?? "";
  const expectedBytes = Buffer.from(token);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("PDF生成リクエストが14MBの上限を超えています。"), { code: "REQUEST_TOO_LARGE" });
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("PDF生成リクエストをJSONとして解析できません。"), { code: "INVALID_JSON" });
  }
}

const server = createServer(async (request, response) => {
  if (!authorized(request)) {
    json(response, 401, { stage: "request", code: "UNAUTHORIZED", message: "Typstコンパイラサービスの認証に失敗しました。" });
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    try {
      const status = await getCachedCompilerStatus();
      json(response, 200, { available:status.available,version:status.version,runtime,release:process.env.RENDER_GIT_COMMIT??"local",activeCompiles,supportedThemes: Object.keys(TYPST_THEME_LABELS), supportedFigures: [...new Set([...FIGURE_TYPES,...MATH_C_TYPES,...extensionRegistry.list().filter(item=>item.kind==="figure").map(item=>item.type)])].filter(type=>!["image","generic-table"].includes(type)), supportedExtensions: Object.fromEntries(extensionRegistry.list().map(item=>[item.type,item.version])) });
    } catch (error) {
      const payload = error instanceof TypstCompilerError ? error.payload : typstErrorPayload(error, "compiler");
      json(response, 503, { available: false, ...payload });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/compile") {
    if(activeCompiles>=MAX_CONCURRENT_COMPILES){response.setHeader("retry-after","20");json(response,503,{stage:"compiler",code:"COMPILER_BUSY",message:"PDFを生成中です。20秒後に再試行してください。"});return;}
    activeCompiles++;
    try {
      const input = await readJson(request);
      const result = await compileWithTypstCli(input);
      const layout = result.layoutInspection
        ? Buffer.from(JSON.stringify({ ...result.layoutInspection, warnings: result.warnings.slice(0, 150) }))
        : null;
      const sidecar = layout && layout.length <= MAX_LAYOUT_BYTES ? layout : null;
      const prefix = sidecar ? Buffer.alloc(4) : null;
      if (prefix && sidecar) prefix.writeUInt32BE(sidecar.length);
      response.writeHead(200, {
        "content-type": sidecar ? PDF_LAYOUT_CONTENT_TYPE : "application/pdf",
        "content-length": String(result.pdf.length + (sidecar ? sidecar.length + 4 : 0)),
        "cache-control": "no-store",
        "content-disposition": "inline; filename=material.pdf",
        "x-content-type-options": "nosniff",
        "x-typst-version": result.typstVersion,
        "x-studio-capability-fingerprint": runtime.rendererFingerprint,
        "x-pdf-pages": String(result.pageCount),
        "x-text-validation": result.textValidation.performed ? `${result.textValidation.matchedSamples}/${result.textValidation.checkedSamples}` : "unavailable",
        "x-studio-warnings": encodeURIComponent(JSON.stringify(result.warnings.slice(0,6).map(warning=>({...warning,message:warning.message.slice(0,110)})))),
      });
      if (prefix && sidecar) { response.write(prefix); response.write(sidecar); }
      response.end(result.pdf);
    } catch (error) {
      const payload = error instanceof TypstCompilerError ? error.payload : typstErrorPayload(error, "compiler");
      const status = payload.code === "TYPST_COMPILE_TIMEOUT" ? 504 : payload.code === "REQUEST_TOO_LARGE" ? 413 : payload.stage === "request" ? 400 : 422;
      if(status===504)response.setHeader("retry-after","30");
      json(response, status, payload);
    } finally {activeCompiles--;}
    return;
  }

  json(response, 404, { stage: "request", code: "NOT_FOUND", message: "要求されたコンパイラAPIはありません。" });
});

server.listen(port, host, () => {
  process.stdout.write(`Typst compiler service listening on http://${host}:${port}\n`);
});
