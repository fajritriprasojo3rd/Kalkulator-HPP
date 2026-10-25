const CACHE_NAME = 'kaspro-v3';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// 1. Simpan file ke cache saat pertama kali dibuka
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Menyimpan file ke cache...');
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Ambil file dari cache jika offline (atau dari internet jika online)
self.addEventListener('fetch', event => {
  // Jangan cache request ke Supabase (database) agar data selalu real-time
  if (event.request.url.includes('supabase.co')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// 3. Hapus cache lama jika ada update versi baru
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 
