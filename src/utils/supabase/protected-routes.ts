export const protectedRoutes = ['/account', '/documents']

export const isProtectedRoute = (pathname: string) => {
    return protectedRoutes.some((route) => pathname.startsWith(route))
}
