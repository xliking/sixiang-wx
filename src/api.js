(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 后端（Java 服务 xcx_game_server）对接层。
   *
   * 安全约定：
   * - 登录后拿到 token（身份）和 sessionKey（签名密钥），之后每个请求都带
   *   Authorization / X-Ts / X-Nonce / X-Sign，服务端据此识别玩家、防篡改、防重放；
   * - 请求体里不再传 openid；
   * - 客户端不保存也不上传存档：每个操作调用对应接口，服务端执行后返回最新存档（见 state/gameState.js 的 act）。
   *
   * 本地联调默认 http://localhost:3002；微信上线改为已备案的 HTTPS 域名，
   * 并在公众平台把该域名加入 request 与 downloadFile 合法域名。
   */
  const API_BASE = 'http://localhost:3002';

  const KEY_UID = 'sixiang_client_uid';
  const KEY_CONFIG = 'sixiang_cfg_';
  const KEY_ASSETS = 'sixiang_remote_assets';

  let token = null;
  let sessionKey = null;
  let timeOffset = 0;
  let online = false;
  let loginPromise = null;
  let loginError = '';

  let mails = [];
  let activities = [];

  function getOrCreateClientUid() {
    let uid = App.Platform.loadStorage(KEY_UID);
    if (!uid) {
      uid = 'wx_uid_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      App.Platform.saveStorage(KEY_UID, uid);
    }
    return uid;
  }

  function randomNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 20; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // ---------------------------------------------------------------- 底层请求

  function rawRequest(path, method, body, headers) {
    return new Promise((resolve) => {
      const url = API_BASE + path;
      if (App.Platform.isWechat && typeof wx.request === 'function') {
        wx.request({
          url,
          method,
          data: body || undefined,
          header: headers,
          timeout: 8000,
          success: (res) => resolve(res.data && typeof res.data === 'object' ? res.data : null),
          fail: () => resolve(null),
        });
      } else if (typeof fetch === 'function') {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
        fetch(url, { method, headers, body: body || undefined, signal: ctrl ? ctrl.signal : undefined })
          .then((r) => r.json())
          .then((json) => { if (timer) clearTimeout(timer); resolve(json); })
          .catch(() => { if (timer) clearTimeout(timer); resolve(null); });
      } else {
        resolve(null);
      }
    });
  }

  /** 公开接口（登录 / 配置 / 资源清单），无需签名 */
  function publicRequest(path, method, data) {
    return rawRequest(path, method || 'GET', data ? JSON.stringify(data) : '', { 'Content-Type': 'application/json' });
  }

  /** 需要登录的接口：自动签名；令牌失效时自动重新登录并重试一次 */
  async function request(path, method, data, isRetry) {
    if (!token && !(await ensureLogin())) return null;
    const m = method || 'GET';
    const body = data ? JSON.stringify(data) : '';
    const ts = String(Date.now() + timeOffset);
    const nonce = randomNonce();
    const payload = [m, path, ts, nonce, App.Crypto.sha256Hex(body)].join('\n');
    const res = await rawRequest(path, m, body, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      'X-Ts': ts,
      'X-Nonce': nonce,
      'X-Sign': App.Crypto.hmacSha256Hex(sessionKey, payload),
    });
    if (res && res.code === 401 && !isRetry) {
      if (res.serverTime) timeOffset = res.serverTime - Date.now();
      token = null;
      if (await ensureLogin()) return request(path, method, data, true);
      return null;
    }
    online = !!res;
    return res;
  }

  // ---------------------------------------------------------------- 登录与存档

  function ensureLogin() {
    if (token) return Promise.resolve(true);
    if (!loginPromise) {
      loginPromise = doLogin().then((r) => { loginPromise = null; return r; });
    }
    return loginPromise;
  }

  async function doLogin() {
    const clientUid = getOrCreateClientUid();
    let code = 'mock_' + clientUid;
    if (App.Platform.isWechat && typeof wx.login === 'function') {
      code = await new Promise((resolve) => {
        wx.login({ success: (r) => resolve(r.code || code), fail: () => resolve(code) });
      });
    }
    const res = await publicRequest('/api/auth/wx-login', 'POST', { code, clientUid });
    if (!res || !res.ok) {
      online = false;
      loginError = res && res.msg ? res.msg : '无法连接服务器，请检查网络';
      return false;
    }
    token = res.token;
    sessionKey = res.sessionKey;
    timeOffset = (res.serverTime || Date.now()) - Date.now();
    online = true;
    loginError = '';
    // 存档以服务端为准：登录即拿到完整存档（新玩家为 null，进入选阵营）
    App.State.applyServerSave(res.save);
    App.State.setProfile(res.profile);
    return res;
  }

  // ---------------------------------------------------------------- 游戏配置（全部来自后端）

  /**
   * 先取各配置项的版本号，再只下载本地缓存里没有或版本变了的项。全部到齐后交给 App.Config.load。
   * 缓存只是为了省流量和加快启动；后台一发布，版本号变化，下次启动就会重新下载。
   */
  async function loadConfig() {
    const man = await publicRequest('/api/config', 'GET');
    if (!man || !man.ok) return false;
    const keys = Object.keys(man.versions);
    const all = {};
    const jobs = keys.map(async (key) => {
      const cached = App.Platform.loadStorage(KEY_CONFIG + key);
      if (cached && cached.v === man.versions[key] && cached.c) { all[key] = cached.c; return true; }
      const res = await publicRequest('/api/config/item?key=' + key, 'GET');
      if (!res || !res.ok) return false;
      all[key] = res.content;
      App.Platform.saveStorage(KEY_CONFIG + key, { v: res.version, c: res.content });
      return true;
    });
    const ok = (await Promise.all(jobs)).every(Boolean);
    if (!ok) return false;
    App.Config.load(all);
    return true;
  }

  // ---------------------------------------------------------------- 远程图片资源

  function absoluteBase(base) {
    return /^https?:\/\//.test(base) ? base : API_BASE + base;
  }

  async function loadAssets() {
    const cached = App.Platform.loadStorage(KEY_ASSETS);
    const q = cached && cached.version ? '?version=' + cached.version : '';
    const res = await publicRequest('/api/assets/manifest' + q, 'GET');
    if (!res || !res.ok) return false;
    const m = res.changed ? { version: res.version, base: res.base, assets: res.assets } : cached;
    if (res.changed) App.Platform.saveStorage(KEY_ASSETS, m);
    App.Assets.applyManifest(absoluteBase(m.base), m.assets);
    return true;
  }

  // ---------------------------------------------------------------- 活动 / 邮件 / 兑换码

  async function refreshActivities() {
    const res = await request('/api/activity/active', 'GET');
    if (!res || !res.ok) return;
    activities = res.activities || [];
    const boosts = { exp: 1, drop: 1, stamina: 1 };
    activities.forEach((a) => {
      const p = a.params || {};
      if (a.type === 'EXP_BOOST') boosts.exp = Math.max(boosts.exp, Number(p.multiplier) || 1);
      if (a.type === 'DROP_BOOST') boosts.drop = Math.max(boosts.drop, Number(p.multiplier) || 1);
      if (a.type === 'STAMINA_DISCOUNT') boosts.stamina = Math.min(boosts.stamina, Number(p.discount) || 1);
    });
    App.State.setBoosts(boosts);
  }

  async function refreshMails() {
    const res = await request('/api/mail/list', 'GET');
    if (res && res.ok) mails = res.mails || [];
    return mails;
  }

  function markMailRead(id) {
    const m = mails.find((x) => x.id === id);
    if (!m || m.status !== 0) return;
    m.status = 1;
    request('/api/mail/read', 'POST', { id });
  }

  async function claimMail(id) {
    const res = await App.State.act('/api/mail/claim', { id: id || null }, { silent: true });
    if (res.ok) await refreshMails();
    return res;
  }

  function redeemCode(code) {
    return App.State.act('/api/redeem', { code }, { silent: true });
  }

  async function fetchArenaMatches(refresh) {
    const res = await request('/api/arena/matches' + (refresh ? '?refresh=true' : ''), 'GET');
    return (res && res.ok && Array.isArray(res.matches)) ? res.matches : [];
  }

  // ---------------------------------------------------------------- 启动流程

  /** 启动：配置 → 图片清单 → 登录（拿到存档）。任何一步失败都不进入游戏，由加载界面提示重试 */
  async function boot() {
    if (!(await loadConfig())) { loginError = '无法获取游戏配置，请检查网络'; return false; }
    if (!(await loadAssets())) { loginError = '无法获取资源清单，请检查网络'; return false; }
    const ok = await ensureLogin();
    if (!ok) return false;
    refreshActivities();
    refreshMails();
    return true;
  }

  App.API = {
    API_BASE,
    isOnline: () => online,
    isLoggedIn: () => !!token,
    getLoginError: () => loginError,
    now: () => Date.now() + timeOffset,
    boot,
    post: (path, data) => request(path, 'POST', data || {}),
    get: (path) => request(path, 'GET'),
    fetchArenaMatches,
    refreshMails,
    refreshActivities,
    getMails: () => mails,
    getActivities: () => activities,
    hasUnclaimedMail: () => mails.some((m) => m.status === 0 || (m.status < 2 && m.attachments && m.attachments.length)),
    markMailRead,
    claimMail,
    redeemCode,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
