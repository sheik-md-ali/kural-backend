/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 start ecosystem.config.cjs --env development
 *
 * Note: instances=1 because cluster.js manages worker processes internally.
 * PM2 is used for process management, monitoring, and auto-restart.
 */

module.exports = {
  apps: [
    {
      name: 'kural-backend',
      script: './server/cluster.js',
      instances: 1, // cluster.js handles multi-core internally
      exec_mode: 'fork', // Not 'cluster' - we manage workers ourselves
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      // Logging - Pino outputs structured JSON to stdout
      // PM2 captures stdout/stderr and writes to log files
      // Use pm2-logrotate module for log rotation
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      combine_logs: true, // Combine logs from all instances (if scaled)
      merge_logs: true,   // Merge logs from different workers
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Log type - keep as 'json' for Pino compatibility
      log_type: 'json',
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      // Graceful shutdown
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
