// PM2 ecosystem config — MXDBLR API
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup   (run the printed command to survive reboots)

module.exports = {
  apps: [
    {
      name: 'mxdblr-api',
      script: 'dist/index.js',

      // SHARED VPS: this box also runs herotvmounting.com in production, so we do
      // not take every core. 'max' on a 2-vCPU host spawns 2 API workers which,
      // with the Next.js process, leaves nothing for the other site under load.
      // This workload is I/O bound (Postgres + outbound HTTP), not CPU bound, so a
      // single worker is ample for a bounded dealer base — cluster mode is kept so
      // PM2 still restarts it on crash. Raise this only after watching `pm2 monit`
      // show sustained CPU saturation, and only if the box is no longer shared.
      instances: 1,
      exec_mode: 'cluster',

      // Environment loaded with: pm2 start ... --env production
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        // Secrets are injected from the host environment — never hardcode here.
        // Ensure JWT_SECRET and DATABASE_URL are exported in the deployment shell
        // or set in /etc/environment before running pm2 start.
      },

      // Log paths — relative to the project root
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,

      // Restart policy
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,

      // Health: if the process exits immediately, back off before retrying
      exp_backoff_restart_delay: 100,
    },
  ],
};
