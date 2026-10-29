/*
 * Keeps guides working with a bad signal (garages, basements, new flats).
 * Pages: network first, the last copy when offline. Hashed build files and
 * voice clips: cache first, they never change under the same name.
 * The API is never cached here.
 */
const PAGES = "hackea-pages-v1";
const FILES = "hackea-files-v1";
const KEEP = [PAGES, FILES];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  // the search is always there, even if the first visit was a guide
  e.waitUntil(caches.open(PAGES).then((c) => c.add("/")).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** A byte range of a clip, cut from the whole clip in the cache (fetched and kept first when missing). */
async function ranged(req) {
  let res = await caches.match(req.url);
  if (!res) {
    try {
      const full = await fetch(req.url);
      if (full.ok) {
        await (await caches.open(FILES)).put(req.url, full.clone());
        res = full;
      }
    } catch {
      /* offline and never heard: let the request fail below */
    }
  }
  if (!res) return fetch(req);
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

// the page that registered the worker loaded before it was in charge, and pages reached in the app never
// load as a page at all: the app names them here, so they are kept like any other visit
self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.type !== "keep") return;
  const same = (u) => {
    try {
      return new URL(u, location.origin).origin === location.origin;
    } catch {
      return false;
    }
  };
  e.waitUntil(
    Promise.all([
      d.page && same(d.page)
        ? fetch(d.page, { credentials: "same-origin" })
            .then((res) => res.ok && caches.open(PAGES).then((c) => c.put(d.page, res).then(() => trim(PAGES, 40))))
            .catch(() => {})
        : null,
      caches.open(FILES).then((c) =>
        Promise.all(
          (d.files || [])
            .filter((u) => same(u) && /\/_next\/static\/|\.(woff2?|png|svg)$/.test(new URL(u, location.origin).pathname))
            .map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))),
        ),
      ),
    ]),
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/dev/")) return;
  // audio asks for byte ranges: voice clips answer them from the cache, so the voice works offline too
  if (req.headers.has("range")) {
    if (url.pathname.startsWith("/voice/")) e.respondWith(ranged(req));
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy).then(() => trim(PAGES, 40)));
          }
          return res;
        })
        // offline: this page, the same guide at another step, or the home page
        .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || caches.match("/")),
    );
    return;
  }

  // the clip list changes with every recording: network first, the last copy when offline
  if (url.pathname.endsWith("/manifest.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(FILES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/voice/") || /\.(woff2?|png|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(FILES).then((c) => c.put(req, copy).then(() => trim(FILES, 600)));
            }
            return res;
          }),
      ),
    );
  }
});
