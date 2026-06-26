import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Protect dashboard routes
  const isAdminPath = path.startsWith('/admin');
  const isTeacherPath = path.startsWith('/teacher');
  const isBursarPath = path.startsWith('/bursar');

  if (isAdminPath || isTeacherPath || isBursarPath) {
    if (!user) {
      // Redirect to login if not authenticated
      url.pathname = '/login';
      url.searchParams.set('redirect', path);
      return NextResponse.redirect(url);
    }

    // Retrieve user role from database
    const { data: userData, error } = await supabase
      .from('users')
      .select('role_id')
      .eq('auth_user_id', user.id)
      .single();

    if (error || !userData) {
      return new NextResponse('Unauthorized: Profile not found', { status: 403 });
    }

    // Fetch the role name corresponding to the role_id
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', userData.role_id)
      .single();

    if (roleError || !roleData) {
      return new NextResponse('Unauthorized: Role metadata not found', { status: 403 });
    }

    const roleName = roleData.name;

    // Route Protection Enforcement
    if (isAdminPath && roleName !== 'SUPER_ADMIN') {
      return new NextResponse('Unauthorized: Super Admin access required', { status: 403 });
    }
    if (isTeacherPath && roleName !== 'TEACHER') {
      return new NextResponse('Unauthorized: Teacher access required', { status: 403 });
    }
    if (isBursarPath && roleName !== 'BURSAR') {
      return new NextResponse('Unauthorized: Bursar access required', { status: 403 });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
