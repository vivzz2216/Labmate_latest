import { proxyBackend } from "@/lib/backend-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = proxyBackend;
export const HEAD = proxyBackend;
