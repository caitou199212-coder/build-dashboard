import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * 获取单个账户配置
 * GET /api/accounts/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const account = await db.adAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      )
    }

    // 解析 config JSON
    let config = null
    try {
      config = account.config ? JSON.parse(account.config) : null
    } catch (e) {
      console.error('解析配置失败:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        config,
      },
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
 * 更新账户配置
 * PUT /api/accounts/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { accountName, currency, status, config } = body

    // 检查账户是否存在
    const existing = await db.adAccount.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      )
    }

    // 更新账户
    const account = await db.adAccount.update({
      where: { id: params.id },
      data: {
        accountName: accountName || existing.accountName,
        currency: currency || existing.currency,
        status: status || existing.status,
        config: config ? JSON.stringify(config) : existing.config,
      },
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: '账户更新成功',
    })
  } catch (error: any) {
    console.error('[API] 更新账户配置失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '更新账户配置失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除账户配置
 * DELETE /api/accounts/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查账户是否存在
    const existing = await db.adAccount.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      )
    }

    // 删除账户
    await db.adAccount.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: '账户删除成功',
    })
  } catch (error: any) {
    console.error('[API] 删除账户配置失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '删除账户配置失败' },
      { status: 500 }
    )
  }
}
