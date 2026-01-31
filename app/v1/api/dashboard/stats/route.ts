import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * 获取看板统计数据
 * GET /api/dashboard/stats
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 获取总体统计数据
    const totalStats = await db.adOrder.aggregate({
      _sum: {
        orderAmount: true,
        commissionAmount: true,
      },
      _count: true,
    })

    // 2. 获取最近30天的佣金数据（按天分组）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 使用原生 SQL 查询获取按日期分组的佣金数据
    const dailyCommissionData = await db.$queryRaw<Array<{
      date: Date
      commission: number
      orderCount: number
      orderAmount: number
    }>>`
      SELECT 
        DATE(conversionTime) as date,
        SUM(commissionAmount) as commission,
        COUNT(*) as orderCount,
        SUM(orderAmount) as orderAmount
      FROM ad_orders
      WHERE conversionTime >= ${thirtyDaysAgo}
      GROUP BY DATE(conversionTime)
      ORDER BY date ASC
    `

    // 3. 按平台统计数据
    const platformStats = await db.$queryRaw<Array<{
      platform: string
      orderCount: bigint
      orderAmount: number
      commissionAmount: number
    }>>`
      SELECT 
        platform,
        COUNT(*) as orderCount,
        SUM(orderAmount) as orderAmount,
        SUM(commissionAmount) as commissionAmount
      FROM ad_orders
      GROUP BY platform
      ORDER BY commissionAmount DESC
    `

    // 4. 最近7天的数据对比
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const [last7Days, previous7Days] = await Promise.all([
      db.adOrder.aggregate({
        where: {
          conversionTime: { gte: sevenDaysAgo }
        },
        _sum: {
          orderAmount: true,
          commissionAmount: true,
        },
        _count: true,
      }),
      db.adOrder.aggregate({
        where: {
          conversionTime: { 
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo 
          }
        },
        _sum: {
          orderAmount: true,
          commissionAmount: true,
        },
        _count: true,
      }),
    ])

    // 计算增长率
    const calculateGrowth = (current: number, previous: number) => {
      if (!previous) return 100
      return ((current - previous) / previous * 100).toFixed(1)
    }

    return NextResponse.json({
      success: true,
      data: {
        // 总体统计
        overview: {
          totalOrders: totalStats._count,
          totalOrderAmount: totalStats._sum.orderAmount || 0,
          totalCommissionAmount: totalStats._sum.commissionAmount || 0,
          // 平均订单金额
          avgOrderAmount: totalStats._count > 0 
            ? (totalStats._sum.orderAmount || 0) / totalStats._count 
            : 0,
          // 平均佣金
          avgCommission: totalStats._count > 0 
            ? (totalStats._sum.commissionAmount || 0) / totalStats._count 
            : 0,
          // 佣金率
          commissionRate: totalStats._sum.orderAmount 
            ? ((totalStats._sum.commissionAmount || 0) / (totalStats._sum.orderAmount || 1) * 100).toFixed(2)
            : 0,
        },
        // 增长数据（对比上周）
        growth: {
          ordersGrowth: calculateGrowth(
            last7Days._count, 
            previous7Days._count
          ),
          orderAmountGrowth: calculateGrowth(
            last7Days._sum.orderAmount || 0, 
            previous7Days._sum.orderAmount || 0
          ),
          commissionGrowth: calculateGrowth(
            last7Days._sum.commissionAmount || 0, 
            previous7Days._sum.commissionAmount || 0
          ),
        },
        // 30天佣金趋势数据
        dailyCommission: dailyCommissionData.map(item => ({
          date: item.date.toISOString().split('T')[0], // 格式化为 YYYY-MM-DD
          commission: Number(item.commission) || 0,
          orderCount: Number(item.orderCount) || 0,
          orderAmount: Number(item.orderAmount) || 0,
        })),
        // 平台统计数据
        platformStats: platformStats.map(item => ({
          platform: item.platform,
          orderCount: Number(item.orderCount),
          orderAmount: Number(item.orderAmount),
          commissionAmount: Number(item.commissionAmount),
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
