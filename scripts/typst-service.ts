import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { compileWithTypstCli, getTypstCompilerStatus, TypstCompilerError } from "../server/typst-cli-compiler";
import { typstErrorPayload } from "../app/pdf-engine/typst/errors";

const port = Number(process.env.PORT ?? 8789);
// Render and other container hosts inject PORT and require the server to bind
// to every interface. Keep localhost as the safe default for local use.
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const token = process.env.TYPST_SERVICE_TOKEN ?? "";
const MAX_BODY_BYTES = 2_500_000;

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
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("PDF生成リクエストが2.5MBの上限を超えています。"), { code: "REQUEST_TOO_LARGE" });
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
      const status = await getTypstCompilerStatus();
      json(response, 200, status);
    } catch (error) {
      const payload = error instanceof TypstCompilerError ? error.payload : typstErrorPayload(error, "compiler");
      json(response, 503, { available: false, ...payload });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/compile") {
    try {
      const input = await readJson(request);
      const result = await compileWithTypstCli(input);
      response.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": String(result.pdf.length),
        "cache-control": "no-store",
        "content-disposition": "inline; filename=material.pdf",
        "x-content-type-options": "nosniff",
        "x-typst-version": result.typstVersion,
        "x-pdf-pages": String(result.pageCount),
        "x-text-validation": result.textValidation.performed ? `${result.textValidation.matchedSamples}/${result.textValidation.checkedSamples}` : "unavailable",
      });
      response.end(result.pdf);
    } catch (error) {
      const payload = error instanceof TypstCompilerError ? error.payload : typstErrorPayload(error, "compiler");
      const status = payload.code === "REQUEST_TOO_LARGE" ? 413 : payload.stage === "request" ? 400 : 422;
      json(response, status, payload);
    }
    return;
  }

  json(response, 404, { stage: "request", code: "NOT_FOUND", message: "要求されたコンパイラAPIはありません。" });
});

server.listen(port, host, () => {
  process.stdout.write(`Typst compiler service listening on http://${host}:${port}\n`);
});

