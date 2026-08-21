import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  void request;

  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookie() } },
  );
}
