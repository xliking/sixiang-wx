(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 图片全部来自后端资源库（后台「资源管理」），小游戏包内不带任何图片。
   * 启动时拿到清单（key → 地址）：界面、背景、特效、战场单位、神兽、副本原画和名将立绘立即预加载，
   * 其余（上千张关卡守将、装备、道具图标）在第一次用到时再加载。新增图片请在后台上传，不要放进客户端。
   */
  const cache = {};
  const EAGER = { ui: 1, bg: 1, vfx: 1, sprites: 1, beasts: 1, dungeons: 1 };
  const MAX_CONCURRENT = 8;
  let activeDownloads = 0;
  const highQueue = [];
  const lowQueue = [];
  let loadedCount = 0;
  let totalCount = 0;
  let remoteBase = '';
  let remoteMap = {};
  let pruneTimer = null;

  function toCacheFileName(relUrl) {
    if (!relUrl) return '';
    const str = String(relUrl);
    const qIdx = str.indexOf('?');
    const pathPart = (qIdx >= 0 ? str.slice(0, qIdx) : str).replace(/^\/+/, '');
    const verMatch = /[?&]v=([a-zA-Z0-9_-]+)/.exec(str);
    const extIdx = pathPart.lastIndexOf('.');
    const stem = (extIdx >= 0 ? pathPart.slice(0, extIdx) : pathPart).replace(/[^a-zA-Z0-9_-]/g, '__');
    const ext = extIdx >= 0 ? pathPart.slice(extIdx) : '.png';
    return stem + (verMatch ? '_' + verMatch[1] : '') + ext;
  }

  function notifyAssetLoaded() {
    if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty();
  }

  function pumpDownloads() {
    while (activeDownloads < MAX_CONCURRENT) {
      const job = highQueue.shift() || lowQueue.shift();
      if (!job) break;
      if (job.entry.src !== job.url || job.started) continue;
      job.started = true;
      activeDownloads++;
      startDownloadJob(job);
    }
  }

  function startDownloadJob(job) {
    const { entry, url, cacheFile, done } = job;
    const finishSlot = () => {
      activeDownloads = Math.max(0, activeDownloads - 1);
      done();
      pumpDownloads();
    };
    const assignImg = (srcToLoad) => {
      const img = App.Platform.createImage();
      img.onload = () => {
        if (entry.src === url) {
          entry.img = img;
          entry.loaded = true;
          entry.failed = false;
          entry.pendingJob = null;
          notifyAssetLoaded();
        }
        finishSlot();
      };
      img.onerror = () => {
        if (srcToLoad !== url && entry.src === url) {
          // 本地缓存文件若损坏则自动回退远程地址
          const fallbackImg = App.Platform.createImage();
          fallbackImg.onload = () => {
            if (entry.src === url) {
              entry.img = fallbackImg;
              entry.loaded = true;
              entry.failed = false;
              entry.pendingJob = null;
              notifyAssetLoaded();
            }
            finishSlot();
          };
          fallbackImg.onerror = () => {
            if (entry.src === url && !entry.loaded) entry.failed = true;
            entry.pendingJob = null;
            finishSlot();
          };
          fallbackImg.src = url;
          return;
        }
        if (entry.src === url && !entry.loaded) entry.failed = true;
        entry.pendingJob = null;
        finishSlot();
      };
      img.src = srcToLoad;
    };

    if (App.Platform && App.Platform.cacheRemoteAsset && cacheFile) {
      App.Platform.cacheRemoteAsset(url, cacheFile).then(assignImg);
    } else {
      assignImg(url);
    }
  }

  function loadImage(key, eager, highPriority) {
    const rel = remoteMap[key];
    const url = rel ? remoteBase + rel : null;
    if (!url) return null;
    let entry = cache[key];
    if (entry && entry.src === url) {
      if (highPriority && entry.pendingJob && !entry.pendingJob.started && !entry.pendingJob.promoted) {
        entry.pendingJob.promoted = true;
        highQueue.push(entry.pendingJob);
        pumpDownloads();
      }
      return entry;
    }
    if (!entry) entry = cache[key] = { img: null, loaded: false, failed: false, src: '', pendingJob: null };
    entry.src = url;
    entry.failed = false;
    if (eager) totalCount++;
    let counted = !eager;
    const done = () => { if (!counted) { counted = true; loadedCount++; } };

    const cacheFile = toCacheFileName(rel);
    const localCachedPath = App.Platform && App.Platform.getCachedAssetPath ? App.Platform.getCachedAssetPath(cacheFile) : null;
    if (localCachedPath) {
      // 已命中微信本地持久化文件缓存：直接解码无需占用网络下载队列！
      const img = App.Platform.createImage();
      img.onload = () => {
        if (entry.src === url) {
          entry.img = img;
          entry.loaded = true;
          entry.failed = false;
          notifyAssetLoaded();
        }
        done();
      };
      img.onerror = () => {
        const job = { entry, url, cacheFile: '', done, started: false, promoted: true };
        entry.pendingJob = job;
        highQueue.push(job);
        pumpDownloads();
      };
      img.src = localCachedPath;
      return entry;
    }

    const job = { entry, url, cacheFile, done, started: false, promoted: !!highPriority };
    entry.pendingJob = job;
    if (highPriority) highQueue.push(job);
    else lowQueue.push(job);
    pumpDownloads();
    return entry;
  }

  /** 启动首帧优先从本地缓存清单预热首页四象神兽与大地图背景，让启动罗盘立绘秒出 */
  function primeBootVisuals() {
    if (!App.Platform || !App.Platform.loadStorage) return;
    const cached = App.Platform.loadStorage('sixiang_remote_assets');
    if (!cached || !cached.assets || !cached.base) return;
    const apiBase = (App.API && App.API.API_BASE) || 'http://localhost:3002';
    const base = /^https?:\/\//.test(cached.base) ? cached.base : (apiBase + cached.base);
    if (!remoteBase) remoteBase = base;
    if (!Object.keys(remoteMap).length) remoteMap = cached.assets;
    ['beast_qinglong', 'beast_zhuque', 'beast_baihu', 'beast_xuanwu', 'bg_map'].forEach((k) => {
      if (remoteMap[k]) loadImage(k, false, true);
    });
  }

  /** 应用后端下发的图片清单 */
  let warmupTimer = null;
  function applyManifest(base, map) {
    remoteBase = base || '';
    remoteMap = map || {};
    // 优先第一梯队加载四象圣兽立绘与主地图，确保首页星盘动画第一时间呈现神兽原画
    ['beast_qinglong', 'beast_zhuque', 'beast_baihu', 'beast_xuanwu', 'bg_map'].forEach((k) => {
      if (remoteMap[k]) loadImage(k, !cache[k], true);
    });
    const core = { eq_qinggang_sword: 1, eq_sixiang_seal: 1, eq_fangtian_halberd: 1 };
    (App.Config.CORE_GENERAL_IDS || []).forEach((id) => {
      core['general_' + id] = 1;
      const g = App.Config.GENERALS && App.Config.GENERALS[id];
      const bsKey = (g && g.battleSprite) || ('battle_gen_' + id);
      if (remoteMap[bsKey]) core[bsKey] = 1;
    });
    const deferredKeys = [];
    const validFiles = new Set();
    Object.keys(remoteMap).forEach((key) => {
      validFiles.add(toCacheFileName(remoteMap[key]));
      const category = String(remoteMap[key]).split('/')[0];
      if (EAGER[category] || core[key] || cache[key]) {
        loadImage(key, !cache[key], false);
      } else if (category === 'artifacts' || key === 'item_chest_bronze' || key === 'item_chest_silver' || key === 'item_chest_gold' || key === 'item_recruit_edict' || key === 'item_stamina_pill' || key === 'item_exp_scroll') {
        deferredKeys.push(key);
      }
    });
    if (warmupTimer) clearTimeout(warmupTimer);
    if (deferredKeys.length) {
      let idx = 0;
      const pump = () => {
        const end = Math.min(deferredKeys.length, idx + 8);
        for (; idx < end; idx++) loadImage(deferredKeys[idx], false, false);
        if (idx < deferredKeys.length) warmupTimer = setTimeout(pump, 120);
      };
      warmupTimer = setTimeout(pump, 600);
    }
    if (pruneTimer) clearTimeout(pruneTimer);
    if (App.Platform && App.Platform.pruneCachedAssets) {
      pruneTimer = setTimeout(() => App.Platform.pruneCachedAssets(validFiles), 5000);
    }
  }

  function get(key) {
    if (!key) return null;
    const e = loadImage(key, false, true);
    return e && e.loaded ? e.img : null;
  }

  function has(key) {
    if (!key) return false;
    const e = cache[key];
    return !!(e && e.loaded && e.img);
  }

  function isLoading(key) {
    if (!key) return false;
    const e = cache[key];
    return !!(e && !e.loaded && !e.failed);
  }

  function getProgress() {
    return totalCount === 0 ? 1 : loadedCount / totalCount;
  }

  App.Assets = { applyManifest, primeBootVisuals, get, has, isLoading, getProgress };
})(typeof globalThis !== 'undefined' ? globalThis : window);
