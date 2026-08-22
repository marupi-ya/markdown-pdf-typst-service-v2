import { proxyTypst } from "../_proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyTypst("/health", { method: "GET" });
}

