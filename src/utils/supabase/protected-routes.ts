export const protectedRoutes = ['/account']

export const isProtectedRoute = (pathname: string) => {
    console.log('here')
    return protectedRoutes.some((route) => pathname.startsWith(route))
}
