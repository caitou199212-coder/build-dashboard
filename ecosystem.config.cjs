module.exports = {
  apps: [
    {
      name: 'web-app',
      script: 'npm',
      // args: 'start',
      args: 'run start',
      cwd: '/home/applications/web-app',
      interpreter: 'none',
      instances: 1,  // 或设置为'max'以启用集群模式
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production', // ✅ 改为 production，启用生产优化
        PORT: 3389,
        HOST: '0.0.0.0',
        TZ: 'Asia/Shanghai',
        NODE_OPTIONS: '--max-old-space-size=512',
        // 数据库连接配置（优化连接池参数）
        // connection_limit: 最大连接数（默认 10，建议 20-50）
        // pool_timeout: 连接超时时间（秒）
        // connect_timeout: 建立连接超时（秒）
        DATABASE_URL: 'mysql://dashboard_admin:Admin%5B%2A%5D%25119335%25@103.218.241.134:3306/ads_dashboard?connection_limit=30&pool_timeout=20&connect_timeout=10',
      },
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      // 日志配置
      error_file: '/app/logs/web-app-error.log',
      out_file: '/app/logs/web-app-out.log',
      log_file: '/app/logs/web-app-combined.log',
      time: true,
      // 监听信号
      kill_timeout: 5000,
      listen_timeout: 5000,
      // PM2日志管理
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 监控指标
      vizion: false,
      // 实例扩展
      increment_var: 'INSTANCE_ID',
      // 优雅关闭
      shutdown_with_message: true,
    },
  ],
};