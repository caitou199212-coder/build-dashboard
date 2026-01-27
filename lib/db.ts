import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 优化后的 Prisma 配置
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    // 连接池配置
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// ✅ 无论开发还是生产环境，都使用全局单例
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}

// 优雅关闭连接
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    console.log('[Prisma] 正在断开数据库连接...')
    await db.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}