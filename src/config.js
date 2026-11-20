(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 游戏配置容器。客户端不内置任何数据：武将、装备、套装、道具、关卡、数值等全部在启动时从后端拉取
   * （api.js → App.Config.load），后台「数值配置」里新增 / 修改后，玩家下次启动即可看到。
   * 这里只有空容器和展示用的计算函数。容器对象始终是同一个引用，加载时就地填充。
   */
  const C = {
    PARAMS: {}, SHOP: {}, AD_REWARDS: {}, SPECIAL: {}, WAVES: {}, FORGE: {}, DEMONS: {}, TROOP_CAMP: {}, TOWER: {}, CHALLENGES: {}, MARKET: {},
    GENERALS: {}, BEASTS: {}, EQUIP_TEMPLATES: {}, EQUIP_SETS: {}, QUALITIES: {}, ITEMS: {}, FACTIONS: {},
    UNIT_TYPES: {}, RECRUIT_TIERS: {}, BIOMES: {}, CHAPTERS: {}, STAGES: {}, DUNGEONS: {},
    GENERAL_IDS: [], CORE_GENERAL_IDS: [], ALL_GENERAL_IDS: [], BEAST_IDS: [], EQUIP_IDS: [], EQUIP_SET_IDS: [], ITEM_IDS: [],
    FACTION_LIST: [], ITEM_CATEGORIES: [], EQUIP_SLOTS: [], BEAST_EQUIP_SLOTS: [], WHEEL_PRIZES: [], SHOP_SUPPLY: [],
    SIGN_REWARDS: [], DAILY_QUESTS: [], DISASTERS: [], TROOP_CARDS: [],
    TOTAL_STAGES: 0, TOTAL_CHAPTERS: 0, STAGES_PER_CHAPTER: 8,
    loaded: false,
  };

  function fillObj(target, source) {
    Object.keys(target).forEach((k) => { delete target[k]; });
    Object.assign(target, source || {});
  }

  function fillArr(target, source) {
    target.length = 0;
    (Array.isArray(source) ? source : []).forEach((x) => target.push(x));
  }

  /** 用后端下发的全部配置填充容器，并生成派生数据（id 列表、套装包含的部件等） */
  function load(cfg) {
    const meta = cfg.meta || {};
    fillObj(C.PARAMS, cfg.global);
    fillObj(C.SHOP, cfg.shop);
    fillObj(C.AD_REWARDS, cfg.adRewards);
    fillObj(C.WAVES, cfg.waves);
    fillObj(C.FORGE, cfg.forge);
    fillObj(C.TROOP_CAMP, cfg.troopCamp);
    fillObj(C.TOWER, cfg.tower);
    fillObj(C.CHALLENGES, cfg.challenges);
    fillObj(C.MARKET, cfg.market);
    fillObj(C.DEMONS, cfg.demonBosses);
    fillObj(C.GENERALS, Object.assign({}, cfg.generals, cfg.stageGenerals));
    fillObj(C.BEASTS, cfg.beasts);
    fillObj(C.EQUIP_TEMPLATES, cfg.equipments);
    fillObj(C.EQUIP_SETS, cfg.equipSets);
    fillObj(C.QUALITIES, cfg.qualities);
    fillObj(C.ITEMS, cfg.items);
    fillObj(C.FACTIONS, cfg.factions);
    fillObj(C.CHAPTERS, cfg.chapters);
    fillObj(C.STAGES, cfg.stages);
    fillObj(C.DUNGEONS, cfg.dungeons);
    fillObj(C.UNIT_TYPES, meta.unitTypes);
    fillObj(C.RECRUIT_TIERS, meta.recruitTiers);
    fillObj(C.BIOMES, meta.biomes);
    fillObj(C.SPECIAL, meta.specialIds);
    fillArr(C.ITEM_CATEGORIES, meta.itemCategories);
    fillArr(C.EQUIP_SLOTS, meta.equipSlots);
    fillArr(C.BEAST_EQUIP_SLOTS, meta.beastEquipSlots);
    fillArr(C.WHEEL_PRIZES, cfg.wheelPrizes);
    fillArr(C.SHOP_SUPPLY, cfg.shopSupply);
    fillArr(C.SIGN_REWARDS, cfg.signRewards);
    fillArr(C.DAILY_QUESTS, cfg.dailyQuests);
    fillArr(C.DISASTERS, cfg.disasters);
    fillArr(C.TROOP_CARDS, cfg.troopCards);

    fillArr(C.GENERAL_IDS, Object.keys(cfg.generals || {}));
    fillArr(C.CORE_GENERAL_IDS, C.GENERAL_IDS);
    fillArr(C.ALL_GENERAL_IDS, Object.keys(C.GENERALS));
    fillArr(C.BEAST_IDS, Object.keys(C.BEASTS));
    fillArr(C.EQUIP_IDS, Object.keys(C.EQUIP_TEMPLATES));
    fillArr(C.EQUIP_SET_IDS, Object.keys(C.EQUIP_SETS));
    fillArr(C.ITEM_IDS, Object.keys(C.ITEMS));
    fillArr(C.FACTION_LIST, Object.keys(C.FACTIONS).map((k) => C.FACTIONS[k]));

    // 图片 key 约定：武将 general_<id>，神兽 beast_<id>，装备 eq_<id>，道具 item_<id>（后台「资源管理」按此 key 上传）
    C.ALL_GENERAL_IDS.forEach((id) => { const g = C.GENERALS[id]; g.id = id; if (!g.imgKey) g.imgKey = 'general_' + id; });
    C.BEAST_IDS.forEach((id) => { C.BEASTS[id].id = id; });
    C.ITEM_IDS.forEach((id) => { const it = C.ITEMS[id]; it.id = id; if (!it.imgKey) it.imgKey = 'item_' + id; });
    C.EQUIP_SET_IDS.forEach((id) => { C.EQUIP_SETS[id].id = id; C.EQUIP_SETS[id].pieceIds = []; if (!C.EQUIP_SETS[id].bonuses) C.EQUIP_SETS[id].bonuses = []; });
    C.EQUIP_IDS.forEach((id) => {
      const e = C.EQUIP_TEMPLATES[id];
      e.id = id;
      if (!e.imgKey) e.imgKey = 'eq_' + id;
      const set = e.setId && C.EQUIP_SETS[e.setId];
      if (set) { set.pieceIds.push(id); e.setName = set.name; } else { delete e.setId; }
    });

    C.TOTAL_STAGES = Object.keys(C.STAGES).length;
    C.TOTAL_CHAPTERS = Object.keys(C.CHAPTERS).length;
    C.STAGES_PER_CHAPTER = C.TOTAL_CHAPTERS ? Math.max(1, Math.round(C.TOTAL_STAGES / C.TOTAL_CHAPTERS)) : 8;
    C.loaded = true;
  }

  // ---------------------------------------------------------------- 展示用计算（与服务端公式一致）

  function getEquipBonus(eq) {
    const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId];
    if (!tpl) return { atk: 0, hp: 0, def: 0, crit: 0 };
    const en = eq.enhance || 0;
    const mult = (1 + en * 0.14) * (1 + (eq.star || 0) * (C.FORGE.starStatMult || 0)) * (1 + (eq.advance || 0) * (C.FORGE.advanceStatMult || 0));
    return {
      atk: Math.round((tpl.atk || 0) * mult), hp: Math.round((tpl.hp || 0) * mult), def: Math.round((tpl.def || 0) * mult),
      crit: +((tpl.crit || 0) * (1 + en * 0.04)).toFixed(3),
    };
  }

  function getEquipSellPrice(eq) {
    const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId];
    if (!tpl) return 100;
    const q = C.QUALITIES[tpl.quality] || C.QUALITIES.blue || { baseSell: 180 };
    return q.baseSell + (eq.enhance || 0) * 60;
  }

  function computeSetBonus(eqList) {
    const counts = {};
    (eqList || []).forEach((eq) => {
      const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId || eq.id];
      if (tpl && tpl.setId) counts[tpl.setId] = (counts[tpl.setId] || 0) + 1;
    });
    let hpPct = 0, atkPct = 0, defPct = 0, crit = 0;
    const activeSets = [];
    Object.keys(counts).forEach((sid) => {
      const set = C.EQUIP_SETS[sid];
      if (!set) return;
      const unlocked = [];
      set.bonuses.forEach((b) => {
        if (counts[sid] >= b.count) {
          hpPct += b.hpPct || 0; atkPct += b.atkPct || 0; defPct += b.defPct || 0; crit += b.crit || 0;
          unlocked.push(b);
        }
      });
      activeSets.push({ setId: sid, name: set.name, quality: set.quality, count: counts[sid], total: set.pieceIds.length, unlocked });
    });
    activeSets.sort((a, b) => b.count - a.count);
    return { hpPct, atkPct, defPct, crit, activeSets };
  }

  // ---------------------------------------------------------------- 章节与关卡

  function getChapterMapTheme(ch) {
    const c = C.CHAPTERS[ch] || C.CHAPTERS[1] || {};
    return c.theme || { regionName: c.name || '', mapKey: 'bg_map', battleKey: 'bg_battle' };
  }

  function getChapterInfo(ch) {
    const n = Math.max(1, Math.min(C.TOTAL_CHAPTERS || 1, ch));
    const c = C.CHAPTERS[n] || {};
    return { id: n, name: c.name || ('第' + n + '章'), era: { name: c.era || '', biome: c.biome || 'plains' }, theme: getChapterMapTheme(n) };
  }

  function buildStage(order) {
    const st = C.STAGES[order];
    return st ? Object.assign({}, st, { mapTheme: getChapterMapTheme(st.chapter) }) : null;
  }

  function getChapterStages(ch) {
    return Object.keys(C.STAGES).map((k) => C.STAGES[k]).filter((s) => s.chapter === ch)
      .sort((a, b) => a.order - b.order).map((s) => buildStage(s.order));
  }

  function getBeastDungeons() {
    return Object.keys(C.DUNGEONS).map((k) => Object.assign({ id: k }, C.DUNGEONS[k])).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  App.Config = Object.assign(C, {
    load, getEquipBonus, getEquipSellPrice, computeSetBonus,
    getChapterMapTheme, getChapterInfo, buildStage, getChapterStages, getBeastDungeons,
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
