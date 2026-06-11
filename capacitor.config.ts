import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.b737.wb',
  appName: 'B737 Weight & Balance',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
