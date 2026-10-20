import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solsql.client',
  appName: 'SolSQL',
  webDir: 'dist',
  plugins: {
    Nodejs: {
      // 相对 webDir：网关单文件包由 scripts/build-mobile.mjs 生成到 dist/nodejs
      nodeDir: 'nodejs'
    },
    SystemBars: {
      // 深色应用背景 → 状态栏/手势条用浅色图标
      style: 'DARK'
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
