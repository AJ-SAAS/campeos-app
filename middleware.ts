import { NextResponse, type NextRequest } from "next/server";

// Remembers which country the visitor is in (Vercel sends it in a header),
// so the consent banner and the Pixel know whether to ask first. This is
// the only thing it does.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  if (req.cookies.get("cp_country")?.value !== country) {
    res.cookies.set("cp_country", country, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/|.*\\..*).*)"],
};
