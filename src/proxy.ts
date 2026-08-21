import { type NextRequest, NextResponse } from "next/server";

import { readSessionMemberId } from "@/lib/auth";

export function proxy(request: NextRequest): NextResponse {
  const isAuthenticated = readSessionMemberId(request);

  if (request.nextUrl.pathname === "/login") {
    return isAuthenticated
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico).*)"],
};
