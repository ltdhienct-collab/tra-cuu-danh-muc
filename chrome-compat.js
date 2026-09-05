/* Compatibility layer: adapts the Chrome Extension APIs used by the original app to a normal web browser/PWA. */
(function () {
  const KEY = 'dmnk_local_storage_v1';
  const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const writeAll = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));
  const storage = {
    get(keys, cb) {
      const all = readAll(); let out = {};
      if (keys == null) out = all;
      else if (typeof keys === 'string') out[keys] = all[keys];
      else if (Array.isArray(keys)) keys.forEach(k => out[k] = all[k]);
      else if (typeof keys === 'object') Object.keys(keys).forEach(k => out[k] = all[k] === undefined ? keys[k] : all[k]);
      if (typeof cb === 'function') setTimeout(() => cb(out), 0); else return Promise.resolve(out);
    },
    set(items, cb) { const all = readAll(); Object.assign(all, items || {}); writeAll(all); if (typeof cb === 'function') setTimeout(cb, 0); return Promise.resolve(); },
    remove(keys, cb) { const all = readAll(); (Array.isArray(keys) ? keys : [keys]).forEach(k => delete all[k]); writeAll(all); if (typeof cb === 'function') setTimeout(cb, 0); return Promise.resolve(); }
  };
  const runtime = {
    lastError: null,
    sendMessage(message, cb) {
      const run = async () => {
        if (message && message.type === 'fetchData') {
          const r = await fetch(message.url); if (!r.ok) throw new Error('HTTP ' + r.status);
          return { success: true, data: await r.json() };
        }
        return { success: true };
      };
      if (typeof cb === 'function') run().then(cb).catch(e => cb({success:false,error:e.message}));
      return run();
    }
  };
  const notifications = { create(id, opts, cb) { if (typeof cb === 'function') setTimeout(() => cb(id || ('web-' + Date.now())), 0); }, clear(id, cb) { if (typeof cb === 'function') setTimeout(() => cb(true), 0); } };
  const action = { setBadgeText(){}, setBadgeBackgroundColor(){}, setTitle(){} };
  const tabs = { create({url}) { window.open(url, '_blank'); } };
  window.chrome = { storage: { local: storage }, runtime, notifications, action, tabs, extension: { getViews(){ return [window]; } } };
})();
