import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` permet de servir l'application depuis n'importe quel sous-chemin
// (GitHub Pages : https://<compte>.github.io/mon-hemicycle/).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Dans l'app native (Capacitor), pas de service worker : la coque s'en charge.
      disable: mode === 'mobile',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mon Hémicycle',
        short_name: 'Hémicycle',
        description: "Les votes et la présence des députés de l'Assemblée nationale.",
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f5f2',
        theme_color: '#1f2a44',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Les données (plusieurs dizaines de Mo) ne sont pas préchargées : elles sont
        // mises en cache au fil de la consultation, et rafraîchies en arrière-plan.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['data/**'],
        // Réception des notifications push (public/push-sw.js).
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'donnees-an', expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('assemblee-nationale.fr'),
            handler: 'CacheFirst',
            options: { cacheName: 'photos', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
}));
