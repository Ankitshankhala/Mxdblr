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

      // Cluster mode: one worker per CPU core for load distribution
      instances: 'max',
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
