import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * 获取所有账户配置
 * GET /api/accounts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    const where = platform ? { platform } : {}

    const accounts = await db.adAccount.findMany({
      where,
      orderBy: [
        { platform: 'asc' },
        { accountName: 'asc' },
      ],
    })

    // 解析 config JSON
    const accountsWithConfig = accounts.map(account=> {
      let config = null
      try {
        config = account.config ? JSON.parse(account.config) : null
      } catch (e) {
        console.error('解析配置失败:', e)
      }
      return {
        ...account,
        config,
      }
    })

    return NextResponse.json({
      success: true,
      data: accountsWithConfig,
    })
  } catch (error: any) {
    console.error('[API] 获取账户配置失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '获取账户配置失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建账户配置
 * POST /api/accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platform, accountId, accountName, currency, status, config } = body

    // 验证必填字段
    if (!platform || !accountId || !accountName) {
      return NextResponse.json(
        { success: false, error: '平台、账户ID和账户名称为必填项' },
        { status: 400 }
      )
    }

    // 检查账户是否已存在
    const existing = await db.adAccount.findUnique({
      where: {
        platform_accountId: {
          platform,
          accountId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: '该账户已存在' },
        { status: 400 }
      )
    }

    // 创建账户
    const account = await db.adAccount.create({
      data: {
        platform,
        accountId,
        accountName,
        currency: currency || 'USD',
        status: status || 'active',
        config: config ? JSON.stringify(config) : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: '账户创建成功',
    })
  } catch (error: any) {
    console.error('[API] 创建账户配置失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '创建账户配置失败' },
      { status: 500 }
    )
  }
}
