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
  let subQuotas = { stamina: 0, boss_rank: 0 };
  let subTemplates = { stamina: '', boss_rank: '' };
  let feedbacks = [];

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

  /** 公开接口（登录 / 配置 / 资源清单），无需签名；GET 支持弱网自动重试 */
  async function publicRequest(path, method, data, retries) {
    const m = method || 'GET';
    const maxTry = m === 'GET' ? (retries != null ? retries : 2) : 0;
    for (let attempt = 0; attempt <= maxTry; attempt++) {
      const res = await rawRequest(path, m, data ? JSON.stringify(data) : '', { 'Content-Type': 'application/json' });
      if (res || attempt === maxTry) return res;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
    return null;
  }

  /** 需要登录的接口：自动签名；时钟漂移时先校准重试，令牌失效时自动重新登录并重试一次 */
  async function request(path, method, data, retryStage) {
    if (!token && !(await ensureLogin())) return null;
    const m = method || 'GET';
    const body = data ? JSON.stringify(data) : '';
    const clientTs = Date.now() + timeOffset;
    const ts = String(clientTs);
    const nonce = randomNonce();
    const payload = [m, path, ts, nonce, App.Crypto.sha256Hex(body)].join('\n');
    const res = await rawRequest(path, m, body, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      'X-Ts': ts,
      'X-Nonce': nonce,
      'X-Sign': App.Crypto.hmacSha256Hex(sessionKey, payload),
    });
    if (res && res.code === 401) {
      if (res.serverTime && !retryStage && Math.abs(clientTs - res.serverTime) > 120000) {
        timeOffset = res.serverTime - Date.now();
        return request(path, method, data, 'skew');
      }
      if (retryStage !== 'relogin') {
        if (res.serverTime) timeOffset = res.serverTime - Date.now();
        token = null;
        if (await ensureLogin()) return request(path, method, data, 'relogin');
        return null;
      }
    }
    online = !!res;
    if (res && App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty();
    return res;
  }

  // ---------------------------------------------------------------- 登录与存档

  function ensureLogin() {
    if (token) return Promise.resolve(true);
    if (!loginPromise) {
      loginPromise = doLogin(false).then((r) => { loginPromise = null; return r; });
    }
    return loginPromise;
  }

  async function doLogin(deferApply) {
    const clientUid = getOrCreateClientUid();
    let code = 'mock_' + clientUid;
    if (App.Platform.isWechat && typeof wx.login === 'function') {
      code = await new Promise((resolve) => {
        wx.login({ success: (r) => resolve(r.code || code), fail: () => resolve(code) });
      });
    }
    const res = await publicRequest('/api/auth/wx-login', 'POST', { code, clientUid }, 0);
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
    if (!deferApply) {
      App.State.applyServerSave(res.save, res.saveVersion);
      App.State.setProfile(res.profile);
    }
    return res;
  }

  // ---------------------------------------------------------------- 游戏配置（全部来自后端）

  function loadCachedCfg(key) {
    return App.Platform.loadLargeCache ? App.Platform.loadLargeCache(KEY_CONFIG + key) : App.Platform.loadStorage(KEY_CONFIG + key);
  }

  function saveCachedCfg(key, val) {
    if (App.Platform.saveLargeCache) App.Platform.saveLargeCache(KEY_CONFIG + key, val);
    else App.Platform.saveStorage(KEY_CONFIG + key, val);
  }

  /**
   * 先取各配置项的版本号：若缺失/更新超过 4 项则走 /api/config/bundle 单请求全量拉取，
   * 避免冷启动并发 35 个请求挤占微信连接池；配置缓存写入本地文件系统以规避单键 1MB 上限。
   */
  async function loadConfig() {
    const man = await publicRequest('/api/config', 'GET');
    if (!man || !man.ok) return false;
    const keys = Object.keys(man.versions);
    const all = {};
    const missing = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const cached = loadCachedCfg(key);
      if (cached && cached.v === man.versions[key] && cached.c !== undefined) {
        all[key] = cached.c;
      } else {
        missing.push(key);
      }
    }
    if (missing.length > 4) {
      const bundle = await publicRequest('/api/config/bundle', 'GET');
      if (bundle && bundle.ok && bundle.configs) {
        const bVers = bundle.versions || man.versions;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (bundle.configs[k] !== undefined) {
            all[k] = bundle.configs[k];
            if (missing.indexOf(k) >= 0) {
              saveCachedCfg(k, { v: bVers[k] || man.versions[k], c: bundle.configs[k] });
            }
          }
        }
        missing.length = 0;
        for (let i = 0; i < keys.length; i++) {
          if (all[keys[i]] === undefined) missing.push(keys[i]);
        }
      }
    }
    if (missing.length > 0) {
      const jobs = missing.map(async (key) => {
        const res = await publicRequest('/api/config/item?key=' + key, 'GET');
        if (!res || !res.ok) return false;
        all[key] = res.content;
        saveCachedCfg(key, { v: res.version, c: res.content });
        return true;
      });
      const ok = (await Promise.all(jobs)).every(Boolean);
      if (!ok) return false;
    }
    App.Config.load(all);
    return true;
  }

  // ---------------------------------------------------------------- 远程图片资源

  function absoluteBase(base) {
    return /^https?:\/\//.test(base) ? base : API_BASE + base;
  }

  async function fetchAssetsManifest() {
    const cached = App.Platform.loadStorage(KEY_ASSETS);
    const q = cached && cached.version ? '?version=' + cached.version : '';
    const res = await publicRequest('/api/assets/manifest' + q, 'GET');
    if (!res || !res.ok) return null;
    const m = res.changed ? { version: res.version, base: res.base, assets: res.assets } : cached;
    if (!m || !m.assets) return null;
    if (res.changed) App.Platform.saveStorage(KEY_ASSETS, m);
    return m;
  }

  async function loadAssets() {
    const m = await fetchAssetsManifest();
    if (!m) return false;
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

  async function refreshFeedbacks() {
    const res = await request('/api/feedback/list', 'GET');
    if (res && res.ok) feedbacks = res.list || [];
    return feedbacks;
  }

  async function submitFeedback(category, content, contact, clientInfo) {
    const res = await request('/api/feedback/submit', 'POST', {
      category: category || 'BUG',
      content: String(content || '').trim(),
      contact: contact ? String(contact).trim() : '',
      clientInfo: clientInfo ? String(clientInfo).trim() : '',
    });
    if (res && res.ok) await refreshFeedbacks();
    return res || { ok: false, msg: '网络异常，提交失败' };
  }

  /** 演武场：对手列表 + 我的名次信息（首次进入会入榜，所以同时返回最新存档） */
  async function fetchArena(refresh) {
    const res = await request('/api/arena/matches' + (refresh ? '?refresh=true' : ''), 'GET');
    if (res && res.ok && res.save) App.State.applyServerSave(res.save);
    return res;
  }

  /** 演武场：按玩家 ID 或主公名称搜索切磋对手 */
  async function searchArena(keyword) {
    return request('/api/arena/search?keyword=' + encodeURIComponent(String(keyword || '').trim()), 'GET');
  }

  // ---------------------------------------------------------------- 微信一次性订阅消息

  async function refreshSubscribe() {
    const res = await request('/api/subscribe/status', 'GET');
    if (res && res.ok) {
      if (res.quotas) Object.assign(subQuotas, res.quotas);
      if (res.templates) Object.assign(subTemplates, res.templates);
    }
    return res;
  }

  function resolveSubscribeTmplId(scene) {
    const sc = App.Config && App.Config.SUBSCRIBE ? App.Config.SUBSCRIBE : {};
    if (sc.enabled === false) return '';
    if (scene === 'stamina') {
      if (sc.staminaEnabled === false) return '';
      return String(subTemplates.stamina || sc.staminaTmplId || '').trim();
    }
    if (scene === 'boss_rank') {
      if (sc.bossRankEnabled === false) return '';
      return String(subTemplates.boss_rank || sc.bossRankTmplId || '').trim();
    }
    return '';
  }

  /** 在点击手势中同步拉起微信订阅授权，同意后上报服务端累加推送配额 */
  function subscribeNotice(scenesInput, opts) {
    const o = opts || {};
    const scenes = (Array.isArray(scenesInput) ? scenesInput : [scenesInput]).filter(Boolean);
    const pairs = scenes
      .map((s) => ({ scene: s, tmplId: resolveSubscribeTmplId(s) }))
      .filter((p) => !!p.tmplId);
    if (!pairs.length) {
      if (!o.silent && App.UI && App.UI.showToast) {
        App.UI.showToast('当前暂未开启订阅消息提醒', '#fbbf24');
      }
      return Promise.resolve({ ok: false });
    }
    return new Promise((resolve) => {
      App.Platform.requestSubscribe(pairs.map((p) => p.tmplId), async (r) => {
        if (!r || !r.ok || !r.accepted || !r.accepted.length) {
          if (!o.silent && App.UI && App.UI.showToast) {
            App.UI.showToast('未勾选允许通知，如需接收提醒请点击允许', '#fbbf24');
          }
          resolve({ ok: false, raw: r });
          return;
        }
        const acceptedSet = new Set(r.accepted);
        const acceptedScenes = pairs.filter((p) => acceptedSet.has(p.tmplId)).map((p) => p.scene);
        const rep = await request('/api/subscribe/report', 'POST', { scenes: acceptedScenes });
        if (rep && rep.ok) {
          if (rep.quotas) Object.assign(subQuotas, rep.quotas);
          if (rep.templates) Object.assign(subTemplates, rep.templates);
        }
        if (!o.silent && App.UI && App.UI.showToast) {
          if (acceptedScenes.indexOf('stamina') >= 0) {
            App.UI.showToast(`已订阅体力恢复提醒（待推送 ${subQuotas.stamina || 1} 次）！`, '#4ade80');
          } else if (acceptedScenes.indexOf('boss_rank') >= 0) {
            App.UI.showToast(`已订阅当日排名结算通知（待推送 ${subQuotas.boss_rank || 1} 次）！`, '#4ade80');
          }
        }
        if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty();
        resolve({ ok: true, quotas: Object.assign({}, subQuotas) });
      });
    });
  }

  // ---------------------------------------------------------------- 启动流程

  /** 启动：配置、资源清单、微信登录三路并行发起，按 Config -> Assets -> State 顺序安全落地 */
  async function boot() {
    const loginJob = token
      ? Promise.resolve({ alreadyLoggedIn: true })
      : (!loginPromise
        ? (loginPromise = doLogin(true).then((r) => { loginPromise = null; return r; }))
        : loginPromise);
    const [cfgOk, assetMan, loginRes] = await Promise.all([
      loadConfig(),
      fetchAssetsManifest(),
      loginJob,
    ]);
    if (!cfgOk) { loginError = '无法获取游戏配置，请检查网络'; return false; }
    if (!assetMan) { loginError = '无法获取资源清单，请检查网络'; return false; }
    App.Assets.applyManifest(absoluteBase(assetMan.base), assetMan.assets);
    if (!loginRes) return false;
    if (!loginRes.alreadyLoggedIn) {
      App.State.applyServerSave(loginRes.save, loginRes.saveVersion);
      App.State.setProfile(loginRes.profile);
    }
    refreshActivities();
    refreshMails();
    refreshSubscribe();
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
    fetchArena,
    searchArena,
    refreshMails,
    refreshActivities,
    refreshSubscribe,
    subscribeNotice,
    getSubscribeQuota: (scene) => (subQuotas && subQuotas[scene]) || 0,
    refreshFeedbacks,
    submitFeedback,
    getMails: () => mails,
    getActivities: () => activities,
    getFeedbacks: () => feedbacks,
    hasUnclaimedMail: () => mails.some((m) => m.status === 0 || (m.status < 2 && m.attachments && m.attachments.length)),
    markMailRead,
    claimMail,
    redeemCode,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
