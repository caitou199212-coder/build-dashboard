import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// 不需要鉴权的路径
const PUBLIC_PATHS = ['/', '/login', '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/me']

// API 路径（需要特殊处理）
const API_PATHS = ['/v1/api']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 允许公开路径直接访问
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 从 cookie 中获取 token
  const token = request.cookies.get('auth_token')?.value

  console.log('[Token]:', token)

  // 如果没有 token，重定向到登录页
  if (!token) {
    // 对于 API 请求，返回 401
    if (API_PATHS.some(path => pathname.startsWith(path))) {
      return NextResponse.json(
        { success: false, error: '未授权访问，请先登录' },
        { status: 401 }
      )
    }
    
    // 对于页面请求，重定向到登录页
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 验证 token (使用 jose 库，兼容 Edge Runtime)
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch (error) {
    console.error('Token verification failed:', error)
    
    // token 无效，清除 cookie 并重定向
    const response = API_PATHS.some(path => pathname.startsWith(path))
      ? NextResponse.json(
          { success: false, error: 'Token 已过期，请重新登录' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/login', request.url))
    
    response.cookies.delete('auth_token')
    return response
  }
}

// 配置需要运行 middleware 的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
