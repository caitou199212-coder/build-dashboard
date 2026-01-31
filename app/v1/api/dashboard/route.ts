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
        dailyData: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    })

    // 聚合数据
    let totalImpressions = 0
    let totalClicks = 0
    let totalCost = 0
    let totalConversions = 0
    let totalRevenue = 0

    campaigns.forEach(campaign => {
      campaign.dailyData.forEach(data => {
        totalImpressions += data.impressions
        totalClicks += data.clicks
        totalCost += data.cost
        totalConversions += data.conversions
        totalRevenue += data.revenue
      })
    })

    // 计算衍生指标
    const ctr = totalClicks > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0
    const cpa = totalConversions > 0 ? totalCost / totalConversions : 0
    const roas = totalCost > 0 ? totalRevenue / totalCost : 0

    // 获取热门广告活动（按支出排序）
    const topCampaigns = campaigns
      .map(campaign => {
        const campaignCost = campaign.dailyData.reduce((sum, data) => sum + data.cost, 0)
        const campaignClicks = campaign.dailyData.reduce((sum, data) => sum + data.clicks, 0)
        const campaignImpressions = campaign.dailyData.reduce((sum, data) => sum + data.impressions, 0)
        const campaignConversions = campaign.dailyData.reduce((sum, data) => sum + data.conversions, 0)
        const campaignRevenue = campaign.dailyData.reduce((sum, data) => sum + data.revenue, 0)
        const campaignCtr = campaignImpressions > 0 ? (campaignClicks / campaignImpressions) * 100 : 0
        const campaignRoas = campaignCost > 0 ? campaignRevenue / campaignCost : 0

        return {
          id: campaign.id,
          name: campaign.campaignName,
          platform: campaign.account?.platform || 'unknown',
          impressions: campaignImpressions,
          clicks: campaignClicks,
          ctr: campaignCtr.toFixed(2) + '%',
          cost: campaignCost,
          conversions: campaignConversions,
          roas: campaignRoas,
        }
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    // 获取每日数据趋势
    const dailyData: any[] = []
    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      let dailyImpressions = 0
      let dailyClicks = 0
      let dailyCost = 0
      let dailyRevenue = 0

      campaigns.forEach(campaign => {
        campaign.dailyData.forEach(data => {
          const dataDate = new Date(data.date)
          if (dataDate >= date && dataDate < nextDate) {
            dailyImpressions += data.impressions
            dailyClicks += data.clicks
            dailyCost += data.cost
            dailyRevenue += data.revenue
          }
        })
      })

      dailyData.push({
        date: date.toISOString().split('T')[0],
        impressions: dailyImpressions,
        clicks: dailyClicks,
        cost: dailyCost,
        revenue: dailyRevenue,
      })
    }

    // 计算环比数据（与上个周期对比）
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - daysAgo)
    const previousEndDate = new Date(startDate)

    const previousCampaigns = await db.campaign.findMany({
      where: {
        ...accountWhere,
        status: 'active',
      },
      include: {
        dailyData: {
          where: {
            date: {
              gte: previousStartDate,
              lte: previousEndDate,
            },
          },
        },
      },
    })

    let previousCost = 0
    let previousRevenue = 0
    let previousConversions = 0

    previousCampaigns.forEach(campaign => {
      campaign.dailyData.forEach(data => {
        previousCost += data.cost
        previousRevenue += data.revenue
        previousConversions += data.conversions
      })
    })

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
