import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * 用户登出
 * POST /api/auth/logout
 */
export async function POST() {
  // 清除 cookie - 使用 Next.js 15 的 cookies() API
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')

  return NextResponse.json({
    success: true,
    message: '登出成功',
  })
}
