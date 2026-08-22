import { proxyTypst } from "../_proxy";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2_500_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ stage: "request", code: "REQUEST_TOO_LARGE", message: "PDF生成リクエストが2.5MBの上限を超えています。" }, { status: 413 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_REQUEST_BYTES) {
    return Response.json({ stage: "request", code: "REQUEST_TOO_LARGE", message: "PDF生成リクエストが2.5MBの上限を超えています。" }, { status: 413 });
  }
  return proxyTypst("/compile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: bytes,
  });
}

