(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 图片资源加载器：优先使用后端资源库（后台「资源管理」），若某新增图标尚未同步至后端，
   * 自动无缝加载包内手绘高清图（assets/ui、assets/sprites、assets/dungeons），保证界面与战场零缺图！
   */
  const cache = {};
  const EAGER = { ui: 1, bg: 1, vfx: 1, sprites: 1, beasts: 1, dungeons: 1 };
  const LOCAL_ASSETS = {
    icon_forge: 'assets/ui/icon_forge.png',
    icon_camp: 'assets/ui/icon_camp.png',
    icon_market: 'assets/ui/icon_market.png',
    icon_mail: 'assets/ui/icon_mail.png',
    icon_challenge: 'assets/ui/icon_challenge.png',
    icon_tower: 'assets/ui/icon_tower.png',
    icon_demon: 'assets/ui/icon_demon.png',
    icon_chaos_altar: 'assets/ui/icon_chaos_altar.png',
    prop_treasure_cart: 'assets/sprites/prop_treasure_cart.png',
    prop_wooden_ox: 'assets/sprites/prop_wooden_ox.png',
    prop_command_tent: 'assets/sprites/prop_command_tent.png',
    prop_siege_ram: 'assets/sprites/prop_siege_ram.png',
    dungeon_tomb: 'assets/dungeons/dungeon_tomb.jpg',
    dungeon_defend: 'assets/dungeons/dungeon_defend.jpg',
    dungeon_pass: 'assets/dungeons/dungeon_pass.jpg',
    dungeon_escort: 'assets/dungeons/dungeon_escort.jpg',
    dungeon_chaos: 'assets/dungeons/dungeon_chaos.jpg',
    tower_pagoda: 'assets/dungeons/tower_pagoda.jpg',
  };

  let loadedCount = 0;
  let totalCount = 0;
  let remoteBase = '';
  let remoteMap = {};

  function loadImage(key, eager) {
    const remoteUrl = remoteMap[key] ? remoteBase + remoteMap[key] : null;
    const localUrl = LOCAL_ASSETS[key] || null;
    const primaryUrl = remoteUrl || localUrl;
    if (!primaryUrl) return null;

    let entry = cache[key];
    if (entry && entry.src === primaryUrl) return entry;
    if (!entry) entry = cache[key] = { img: null, loaded: false, src: '' };
    entry.src = primaryUrl;
    if (eager) totalCount++;
    let counted = !eager;
    const done = () => { if (!counted) { counted = true; loadedCount++; } };

    const tryLoad = (src, fallback) => {
      const img = App.Platform.createImage();
      img.onload = () => {
        if (entry.src === primaryUrl) { entry.img = img; entry.loaded = true; }
        done();
      };
      img.onerror = () => {
        if (fallback && fallback !== src) tryLoad(fallback, null);
        else done();
      };
      img.src = src;
    };

    tryLoad(primaryUrl, remoteUrl && localUrl ? localUrl : null);
    return entry;
  }

  /** 应用后端下发的图片清单，并预载新增的本地国风高清图标与副本原画 */
  function applyManifest(base, map) {
    remoteBase = base || '';
    remoteMap = map || {};
    const core = {};
    (App.Config.CORE_GENERAL_IDS || []).forEach((id) => { core['general_' + id] = 1; });
    Object.keys(remoteMap).forEach((key) => {
      const category = String(remoteMap[key]).split('/')[0];
      if (EAGER[category] || core[key] || cache[key]) loadImage(key, !cache[key]);
    });
    Object.keys(LOCAL_ASSETS).forEach((key) => {
      if (!cache[key]) loadImage(key, true);
    });
  }

  function get(key) {
    if (!key) return null;
    const e = cache[key] || loadImage(key, false);
    return e && e.loaded ? e.img : null;
  }

  function getProgress() {
    return totalCount === 0 ? 1 : loadedCount / totalCount;
  }

  App.Assets = { applyManifest, get, getProgress, LOCAL_ASSETS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
