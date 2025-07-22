const CACHE_NAME = 'kill-history-cache-v3'; // 更新快取名稱
const urlsToCache = [
    '/',
    '/index.html',
    '/static/js/bundle.js',
    '/static/css/main.css',
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
           
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// 激活 Service Worker，清除舊快取
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                       
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 處理 fetch 請求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 跳過 API 請求和動態路由
    if (url.pathname.startsWith('/api') || url.pathname === '/login' || url.pathname === '/register' || url.pathname === '/') {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        }).catch((error) => {
            console.error('Fetch failed:', error);
            return caches.match('/index.html');
        })
    );
});