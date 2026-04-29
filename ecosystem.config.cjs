// PM2 ecosystem for dimi-cms (development on a public host)
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 logs cms-api
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'cms-api',
      cwd: path.join(ROOT, 'apps/cms-api'),
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        ENV_FILE: path.join(ROOT, '.env'),
      },
      max_memory_restart: '700M',
      out_file: path.join(ROOT, 'logs/cms-api.out.log'),
      error_file: path.join(ROOT, 'logs/cms-api.err.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'cms-admin',
      cwd: path.join(ROOT, 'apps/cms-admin'),
      script: 'npm',
      args: 'run start',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '700M',
      out_file: path.join(ROOT, 'logs/cms-admin.out.log'),
      error_file: path.join(ROOT, 'logs/cms-admin.err.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'web-frontend',
      cwd: path.join(ROOT, 'apps/web-frontend'),
      script: 'npm',
      args: 'run start',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '700M',
      out_file: path.join(ROOT, 'logs/web-frontend.out.log'),
      error_file: path.join(ROOT, 'logs/web-frontend.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
