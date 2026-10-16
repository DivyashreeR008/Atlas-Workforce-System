const CACHE = "atlas-shell-v1";
const SHELL = ["/", "/manifest.json"];

const OFFLINE_HTML =
  "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
  "<title>Atlas is offline</title>" +
  "<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;" +
  "align-items:center;justify-content:center;margin:0;background:#0b0b10;color:#fff}" +
  "main{max-width:26rem;padding:2rem;text-align:center}" +
  "h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#a1a1aa;font-size:.875rem}</style>" +
  "</head><body><main><h1>Atlas is offline</h1>" +
  "<p>Check your connection. Cached pages still work; live data will resume when you reconnect.</p>" +
  "</main></body></html>";

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((hit) => hit || offlineResponse())
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
          .catch(() => offlineResponse())
    )
  );
});
