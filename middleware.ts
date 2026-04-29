import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedAdminEmail } from "@/lib/admin/access";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = pathname === "/admin/login";
  const isAllowed = user?.email ? await isAllowedAdminEmail(user.email) : false;

  if (!user && !isLoginRoute) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (user && !isAllowed) {
    if (isLoginRoute) {
      return response;
    }

    return NextResponse.redirect(new URL("/admin/login?error=unauthorized", request.url));
  }

  if (user && isAllowed && isLoginRoute) {
    return NextResponse.redirect(new URL("/admin/applications", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
