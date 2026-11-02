import type { CapacitorConfig } from '@capacitor/cli';

// Coque native iOS et Android. L'application embarquée est construite avec
// `npm run build:mobile` : les données ne sont pas incluses, elles sont lues
// en ligne sur le site publié (VITE_DATA_URL dans .env.mobile).
const config: CapacitorConfig = {
  appId: 'io.github.saudrix.monhemicycle',
  appName: 'Mon Hémicycle',
  webDir: 'dist',
};

export default config;
