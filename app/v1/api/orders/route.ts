import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * 获取订单列表
 * GET /api/orders
 * Query: { platform, status, page, limit, startDate, endDate }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {}
    
    if (platform) {
      where.platform = platform
    }
    
    if (status) {
      where.status = status
    }
    
    if (startDate || endDate) {
      where.conversionTime = {}
      if (startDate) {
        where.conversionTime.gte = new Date(startDate)
      }
      if (endDate) {
        where.conversionTime.lte = new Date(endDate)
      }
    }

    // 查询订单
    const [orders, total] = await Promise.all([
      db.adOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          conversionTime: 'desc',
        },
      }),
      db.adOrder.count({ where }),
    ])

    // 计算汇总数据
    const summary = await db.adOrder.aggregate({
      where,
      _sum: {
        orderAmount: true,
        commissionAmount: true,
      },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalOrders: summary._count,
          totalOrderAmount: summary._sum.orderAmount || 0,
          totalCommissionAmount: summary._sum.commissionAmount || 0,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    )
  }
}
