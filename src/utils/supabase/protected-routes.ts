export const protectedRoutes = ['/account']

export const isProtectedRoute = (pathname: string) => {
    return protectedRoutes.some((route) => pathname.startsWith(route))
}
