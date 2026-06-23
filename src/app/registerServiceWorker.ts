/**
 * production環境だけでservice workerを登録する。
 *
 * GitHub Pagesのサブパス配信でもキャッシュ範囲がずれないよう、ViteのBASE_URLをscopeに使う。
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL("./sw.js", window.location.href);

    navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL }).catch((error) => {
      console.warn("RiftSync service worker registration failed.", error);
    });
  });
}
