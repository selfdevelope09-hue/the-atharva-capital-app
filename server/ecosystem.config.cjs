/** PM2: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'auron-realtime',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
