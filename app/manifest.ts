import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expenses',
    short_name: 'Expenses',
    description: 'Shared monthly expense tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F5F2',
    theme_color: '#0E6B5C',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}
