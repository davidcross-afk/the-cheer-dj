/* Combined worker: OneSignal push + The Cheer DJ caching.
   OneSignal replaces other root-scope workers, so we register THIS file
   and pull both pieces in here. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
importScripts("./sw.js");
