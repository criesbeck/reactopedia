var CACHE_NAME = "act-cache";

var ASSETS = [
  '',
  '/',
  'index.html',
  'data/topic-graph-vs.json',
  'icons/favicon.ico',
  'styles/styles.css',
  'styles/bootstrap.min.css',
  'styles/bootstrap-theme.min.css',
  'scripts/json-book-v2.js',
  'scripts/jquery-3.2.1.min.js',
  'scripts/bootstrap.min.js',
  'scripts/mustache.min.js',
  'images/offline.png',
  'images/toolbox.png'
];

function getOfflineAsset(url) {
  if (isGraphic(url)) {
    return 'pages/offline.png';
  }
  else {
    return 'images/offline.html';
  }
}

function isGraphic(url) {
  var n = url.lastIndexOf('.');
  if (n === -1) return false;
  var ext = url.slice(n + 1);
  return ['gif', 'jpeg', 'jpg', 'png'].indexOf(ext) !== -1;
}

self.addEventListener('install', function(event) {
 event.waitUntil(
   caches.open(CACHE_NAME).then(function(cache) {
     return cache.addAll(ASSETS);
   }).then(function() {
     console.log('cached')
     return self.skipWaiting();
   }).catch((error) =>  {
     console.error('Failed to cache', error);
   })
 );
});


self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    }).catch(function() {
      return caches.match(getOfflineAsset(event.request.url));
    })
  );
});

self.addEventListener('activate', function(event) {
  // Calling claim() to force a "controllerchange" event on navigator.serviceWorker
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  console.log(event.data.length + ' items received');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(event.data);
    }).then(function() {
      console.log(event.data.length + ' items cached');
      return self.skipWaiting();
    }).catch((error) =>  {
      console.error('Failed to cache', error);
    })
  );
});