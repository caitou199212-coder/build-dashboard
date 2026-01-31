import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * 获取看板统计数据
 * GET /api/dashboard
 * Query: { userId, period }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const period = searchParams.get('period') || '30' // 默认30天

    // 计算日期范围
    const daysAgo = parseInt(period)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // 如果指定了 userId，获取该用户有权限访问的广告账户
    let accountIds: string[] = []
    if (userId) {
      const userAccounts = await db.userAccount.findMany({
        where: { userId },
        select: { accountId: true },
      })
      accountIds = userAccounts.map(ua => ua.accountId)
    }

    // 构建查询条件
    const accountWhere: any = {}
    if (accountIds.length > 0) {
      accountWhere.id = { in: accountIds }
    }

    // 获取活跃的广告账户数量
    const activeAccounts = await db.adAccount.count({
      where: {
        ...accountWhere,
        status: 'active',
      },
    })

    // 获取所有广告活动
    const campaigns = await db.campaign.findMany({
      where: {
        ...accountWhere,
        status: 'active',
      },
      include: {
        account: true,
      },
    })

    // 从广告订单表中获取数据聚合
    const orderData = await db.adOrder.findMany({
      where: {
        conversionTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    // 聚合数据（从订单数据中计算）
    let totalImpressions = 0
    let totalClicks = 0
    let totalCost = 0
    let totalConversions = orderData.length
    let totalRevenue = orderData.reduce((sum, order) => sum + order.orderAmount, 0)

    // 计算衍生指标
    const ctr = totalClicks > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0
    const cpa = totalConversions > 0 ? totalCost / totalConversions : 0
    const roas = totalCost > 0 ? totalRevenue / totalCost : 0

    // 获取热门广告活动（基于订单数据）
    const topCampaigns = campaigns
      .map(campaign => {
        // 简化处理，因为没有 dailyData 关系
        return {
          id: campaign.id,
          name: campaign.campaignName,
          platform: campaign.account?.platform || 'unknown',
          impressions: 0,
          clicks: 0,
          ctr: '0.00%',
          cost: 0,
          conversions: 0,
          roas: 0,
        }
      })
      .slice(0, 10)

    // 获取每日数据趋势（基于订单数据）
    const dailyData: any[] = []
    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dailyOrders = orderData.filter(order => {
        const orderDate = new Date(order.conversionTime)
        return orderDate >= date && orderDate < nextDate
      })

      const dailyCost = 0
      const dailyRevenue = dailyOrders.reduce((sum, order) => sum + order.orderAmount, 0)

      dailyData.push({
        date: date.toISOString().split('T')[0],
        impressions: 0,
        clicks: 0,
        cost: dailyCost,
        revenue: dailyRevenue,
      })
    }

    // 计算环比数据（与上个周期对比）
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - daysAgo)
    const previousEndDate = new Date(startDate)

    const previousOrderData = await db.adOrder.findMany({
      where: {
        conversionTime: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
    })

    const previousCost = 0
    const previousRevenue = previousOrderData.reduce((sum, order) => sum + order.orderAmount, 0)
    const previousConversions = previousOrderData.length

    const costChange = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0
    const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0
    const conversionsChange = previousConversions > 0 ? ((totalConversions - previousConversions) / previousConversions) * 100 : 0
    const roasChange = 0 // 简化处理

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCost: Math.round(totalCost),
          totalRevenue: Math.round(totalRevenue),
          totalConversions,
          roas: roas.toFixed(2),
          activeAccounts,
          campaignsCount: campaigns.length,
        },
        metrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: ctr.toFixed(2),
          cpc: cpc.toFixed(2),
          cpa: cpa.toFixed(2),
          roas: roas.toFixed(2),
        },
        changes: {
          cost: costChange.toFixed(1),
          revenue: revenueChange.toFixed(1),
          conversions: conversionsChange.toFixed(1),
          roas: roasChange.toFixed(1),
        },
        topCampaigns,
        dailyData,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { success: false, error: '获取看板数据失败' },
      { status: 500 }
    )
  }
}
