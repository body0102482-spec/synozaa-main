module.exports = {
  apps: [
    {
      name: 'synoza',
      cwd: '/home/adminanmkavps/synoza.anmka.com/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '5099',
        SYNOZA_EXAM_MEDIA_ROOT: '/home/adminanmkavps/synoza-media/exam',
      },
    },
  ],
};
