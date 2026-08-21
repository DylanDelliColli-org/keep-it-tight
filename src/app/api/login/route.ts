import { z } from "zod";

import { createSessionCookie, verifyLogin } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

const INVALID_CREDENTIALS = { error: "Invalid email or password" };

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const member = await verifyLogin(parsed.data.email, parsed.data.password);
  if (!member) {
    return Response.json(INVALID_CREDENTIALS, { status: 401 });
  }

  return Response.json(
    { member },
    { headers: { "set-cookie": createSessionCookie(member.id) } },
  );
}
