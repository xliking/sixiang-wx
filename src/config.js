(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 游戏配置容器。客户端不内置任何数据：武将、装备、套装、道具、关卡、数值等全部在启动时从后端拉取
   * （api.js → App.Config.load），后台「数值配置」里新增 / 修改后，玩家下次启动即可看到。
   * 这里只有空容器和展示用的计算函数。容器对象始终是同一个引用，加载时就地填充。
   */
  const C = {
    PARAMS: {}, DIFFICULTY: {}, SHOP: {}, INGOT_SHOP: {}, AD_REWARDS: {}, SPECIAL: {}, WAVES: {}, FORGE: {}, ARTIFACTS: {}, DEMONS: {}, TROOP_CAMP: {}, TOWER: {}, CHALLENGES: {}, MARKET: {}, HIRE: {}, ASCENSION: {}, PATROL: {}, BONDS: {},
    FEATURES: {}, ARENA: {}, WORLD_BOSS: {}, GUILD: {}, INVITE: {}, SUBSCRIBE: {},
    GENERALS: {}, BEASTS: {}, EQUIP_TEMPLATES: {}, EQUIP_SETS: {}, QUALITIES: {}, ITEMS: {}, FACTIONS: {},
    UNIT_TYPES: {}, RECRUIT_TIERS: {}, BIOMES: {}, CHAPTERS: {}, STAGES: {}, DUNGEONS: {},
    GENERAL_IDS: [], CORE_GENERAL_IDS: [], ALL_GENERAL_IDS: [], BEAST_IDS: [], EQUIP_IDS: [], EQUIP_SET_IDS: [], ITEM_IDS: [], ARTIFACT_IDS: [],
    FACTION_LIST: [], ITEM_CATEGORIES: [], EQUIP_SLOTS: [], BEAST_EQUIP_SLOTS: [], WHEEL_PRIZES: [], SHOP_SUPPLY: [], INGOT_SHOP_SUPPLY: [],
    SIGN_REWARDS: [], DAILY_QUESTS: [], WEEKLY_QUESTS: [], QUEST_BOXES: [], ACHIEVEMENTS: [], DISASTERS: [], TROOP_CARDS: [],
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

  const CORE_GENERAL_TROOPS = {
    liubei: 'spear', zhugeliang: 'mage', guanyu: 'cavalry', zhaoyun: 'cavalry', zhangfei: 'pike',
    machao: 'cavalry', huangzhong: 'archer', pangtong: 'mage', huangyueying: 'archer',
    weiyan: 'spear', jiangwei: 'pike', fazheng: 'mage', guanping: 'spear', menghuo: 'spear', zhurong: 'archer',
    caocao: 'cavalry', simayi: 'mage', dianwei: 'spear', zhangliao: 'cavalry', xuhuang: 'spear',
    zhanghe: 'cavalry', yuejin: 'pike', yujin: 'spear', guojia: 'mage', zhenji: 'mage',
    xiahoudun: 'spear', xiahouyuan: 'archer', xuchu: 'pike', caoren: 'spear', jiaxu: 'mage',
    sunquan: 'pike', sunce: 'cavalry', zhouyu: 'mage', luxun: 'mage', lvmeng: 'pike',
    lusu: 'mage', ganning: 'pike', sunshangxiang: 'archer', taishici: 'archer', huanggai: 'spear',
    zhoutai: 'spear', daqiao: 'mage', xiaoqiao: 'mage',
    lvbu: 'cavalry', diaochan: 'archer', yuanshao: 'archer', yanliang: 'cavalry', wenchou: 'cavalry',
    gongsunzan: 'cavalry', gaoshun: 'spear', dongzhuo: 'spear', huaxiong: 'pike', huatuo: 'mage', zhangjiao: 'mage',
  };

  const TROOP_BADGE_META = {
    spear: { id: 'spear', name: '刀盾步兵', short: '盾', color: '#fbbf24', bg: '#78350f' },
    pike: { id: 'pike', name: '精锐枪兵', short: '枪', color: '#fb923c', bg: '#7c2d12' },
    archer: { id: 'archer', name: '神射弓兵', short: '弓', color: '#4ade80', bg: '#14532d' },
    cavalry: { id: 'cavalry', name: '铁甲骑兵', short: '骑', color: '#38bdf8', bg: '#0c4a6e' },
    mage: { id: 'mage', name: '玄术方士', short: '术', color: '#c084fc', bg: '#581c87' },
  };

  function inferGeneralTroopId(g) {
    if (!g) return 'spear';
    if (g.troopId && TROOP_BADGE_META[g.troopId]) return g.troopId;
    if (CORE_GENERAL_TROOPS[g.id]) return CORE_GENERAL_TROOPS[g.id];
    const order = Number(g.stageOrder) || 1;
    const subToggle = (Math.floor(order / 3) % 2) === 1;
    if (g.type === 'cavalry') return 'cavalry';
    if (g.type === 'archer') return subToggle ? 'archer' : 'mage';
    return subToggle ? 'spear' : 'pike';
  }

  function getTroopCard(troopId) {
    return (C.TROOP_CARDS || []).find((c) => c.id === troopId) || null;
  }

  function getTroopMeta(troopId) {
    const base = TROOP_BADGE_META[troopId] || TROOP_BADGE_META.spear;
    const card = getTroopCard(troopId);
    return card ? Object.assign({}, base, { name: card.name }) : base;
  }

  function getGeneralTroopId(gid) {
    return inferGeneralTroopId(C.GENERALS[gid]);
  }

  function getGeneralTroopCard(gid) {
    return getTroopCard(getGeneralTroopId(gid));
  }

  function getGeneralTroopMeta(gid) {
    return getTroopMeta(getGeneralTroopId(gid));
  }

  /**
   * 统一解析武将沙场独立人物贴图（800将各配独立 battle_gen_<id> 对战形象，后台可配！）、手持兵刃类型与动作流派
   * 返回：{ spriteKey, fallbackSpriteKey, battleSpec, scale, atkStyle, weaponKind, isMagic, isRanged }
   */
  function styleFromWeaponKind(wk) {
    if (wk === 'fan' || wk === 'staff') return 'fan';
    if (wk === 'bow' || wk === 'crossbow') return 'bow';
    if (wk === 'sword') return 'sword';
    if (wk === 'guandao' || wk === 'halberd' || wk === 'axe') return 'cleave';
    return 'thrust';
  }

  function inferEquippedWeaponProfile(wTpl) {
    if (!wTpl) return null;
    if (wTpl.weaponKind && wTpl.weaponKind !== 'auto') {
      const wk = wTpl.weaponKind;
      const st = styleFromWeaponKind(wk);
      return { atkStyle: st, weaponKind: wk, isMagic: st === 'fan', isRanged: st === 'fan' || st === 'bow' };
    }
    const wName = String(wTpl.name || '');
    const wid = String(wTpl.id || '');
    if (/弩/.test(wName) || /(?:^|_)crossbow(?:_|$)/.test(wid)) {
      return { atkStyle: 'bow', weaponKind: 'crossbow', isMagic: false, isRanged: true };
    }
    if (/弓/.test(wName) || /(?:^|_)bow(?:_|$)/.test(wid)) {
      return { atkStyle: 'bow', weaponKind: 'bow', isMagic: false, isRanged: true };
    }
    if (/[杖杵幡]/.test(wName) || /(?:^|_)staff(?:_|$)/.test(wid)) {
      return { atkStyle: 'fan', weaponKind: 'staff', isMagic: true, isRanged: true };
    }
    if (/剑|双环/.test(wName) || /(?:^|_)sword(?:_|$)/.test(wid)) {
      return { atkStyle: 'sword', weaponKind: 'sword', isMagic: false, isRanged: false };
    }
    if (/戟/.test(wName) || /(?:^|_)halberd(?:_|$)/.test(wid)) {
      return { atkStyle: 'cleave', weaponKind: 'halberd', isMagic: false, isRanged: false };
    }
    if (/[斧锤鎚钺锚]/.test(wName) || /(?:^|_)axe(?:_|$)/.test(wid)) {
      return { atkStyle: 'cleave', weaponKind: 'axe', isMagic: false, isRanged: false };
    }
    if (/[刀刃斩]/.test(wName) || /(?:^|_)blade(?:_|$)/.test(wid)) {
      return { atkStyle: 'cleave', weaponKind: 'guandao', isMagic: false, isRanged: false };
    }
    if (/[枪矛槊铍刺铩]/.test(wName) || /(?:^|_)spear(?:_|$)/.test(wid)) {
      return { atkStyle: 'thrust', weaponKind: 'spear', isMagic: false, isRanged: false };
    }
    if (/[扇匣带]/.test(wName) || /(?:^|_)fan(?:_|$)/.test(wid)) {
      return { atkStyle: 'fan', weaponKind: 'fan', isMagic: true, isRanged: true };
    }
    return null;
  }

  function resolveGeneralCombatProfile(gidOrCfg, weaponEqOrTpl) {
    const g = typeof gidOrCfg === 'string' ? C.GENERALS[gidOrCfg] : gidOrCfg;
    if (!g) {
      return { spriteKey: 'unit_gen_silver', fallbackSpriteKey: 'unit_gen_silver', battleSpec: null, scale: 1, atkStyle: 'thrust', weaponKind: 'spear', isMagic: false, isRanged: false };
    }
    const gid = g.id || '';
    const troopId = inferGeneralTroopId(g);
    const isFemale = g.gender === 'female';
    const sName = String(g.skillName || '');
    const sType = String(g.skillType || '');
    const bSpec = g.battleSpec || null;
    const innateW = g.innateWeapon || null;
    const customSpriteKey = (bSpec && bSpec.battleSprite) || g.battleSprite || (gid ? ('battle_gen_' + gid) : '');
    const cfgWeaponKind = (bSpec && bSpec.weaponKind && bSpec.weaponKind !== 'auto')
      ? bSpec.weaponKind
      : ((innateW && innateW.weaponKind) ? innateW.weaponKind : '');
    const unitScale = Number((bSpec && bSpec.scale) || g.scale || 1) || 1;

    const wTpl = weaponEqOrTpl
      ? (weaponEqOrTpl.slot ? weaponEqOrTpl : C.EQUIP_TEMPLATES[weaponEqOrTpl.tplId || weaponEqOrTpl.id])
      : null;
    const wName = wTpl ? String(wTpl.name || '') : '';
    const heavyIds = [
      'lvbu', 'guanyu', 'zhangfei', 'dianwei', 'xuchu', 'huaxiong', 'dongzhuo', 'xiahoudun',
      'weiyan', 'menghuo', 'xuhuang', 'caoren', 'huanggai', 'zhoutai', 'yanliang', 'wenchou', 'gaoshun',
    ];
    const defaultFb = isFemale
      ? 'unit_gen_female'
      : ((troopId === 'mage' || g.type === 'mage') ? 'unit_gen_mage' : (heavyIds.includes(gid) ? 'unit_gen_heavy' : 'unit_gen_silver'));

    // ★ 只要武将穿戴了神兵，对战与演武中一律真实展示所穿戴的武器形制与对应招式！
    const equippedProf = inferEquippedWeaponProfile(wTpl);
    if (equippedProf) {
      return {
        spriteKey: customSpriteKey || defaultFb,
        fallbackSpriteKey: defaultFb,
        battleSpec: bSpec,
        innateWeapon: innateW,
        scale: unitScale,
        atkStyle: equippedProf.atkStyle,
        weaponKind: equippedProf.weaponKind,
        isMagic: equippedProf.isMagic,
        isRanged: equippedProf.isRanged,
      };
    }

    const wrap = (fallbackKey, atkStyle, weaponKind, isMagic, isRanged) => {
      const finalWk = (!wName && cfgWeaponKind) ? cfgWeaponKind : weaponKind;
      const finalStyle = (!wName && cfgWeaponKind) ? styleFromWeaponKind(cfgWeaponKind) : atkStyle;
      const finalMagic = (finalStyle === 'fan' || troopId === 'mage') ? true : isMagic;
      const finalRanged = (finalStyle === 'fan' || finalStyle === 'bow' || g.type === 'archer') ? true : isRanged;
      return {
        spriteKey: customSpriteKey || fallbackKey,
        fallbackSpriteKey: fallbackKey,
        battleSpec: bSpec,
        innateWeapon: innateW,
        scale: unitScale,
        atkStyle: finalStyle,
        weaponKind: finalWk,
        isMagic: finalMagic,
        isRanged: finalRanged,
      };
    };

    // 1. 玄术谋士 / 奇门方士 / 倾城舞姬（默认执鹤氅羽扇或九节法杖）
    if (troopId === 'mage' || g.type === 'mage' || gid === 'diaochan') {
      const useStaff = gid === 'zhangjiao';
      return wrap(isFemale ? 'unit_gen_female' : 'unit_gen_mage', 'fan', useStaff ? 'staff' : 'fan', true, true);
    }

    // 2. 神射弓箭武将（默认执雕翎战弓弯弓搭箭）
    if (troopId === 'archer' || g.type === 'archer' || sType === 'precision_mercy' || ['huangzhong', 'taishici', 'sunshangxiang', 'huangyueying'].includes(gid)) {
      const fb = isFemale ? 'unit_gen_female' : (gid === 'huangzhong' ? 'unit_gen_heavy' : 'unit_gen_silver');
      return wrap(fb, 'bow', 'bow', false, true);
    }

    // 3. 帝王统帅 / 佩剑名将（倚天剑、双股剑、白虹剑等）
    const isInnateSword = ['caocao', 'liubei', 'sunquan'].includes(gid)
      || /剑/.test(sName)
      || (troopId === 'spear' && !/[刀戟斧锤枪矛]/.test(sName) && ((Number(g.stageOrder) || 1) % 3 === 0));
    if (isInnateSword) {
      const fb = isFemale ? 'unit_gen_female' : (gid === 'caocao' ? 'unit_gen_heavy' : 'unit_gen_silver');
      return wrap(fb, 'sword', 'sword', false, false);
    }

    // 4. 重兵刀戟 / 开山战斧猛将（青龙偃月刀、方天画戟、双铁戟、开山大斧）
    const heavyHeroMap = {
      lvbu: 'halberd',
      dianwei: 'halberd',
      guanyu: 'guandao',
      xiahoudun: 'guandao',
      dongzhuo: 'guandao',
      huaxiong: 'guandao',
      ganning: 'guandao',
      xuchu: 'axe',
      huanggai: 'axe',
    };
    let innateHeavy = heavyHeroMap[gid] || null;
    if (!innateHeavy) {
      if (/戟/.test(sName)) innateHeavy = 'halberd';
      else if (/[斧锤岳震]/.test(sName) || sType === 'stun_single') innateHeavy = 'axe';
      else if (/[刀斩狂]/.test(sName) || sType === 'heavy_cleave' || sType === 'lifesteal_cleave' || (troopId === 'spear' && gid !== 'zhangfei')) {
        innateHeavy = 'guandao';
      }
    }
    if (innateHeavy) {
      return wrap(isFemale ? 'unit_gen_female' : 'unit_gen_heavy', 'cleave', innateHeavy, false, false);
    }

    // 5. 白马银枪 / 铁骑骁将（龙胆亮银枪、虎头湛金枪、丈八蛇矛等）
    return wrap(isFemale ? 'unit_gen_female' : (gid === 'zhangfei' ? 'unit_gen_heavy' : 'unit_gen_silver'), 'thrust', 'spear', false, false);
  }

  /** 用后端下发的全部配置填充容器，并生成派生数据（id 列表、套装包含的部件等） */
  function load(cfg) {
    const meta = cfg.meta || {};
    fillObj(C.PARAMS, cfg.global);
    fillObj(C.DIFFICULTY, cfg.difficulty);
    fillObj(C.SHOP, cfg.shop);
    fillObj(C.INGOT_SHOP, cfg.ingotShop);
    fillObj(C.AD_REWARDS, cfg.adRewards);
    fillObj(C.WAVES, cfg.waves);
    fillObj(C.FORGE, cfg.forge);
    fillObj(C.ARTIFACTS, cfg.artifacts);
    fillObj(C.TROOP_CAMP, cfg.troopCamp);
    fillObj(C.TOWER, cfg.tower);
    fillObj(C.CHALLENGES, cfg.challenges);
    fillObj(C.PATROL, cfg.patrol);
    fillObj(C.BONDS, cfg.bonds);
    fillObj(C.MARKET, cfg.market);
    fillObj(C.HIRE, cfg.hire);
    fillObj(C.ASCENSION, cfg.ascension);
    fillObj(C.FEATURES, cfg.features);
    fillObj(C.ARENA, cfg.arena);
    fillObj(C.WORLD_BOSS, cfg.worldBoss);
    fillObj(C.GUILD, cfg.guild);
    fillObj(C.INVITE, cfg.invite);
    fillObj(C.SUBSCRIBE, cfg.subscribe);
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
    fillArr(C.INGOT_SHOP_SUPPLY, cfg.ingotShopSupply);
    fillArr(C.SIGN_REWARDS, cfg.signRewards);
    fillArr(C.DAILY_QUESTS, cfg.dailyQuests);
    fillArr(C.WEEKLY_QUESTS, cfg.weeklyQuests);
    fillArr(C.QUEST_BOXES, cfg.questBoxes);
    fillArr(C.ACHIEVEMENTS, cfg.achievements);
    fillArr(C.DISASTERS, cfg.disasters);
    fillArr(C.TROOP_CARDS, cfg.troopCards);

    fillArr(C.GENERAL_IDS, Object.keys(cfg.generals || {}));
    fillArr(C.CORE_GENERAL_IDS, C.GENERAL_IDS);
    fillArr(C.ALL_GENERAL_IDS, Object.keys(C.GENERALS));
    fillArr(C.BEAST_IDS, Object.keys(C.BEASTS).sort((a, b) => getBeastUnlockLv(a) - getBeastUnlockLv(b)));
    fillArr(C.EQUIP_IDS, Object.keys(C.EQUIP_TEMPLATES));
    fillArr(C.EQUIP_SET_IDS, Object.keys(C.EQUIP_SETS));
    fillArr(C.ITEM_IDS, Object.keys(C.ITEMS));
    fillArr(C.ARTIFACT_IDS, Object.keys(C.ARTIFACTS).sort((a, b) => (C.ARTIFACTS[a].order || 0) - (C.ARTIFACTS[b].order || 0)));
    fillArr(C.FACTION_LIST, Object.keys(C.FACTIONS).map((k) => C.FACTIONS[k]));

    // 图片 key 约定：武将立绘 general_<id>，武将对战形象 battle_gen_<id>，神兽 beast_<id>，装备 eq_<id>，道具 item_<id>
    C.ALL_GENERAL_IDS.forEach((id) => {
      const g = C.GENERALS[id];
      g.id = id;
      if (!g.imgKey) g.imgKey = 'general_' + id;
      if (!g.battleSprite) g.battleSprite = (g.battleSpec && g.battleSpec.battleSprite) || ('battle_gen_' + id);
      g.troopId = inferGeneralTroopId(g);
    });
    C.BEAST_IDS.forEach((id) => { C.BEASTS[id].id = id; });
    C.ITEM_IDS.forEach((id) => { const it = C.ITEMS[id]; it.id = id; if (!it.imgKey) it.imgKey = 'item_' + id; });
    C.ARTIFACT_IDS.forEach((id) => { const a = C.ARTIFACTS[id]; a.id = id; if (!a.imgKey) a.imgKey = 'art_' + id; });
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
    if (!tpl) return { atk: 0, hp: 0, def: 0, crit: 0, critDmg: 0, lifesteal: 0, dmgReduce: 0, skillDmgPct: 0, spdPct: 0, initRage: 0 };
    const en = eq.enhance || 0;
    const mult = (1 + en * 0.14) * (1 + (eq.star || 0) * (C.FORGE.starStatMult || 0)) * (1 + (eq.advance || 0) * (C.FORGE.advanceStatMult || 0));
    let atk = Math.round((tpl.atk || 0) * mult);
    let hp = Math.round((tpl.hp || 0) * mult);
    let def = Math.round((tpl.def || 0) * mult);
    let crit = (tpl.crit || 0) * (1 + en * 0.04);
    let critDmg = tpl.critDmg || 0;
    let lifesteal = tpl.lifesteal || 0;
    let dmgReduce = tpl.dmgReduce || 0;
    let skillDmgPct = tpl.skillDmgPct || 0;
    let spdPct = tpl.spdPct || 0;
    let initRage = tpl.initRage || 0;
    (eq.affixes || []).forEach((af) => {
      if (!af) return;
      const v = Number(af.val) || 0;
      if (af.type === 'atk' || af.type === 'valor') atk += Math.round(v);
      else if (af.type === 'hp' || af.type === 'vitality') hp += Math.round(v);
      else if (af.type === 'def') def += Math.round(v);
      else if (af.type === 'crit') crit += v;
      else if (af.type === 'critDmg') critDmg += v;
      else if (af.type === 'lifesteal') lifesteal += v;
      else if (af.type === 'dmgReduce') dmgReduce += v;
      else if (af.type === 'skillDmg') skillDmgPct += v;
    });
    return {
      atk, hp, def, crit: +crit.toFixed(3),
      critDmg: +critDmg.toFixed(3), lifesteal: +lifesteal.toFixed(3), dmgReduce: +dmgReduce.toFixed(3),
      skillDmgPct: +skillDmgPct.toFixed(3), spdPct: +spdPct.toFixed(3), initRage: Math.round(initRage),
    };
  }

  function computeArtifactBonus(ownedMap, activeId) {
    let hp = 0, atk = 0, def = 0, crit = 0, count = 0;
    let critDmg = 0, lifesteal = 0, dmgReduce = 0, skillDmgPct = 0, spdPct = 0, activeRage = 0;
    const activeMult = (C.FORGE && C.FORGE.artifactActiveMult) || 1.5;
    const auraStep = (C.FORGE && C.FORGE.artifactUpgradeAuraStep != null) ? C.FORGE.artifactUpgradeAuraStep : 0.03;
    Object.keys(ownedMap || {}).forEach((aid) => {
      const a = C.ARTIFACTS[aid];
      const lv = Number(ownedMap[aid]) || 0;
      if (!a || lv <= 0) return;
      count += 1;
      const isAct = aid === activeId;
      const m = isAct ? activeMult : 1;
      const auraLvMult = 1 + Math.max(0, lv - 1) * auraStep;
      hp += Math.round(((a.hp || 0) + (lv - 1) * (a.hpStep || 0)) * m);
      atk += Math.round(((a.atk || 0) + (lv - 1) * (a.atkStep || 0)) * m);
      def += Math.round(((a.def || 0) + (lv - 1) * (a.defStep || 0)) * m);
      crit += (a.crit || 0) * auraLvMult * m;
      if (isAct) {
        critDmg += (a.activeCritDmg || 0) * auraLvMult;
        lifesteal += (a.activeLifesteal || 0) * auraLvMult;
        dmgReduce += (a.activeDmgReduce || 0) * auraLvMult;
        skillDmgPct += (a.activeSkillPct || 0) * auraLvMult;
        spdPct += (a.activeSpdPct || 0) * auraLvMult;
        activeRage += a.activeRage != null ? a.activeRage : ((C.FORGE && C.FORGE.artifactActiveRage) || 10);
      }
    });
    return {
      hp, atk, def, crit: +crit.toFixed(3), count, activeRage,
      critDmg: +critDmg.toFixed(3), lifesteal: +lifesteal.toFixed(3), dmgReduce: +dmgReduce.toFixed(3),
      skillDmgPct: +skillDmgPct.toFixed(3), spdPct: +spdPct.toFixed(3),
    };
  }

  function getArtifactMaterialProgress(itemsMap, art) {
    const mats = (art && Array.isArray(art.materials)) ? art.materials : [];
    let readyCount = 0;
    const list = mats.map((m) => {
      const have = Number((itemsMap || {})[m.id]) || 0;
      const need = Math.max(1, Number(m.count) || 1);
      const enough = have >= need;
      if (enough) readyCount++;
      return { id: m.id, have, need, enough, item: C.ITEMS[m.id] || null };
    });
    return { list, readyCount, totalKinds: list.length, allEnough: list.length === 0 || readyCount >= list.length };
  }

  function canUnlockArtifact(st, art) {
    if (!st || !art) return false;
    if (((st.ownedArtifacts || {})[art.id] || 0) > 0) return false;
    if ((st.gold || 0) < (art.unlockGold || 0)) return false;
    if ((st.soul || 0) < (art.unlockSoul || 0)) return false;
    return getArtifactMaterialProgress(st.items, art).allEnough;
  }

  function getEquipSellPrice(eq) {
    const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId];
    if (!tpl) return 100;
    const q = C.QUALITIES[tpl.quality] || C.QUALITIES.blue || { baseSell: 180 };
    return q.baseSell + (eq.enhance || 0) * 60;
  }

  const SET_AURA_META = {
    none:              { name: '基础军备', color: '#38bdf8', subColor: '#bae6fd', tex: 'vfx_silver_spear' },
    dragon_thunder:    { name: '苍龙惊雷阵', color: '#38bdf8', subColor: '#6ee7b7', tex: 'vfx_thunder' },
    phoenix_flame:     { name: '朱雀离火阵', color: '#fb923c', subColor: '#fde047', tex: 'vfx_fire' },
    frost_tide:        { name: '玄冥寒霜阵', color: '#67e8f9', subColor: '#e0f2fe', tex: 'vfx_ice' },
    crimson_slaughter: { name: '无双杀神阵', color: '#f87171', subColor: '#fbbf24', tex: 'vfx_crimson_slash' },
    golden_emperor:    { name: '天子紫微阵', color: '#facc15', subColor: '#fef08a', tex: 'vfx_dragon_slash' },
    jade_vitality:     { name: '青囊生机阵', color: '#4ade80', subColor: '#ccfbf1', tex: 'vfx_holy_heal' },
    shadow_phantom:    { name: '九幽诡谋阵', color: '#c084fc', subColor: '#f5d0fe', tex: 'vfx_meteor_starfall' },
  };

  const WEAPON_ATK_META = {
    none:            { name: '寒铁兵锋', color: '#fef08a', coreColor: '#ffffff', tex1: 'vfx_silver_spear', tex2: 'vfx_dragon_slash' },
    flame_slash:     { name: '烈焰焚天斩', color: '#fb923c', coreColor: '#fef08a', tex1: 'vfx_fire', tex2: 'vfx_crimson_slash' },
    thunder_arc:     { name: '奔雷裂空击', color: '#38bdf8', coreColor: '#e0f2fe', tex1: 'vfx_thunder', tex2: 'vfx_dragon_slash' },
    frost_shatter:   { name: '寒霜碎冰斩', color: '#67e8f9', coreColor: '#ffffff', tex1: 'vfx_ice', tex2: 'vfx_water_tsunami' },
    dragon_gold:     { name: '真龙金罡破', color: '#facc15', coreColor: '#fef9c3', tex1: 'vfx_dragon_slash', tex2: 'vfx_silver_spear' },
    blood_crescent:  { name: '泣血修罗斩', color: '#ef4444', coreColor: '#fde047', tex1: 'vfx_crimson_slash', tex2: 'vfx_tiger_roar' },
    starfall_arcane: { name: '星陨天机芒', color: '#c084fc', coreColor: '#fae8ff', tex1: 'vfx_meteor_starfall', tex2: 'vfx_thunder' },
    jade_wind:       { name: '翠岚疾风刃', color: '#34d399', coreColor: '#d1fae5', tex1: 'vfx_blossom_dance', tex2: 'vfx_dragon_slash' },
  };

  function resolveSetAuraKey(set) {
    if (!set) return 'none';
    if (set.auraVfx && SET_AURA_META[set.auraVfx]) return set.auraVfx;
    return set.quality === 'blue' ? 'none' : 'golden_emperor';
  }

  function resolveWeaponVfx(eqOrTpl) {
    if (!eqOrTpl) return null;
    const isTpl = !eqOrTpl.tplId && !!eqOrTpl.slot;
    const tpl = isTpl ? eqOrTpl : C.EQUIP_TEMPLATES[eqOrTpl.tplId];
    if (!tpl || (tpl.slot !== 'weapon' && tpl.slot !== 'beast_claw')) return null;
    const en = isTpl ? 0 : (eqOrTpl.enhance || 0);
    const star = isTpl ? 0 : (eqOrTpl.star || 0);
    const adv = isTpl ? 0 : (eqOrTpl.advance || 0);

    let key = (tpl.atkVfx && WEAPON_ATK_META[tpl.atkVfx]) ? tpl.atkVfx : 'none';
    if (key === 'none') {
      if (tpl.quality === 'gold' || tpl.quality === 'purple') key = 'dragon_gold';
      else if (en >= 8 || star >= 2 || adv >= 1) key = 'dragon_gold';
    }
    if (key === 'none') return null;
    const meta = WEAPON_ATK_META[key] || WEAPON_ATK_META.dragon_gold;
    const qTier = tpl.quality === 'gold' ? 3 : (tpl.quality === 'purple' ? 2 : 1);
    const growthBoost = (en >= 10 ? 0.18 : en * 0.015) + star * 0.07 + adv * 0.10;
    return {
      active: true,
      atkVfx: key,
      atkName: meta.name,
      color: tpl.glowColor || tpl.clawColor || meta.color,
      bladeColor: tpl.bladeColor || meta.coreColor,
      coreColor: meta.coreColor,
      tex1: meta.tex1,
      tex2: meta.tex2,
      quality: tpl.quality,
      isSolo: !tpl.setId,
      tier: qTier,
      scaleMult: (qTier === 3 ? 1.24 : (qTier === 2 ? 1.08 : 0.94)) + Math.min(0.32, growthBoost),
      enhance: en,
      star,
      advance: adv,
      name: tpl.name,
    };
  }

  function computeSetBonus(eqList, ascendPath) {
    const counts = {};
    (eqList || []).forEach((eq) => {
      const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId || eq.id];
      if (tpl && tpl.setId) counts[tpl.setId] = (counts[tpl.setId] || 0) + 1;
    });
    let hpPct = 0, atkPct = 0, defPct = 0, crit = 0;
    let critDmg = 0, lifesteal = 0, dmgReduce = 0, skillDmgPct = 0, spdPct = 0, initRage = 0;
    const activeSets = [];
    Object.keys(counts).forEach((sid) => {
      const set = C.EQUIP_SETS[sid];
      if (!set) return;
      const unlocked = [];
      set.bonuses.forEach((b) => {
        if (counts[sid] >= b.count) {
          hpPct += b.hpPct || 0; atkPct += b.atkPct || 0; defPct += b.defPct || 0; crit += b.crit || 0;
          critDmg += b.critDmg || 0; lifesteal += b.lifesteal || 0; dmgReduce += b.dmgReduce || 0;
          skillDmgPct += b.skillDmgPct || 0; spdPct += b.spdPct || 0; initRage += b.initRage || 0;
          unlocked.push(b);
        }
      });
      const auraKey = resolveSetAuraKey(set);
      const auraMeta = SET_AURA_META[auraKey] || SET_AURA_META.none;
      const total = set.pieceIds.length || (set.isBeastSet ? 4 : 6);
      const cnt = counts[sid];
      let resonanceActive = false;
      const resPct = set.resonancePct || 0.12;
      if (set.ascendAffinity && ascendPath && set.ascendAffinity === ascendPath && cnt >= total) {
        hpPct += resPct;
        atkPct += resPct;
        defPct += resPct;
        resonanceActive = true;
      }
      const vfxTier = auraKey === 'none'
        ? (cnt >= total ? 1 : 0)
        : (cnt >= total ? 3 : (cnt >= 4 ? 2 : (cnt >= 2 ? 1 : 0)));
      activeSets.push({
        setId: sid,
        name: set.name,
        quality: set.quality,
        count: cnt,
        total,
        unlocked,
        ascendAffinity: set.ascendAffinity || '',
        resonancePct: resPct,
        resonanceActive,
        auraVfx: auraKey,
        auraName: auraMeta.name,
        auraColor: set.auraColor || auraMeta.color,
        auraSubColor: auraMeta.subColor,
        auraTex: auraMeta.tex,
        vfxTier,
      });
    });
    activeSets.sort((a, b) => (b.vfxTier - a.vfxTier) || (b.count - a.count));
    return { hpPct, atkPct, defPct, crit, critDmg, lifesteal, dmgReduce, skillDmgPct, spdPct, initRage, activeSets };
  }

  function resolveSetVfx(eqList) {
    const sb = computeSetBonus(eqList);
    const top = sb.activeSets && sb.activeSets.find((s) => s.unlocked && s.unlocked.length > 0 && s.vfxTier > 0);
    if (top) return top;
    // 若穿戴了 2 件以上神装散件 (4+2 / 2+2+2)，自动凝聚「无双名器共鸣」金辉光环！
    let soloGoldCnt = 0;
    (eqList || []).forEach((eq) => {
      const tpl = eq && C.EQUIP_TEMPLATES[eq.tplId || eq.id];
      if (tpl && !tpl.setId && tpl.quality === 'gold') soloGoldCnt++;
    });
    if (soloGoldCnt >= 2) {
      return {
        setId: '__solo_mythic__',
        name: '传世名器共鸣',
        quality: 'gold',
        count: soloGoldCnt,
        total: 2,
        auraVfx: 'golden_emperor',
        auraName: '无双名器金罡',
        auraColor: '#facc15',
        auraSubColor: '#fca5a5',
        auraTex: 'vfx_dragon_slash',
        vfxTier: soloGoldCnt >= 3 ? 3 : 2,
      };
    }
    return null;
  }

  // ---------------------------------------------------------------- 章节与关卡

  const TOWER_BG_CYCLE = [
    'bg_battle_grassland', 'bg_battle_canyon', 'bg_battle_jiangnan',
    'bg_battle_snow', 'bg_battle_forest', 'bg_battle_chibi', 'bg_battle_mystic',
  ];
  const CHALLENGE_DEFAULT_BG = {
    treasury: 'bg_battle_canyon',
    tomb: 'bg_battle_mystic',
    defend: 'bg_battle_forest',
    pass: 'bg_battle_chibi',
    escort: 'bg_battle_forest',
    chaos: 'bg_battle_mystic',
    xian: 'bg_battle_snow',
    mo: 'bg_battle_mystic',
    beast_xian: 'bg_battle_snow',
    beast_mo: 'bg_battle_mystic',
    bazhen: 'bg_battle_mystic',
  };
  const BIOME_DEFAULT_BG = {
    snow: 'bg_battle_snow',
    river: 'bg_battle_jiangnan',
    canyon: 'bg_battle_canyon',
    forest: 'bg_battle_forest',
    plains: 'bg_battle_grassland',
  };
  const REGION_DEFAULT_BG = [
    'bg_battle_grassland', 'bg_battle_canyon', 'bg_battle_snow', 'bg_battle_jiangnan', 'bg_battle',
    'bg_battle_chibi', 'bg_battle_forest', 'bg_battle_snow', 'bg_battle_jiangnan', 'bg_battle_forest',
  ];

  function getChapterMapTheme(ch) {
    const n = Math.max(1, Number(ch) || 1);
    const c = C.CHAPTERS[n] || C.CHAPTERS[1] || {};
    const fallbackBattle = REGION_DEFAULT_BG[(n - 1) % REGION_DEFAULT_BG.length] || BIOME_DEFAULT_BG[c.biome] || 'bg_battle_grassland';
    if (!c.theme) {
      return { regionName: c.name || '', mapKey: 'bg_map', battleKey: fallbackBattle };
    }
    return Object.assign({}, c.theme, { battleKey: c.theme.battleKey || fallbackBattle });
  }

  /**
   * 统一解析局内战场背景原画 key（优先级：单关/单副本 battleKey → 玩法配置 battleKey → 章节地域主题 → 地形回退）
   */
  function resolveBattleBgKey(ctx) {
    const o = ctx || {};
    const lv = o.level || (o.id || o.order || o.biome ? o : null);
    const mode = o.mode || (lv && lv.type) || 'city';
    if (lv && lv.battleKey) return lv.battleKey;
    if (lv && lv.special && lv.special.cfg && lv.special.cfg.battleKey) return lv.special.cfg.battleKey;
    if (lv && lv.demon && lv.demon.battleKey) return lv.demon.battleKey;

    if (mode === 'arena') return (C.ARENA && C.ARENA.battleKey) || 'bg_battle_chibi';
    if (mode === 'tower') {
      if (C.TOWER && C.TOWER.battleKey) return C.TOWER.battleKey;
      const floor = Number((lv && lv.id && String(lv.id).replace('tower_', '')) || (lv && lv.order) || 1) || 1;
      return TOWER_BG_CYCLE[Math.floor((floor - 1) / 3) % TOWER_BG_CYCLE.length];
    }
    if (mode === 'demon') {
      if (lv && lv.raid) return (C.WORLD_BOSS && C.WORLD_BOSS.battleKey) || 'bg_battle_mystic';
      return 'bg_battle_mystic';
    }
    if (CHALLENGE_DEFAULT_BG[mode]) {
      const chCfg = C.CHALLENGES && C.CHALLENGES[mode];
      return (chCfg && chCfg.battleKey) || CHALLENGE_DEFAULT_BG[mode];
    }
    if (mode === 'beast') {
      const dg = lv && lv.id && C.DUNGEONS && C.DUNGEONS[lv.id];
      if (dg && dg.battleKey) return dg.battleKey;
      const biome = (lv && lv.biome) || o.biome || 'plains';
      return BIOME_DEFAULT_BG[biome] || 'bg_battle_canyon';
    }

    const ch = Number(o.chapter || (lv && lv.chapter) || 0);
    const theme = o.chapterTheme || (lv && lv.mapTheme) || (ch > 0 ? getChapterMapTheme(ch) : null);
    if (theme && theme.battleKey) return theme.battleKey;

    const biome = o.biome || o.mapBiome || (lv && lv.biome) || 'plains';
    return BIOME_DEFAULT_BG[biome] || 'bg_battle_grassland';
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

  const FOUR_SYMBOL_BEAST_IDS = ['qinglong', 'zhuque', 'xuanwu', 'baihu'];
  const BEAST_TIER_UNLOCK = {
    qinglong: 15, zhuque: 20, xuanwu: 25, baihu: 30,
    taotie: 36, qiongqi: 42, taowu: 48, hundun: 54,
    qilin: 60, baize: 66, kunpeng: 72, zhulong: 80,
  };

  function getBeastUnlockLv(beastId) {
    const tier = BEAST_TIER_UNLOCK[beastId] || 15;
    const b = C.BEASTS[beastId];
    const dg = C.DUNGEONS['dungeon_' + beastId] || Object.keys(C.DUNGEONS).map((k) => C.DUNGEONS[k]).find((x) => x && x.beastId === beastId);
    const bLv = b && b.unlockLordLv ? b.unlockLordLv : tier;
    const dLv = dg && dg.unlockLordLv && dg.unlockLordLv !== 15 ? dg.unlockLordLv : tier;
    return Math.max(C.PARAMS.beastUnlockLordLv || 15, bLv, dLv);
  }

  function getBeastDungeons() {
    return Object.keys(C.DUNGEONS)
      .map((k) => {
        const d = Object.assign({ id: k }, C.DUNGEONS[k]);
        d.unlockLordLv = getBeastUnlockLv(d.beastId);
        return d;
      })
      .sort((a, b) => a.unlockLordLv - b.unlockLordLv || (a.order || 0) - (b.order || 0));
  }

  // ---------------------------------------------------------------- 关卡与副本难度（支持后台全局总控 + 分玩法 + 单关独立倍率）

  const BASE_DIFF = {
    enemyHpMult: 1.38, enemyAtkMult: 1.26, enemyDefMult: 1.22,
    stageHpMult: 1.30, stageAtkMult: 1.22, beastHpMult: 1.88, beastAtkMult: 1.36,
    demonHpMult: 1.28, demonAtkMult: 1.20, towerHpMult: 1.28, towerAtkMult: 1.20,
    tombHpMult: 1.42, tombAtkMult: 1.24, defendHpMult: 1.38, defendAtkMult: 1.24,
    passHpMult: 1.34, passAtkMult: 1.22, escortHpMult: 1.34, escortAtkMult: 1.22,
    chaosHpMult: 1.42, chaosAtkMult: 1.28, treasuryHpMult: 1.40, treasuryAtkMult: 1.24,
    xianHpMult: 1.40, xianAtkMult: 1.26, moHpMult: 1.40, moAtkMult: 1.30,
    beastXianHpMult: 1.45, beastXianAtkMult: 1.30, beastMoHpMult: 1.45, beastMoAtkMult: 1.34,
    bazhenHpMult: 1.35, bazhenAtkMult: 1.24,
    arenaHpMult: 1.30, arenaAtkMult: 1.22,
  };

  function calcModeMult(src, mode, level) {
    const d = src || {};
    const entryMult = (level && level.difficultyMult) || 1;
    if (mode === 'arena') {
      return { hpMult: (d.arenaHpMult || 1.30) * entryMult, atkMult: (d.arenaAtkMult || 1.22) * entryMult, defMult: 1 };
    }
    const gHp = d.enemyHpMult || 1, gAtk = d.enemyAtkMult || 1, gDef = d.enemyDefMult || 1;
    const towerMult = mode === 'tower' ? ((C.TOWER && C.TOWER.difficultyMult) || 1) : 1;
    const map = {
      city: [d.stageHpMult || 1, d.stageAtkMult || 1],
      beast: [d.beastHpMult || 1, d.beastAtkMult || 1],
      demon: [d.demonHpMult || 1, d.demonAtkMult || 1],
      tower: [(d.towerHpMult || 1) * towerMult, (d.towerAtkMult || 1) * towerMult],
      tomb: [d.tombHpMult || 1, d.tombAtkMult || 1],
      defend: [d.defendHpMult || 1, d.defendAtkMult || 1],
      pass: [d.passHpMult || 1, d.passAtkMult || 1],
      escort: [d.escortHpMult || 1, d.escortAtkMult || 1],
      chaos: [d.chaosHpMult || 1, d.chaosAtkMult || 1],
      treasury: [d.treasuryHpMult || 1, d.treasuryAtkMult || 1],
      xian: [d.xianHpMult || 1.40, d.xianAtkMult || 1.26],
      mo: [d.moHpMult || 1.40, d.moAtkMult || 1.30],
      beast_xian: [d.beastXianHpMult || d.xianHpMult || 1.45, d.beastXianAtkMult || d.xianAtkMult || 1.30],
      beast_mo: [d.beastMoHpMult || d.moHpMult || 1.45, d.beastMoAtkMult || d.moAtkMult || 1.34],
      bazhen: [d.bazhenHpMult || 1.35, d.bazhenAtkMult || 1.24],
    };
    const [mHp, mAtk] = map[mode] || [1, 1];
    const order = (level && level.order) || 10;
    const rookie = (mode === 'city' && order <= 2) ? (0.68 + order * 0.12) : 1;
    return {
      hpMult: gHp * mHp * entryMult * rookie,
      atkMult: gAtk * mAtk * entryMult * rookie,
      defMult: gDef * entryMult * rookie,
    };
  }

  function getModeDifficulty(mode, level) {
    return calcModeMult(Object.keys(C.DIFFICULTY).length ? C.DIFFICULTY : BASE_DIFF, mode, level);
  }

  function scaleRecommendedPower(mode, basePower, level) {
    const cur = getModeDifficulty(mode, level);
    const ref = calcModeMult(BASE_DIFF, mode, { order: level && level.order, difficultyMult: 1 });
    const ratio = Math.sqrt((cur.hpMult / Math.max(0.01, ref.hpMult)) * (cur.atkMult / Math.max(0.01, ref.atkMult)));
    return Math.max(100, Math.round((basePower || 0) * ratio));
  }

  /** 解析武将神/魔飞升属性与外观信息（与服务端 GameRules.ascendStatMult / ascendTacBonus 完全一致） */
  function getAscendInfo(gNode) {
    const path = gNode && gNode.ascend;
    if (path !== 'xian' && path !== 'mo') return null;
    const ac = C.ASCENSION || {};
    const tier = Math.max(1, Number(gNode.ascendTier) || 1);
    const t = tier - 1;
    const statMult = 1 + (ac.baseStatMult != null ? ac.baseStatMult : 0.35) + t * (ac.tierStatStep != null ? ac.tierStatStep : 0.15);
    const sub = (ac[path]) || {};
    const defTitles = path === 'xian'
      ? ['真神', '天神', '神王', '太古神尊', '九天神帝']
      : ['真魔', '玄魔', '天魔', '混世魔尊', '九幽魔帝'];
    const titles = Array.isArray(sub.titles) && sub.titles.length ? sub.titles : defTitles;
    const realm = titles[Math.min(titles.length - 1, t)] || `${tier}重`;
    const isXian = path === 'xian';
    return {
      path,
      tier,
      realm,
      title: `${isXian ? '神' : '魔'}·${realm}`,
      shortTag: `${isXian ? '神' : '魔'}${tier}重`,
      glyph: isXian ? '神' : '魔',
      color: isXian ? '#67e8f9' : '#f472b6',
      bg: isXian ? '#0f4c5c' : '#581c87',
      border: isXian ? '#fde047' : '#fb7185',
      statMult,
      crit: isXian ? ((sub.critBase ?? 0.05) + t * (sub.critStep ?? 0.015)) : ((sub.critBase ?? 0.07) + t * (sub.critStep ?? 0.02)),
      critDmg: isXian ? 0 : ((sub.critDmgBase ?? 0.20) + t * (sub.critDmgStep ?? 0.07)),
      lifesteal: isXian ? 0 : ((sub.lifestealBase ?? 0.08) + t * (sub.lifestealStep ?? 0.03)),
      dmgReduce: isXian ? ((sub.dmgReduceBase ?? 0.09) + t * (sub.dmgReduceStep ?? 0.03)) : 0,
      skillDmgPct: isXian ? ((sub.skillDmgBase ?? 0.14) + t * (sub.skillDmgStep ?? 0.05)) : 0,
      spdPct: isXian ? 0 : ((sub.spdPctBase ?? 0.11) + t * (sub.spdPctStep ?? 0.04)),
      initRage: isXian ? ((sub.initRageBase ?? 16) + t * (sub.initRageStep ?? 5)) : 0,
      auraVfx: {
        setId: isXian ? '__ascend_xian__' : '__ascend_mo__',
        name: isXian ? `九天神罡·${realm}` : `九幽魔煞·${realm}`,
        quality: 'gold',
        count: 6,
        total: 6,
        auraVfx: isXian ? 'jade_vitality' : 'shadow_phantom',
        auraName: isXian ? `九天神罡·${realm}` : `九幽魔煞·${realm}`,
        auraColor: isXian ? '#67e8f9' : '#e879f9',
        auraSubColor: isXian ? '#fef08a' : '#fb7185',
        auraTex: isXian ? 'vfx_holy_heal' : 'vfx_crimson_slash',
        vfxTier: tier >= 3 ? 3 : 2,
      },
    };
  }

  /** 获取武将品阶展示文案：未飞升为 B~SSS，成神为 B.神~SSS.神，成魔为 B.魔~SSS.魔 */
  function getRarityLabel(gidOrRarity, gNode) {
    const g = (C.GENERALS && C.GENERALS[gidOrRarity]) || null;
    const base = g ? (g.rarity || 'B') : (gidOrRarity || 'B');
    const asc = gNode && (typeof gNode === 'string' ? gNode : (gNode.ascend || (gNode.ascendInfo && gNode.ascendInfo.path)));
    if (asc === 'xian') return `${base}.神`;
    if (asc === 'mo') return `${base}.魔`;
    return base;
  }

  /** 解析神兽神/魔飞升属性与外观信息（与服务端 GameRules.beastAscendStatMult / beastAscendBondMult / ascendTacBonus 完全一致） */
  function getBeastAscendInfo(bNode) {
    const path = bNode && (typeof bNode === 'string' ? bNode : bNode.ascend);
    if (path !== 'xian' && path !== 'mo') return null;
    const ac = C.ASCENSION || {};
    const tier = Math.max(1, Number(bNode && bNode.ascendTier) || 1);
    const t = tier - 1;
    const statMult = 1 + (ac.beastBaseStatMult != null ? ac.beastBaseStatMult : 0.40) + t * (ac.beastTierStatStep != null ? ac.beastTierStatStep : 0.16);
    const bondMult = 1 + (ac.beastBondAscendBase != null ? ac.beastBondAscendBase : 0.15) + t * (ac.beastBondAscendStep != null ? ac.beastBondAscendStep : 0.05);
    const sub = (ac[path]) || {};
    const defTitles = path === 'xian'
      ? ['真神', '天神', '神王', '太古神尊', '九天神帝']
      : ['真魔', '玄魔', '天魔', '混世魔尊', '九幽魔帝'];
    const titles = Array.isArray(sub.titles) && sub.titles.length ? sub.titles : defTitles;
    const realm = titles[Math.min(titles.length - 1, t)] || `${tier}重`;
    const isXian = path === 'xian';
    return {
      path,
      tier,
      realm,
      title: `${isXian ? '神' : '魔'}·${realm}`,
      shortTag: `${isXian ? '神' : '魔'}${tier}重`,
      glyph: isXian ? '神' : '魔',
      prefix: isXian ? '神.' : '魔.',
      color: isXian ? '#67e8f9' : '#f472b6',
      bg: isXian ? '#0f4c5c' : '#581c87',
      border: isXian ? '#fde047' : '#fb7185',
      statMult,
      bondMult,
      crit: isXian ? ((sub.critBase ?? 0.05) + t * (sub.critStep ?? 0.015)) : ((sub.critBase ?? 0.07) + t * (sub.critStep ?? 0.02)),
      critDmg: isXian ? 0 : ((sub.critDmgBase ?? 0.20) + t * (sub.critDmgStep ?? 0.07)),
      lifesteal: isXian ? 0 : ((sub.lifestealBase ?? 0.08) + t * (sub.lifestealStep ?? 0.03)),
      dmgReduce: isXian ? ((sub.dmgReduceBase ?? 0.09) + t * (sub.dmgReduceStep ?? 0.03)) : 0,
      skillDmgPct: isXian ? ((sub.skillDmgBase ?? 0.14) + t * (sub.skillDmgStep ?? 0.05)) : 0,
      spdPct: isXian ? 0 : ((sub.spdPctBase ?? 0.11) + t * (sub.spdPctStep ?? 0.04)),
      initRage: isXian ? ((sub.initRageBase ?? 16) + t * (sub.initRageStep ?? 5)) : 0,
      auraVfx: {
        setId: isXian ? '__beast_ascend_xian__' : '__beast_ascend_mo__',
        name: isXian ? `九天神罡·${realm}` : `九幽魔煞·${realm}`,
        quality: 'gold',
        count: 4,
        total: 4,
        auraVfx: isXian ? 'jade_vitality' : 'shadow_phantom',
        auraName: isXian ? `九天神罡·${realm}` : `九幽魔煞·${realm}`,
        auraColor: isXian ? '#67e8f9' : '#e879f9',
        auraSubColor: isXian ? '#fef08a' : '#fb7185',
        auraTex: isXian ? 'vfx_holy_heal' : 'vfx_crimson_slash',
        vfxTier: tier >= 3 ? 3 : 2,
      },
    };
  }

  /** 获取神兽展示名称：未飞升为 苍穹青龙，化神为 神.苍穹青龙，入魔为 魔.苍穹青龙 */
  function getBeastDisplayName(bid, bNode, useShort) {
    const b = (C.BEASTS && C.BEASTS[bid]) || null;
    const base = b ? (useShort ? (b.shortName || b.name) : b.name) : (bid || '神兽');
    const asc = bNode && (typeof bNode === 'string' ? bNode : (bNode.ascend || (bNode.ascendInfo && bNode.ascendInfo.path)));
    if (asc === 'xian') return `神.${base}`;
    if (asc === 'mo') return `魔.${base}`;
    return base;
  }

  function getRarityColor(rarity, ascendPath) {
    if (ascendPath === 'xian') return '#67e8f9';
    if (ascendPath === 'mo') return '#f472b6';
    if (rarity === 'SSS') return '#f43f5e';
    if (rarity === 'SS') return '#facc15';
    if (rarity === 'S') return '#c084fc';
    if (rarity === 'A') return '#38bdf8';
    if (rarity === 'B') return '#4ade80';
    return '#94a3b8';
  }

  function getDuplicateSoul(gid) {
    const g = C.GENERALS && C.GENERALS[gid];
    const rar = g ? (g.rarity || 'B') : 'B';
    const P = C.PARAMS || {};
    if (rar === 'SSS') return P.dupSoulSSS || 480;
    if (rar === 'SS') return P.dupSoulSS || 260;
    if (rar === 'S') return P.dupSoulS || 130;
    if (rar === 'A') return P.dupSoulA || 65;
    return P.dupSoulB || P.duplicateGeneralSoul || 35;
  }

  /** 计算上阵阵容触发的【阵营共鸣 + 名将宿命羁绊】（与服务端 GameRules.lineupBondBonus 完全一致） */
  function computeLineupBondBonus(deployIds) {
    const res = {
      hpPct: 0, atkPct: 0, defPct: 0, crit: 0,
      critDmg: 0, lifesteal: 0, dmgReduce: 0, skillDmgPct: 0, spdPct: 0, initRage: 0,
      activeFaction: null,
      activeBonds: [],
    };
    const depSet = new Set();
    const facCounts = {};
    (deployIds || []).forEach((gid) => {
      const g = C.GENERALS && C.GENERALS[gid];
      if (!g || depSet.has(gid)) return;
      depSet.add(gid);
      if (g.faction) facCounts[g.faction] = (facCounts[g.faction] || 0) + 1;
    });
    if (!depSet.size) return res;

    const addNode = (n, full) => {
      res.hpPct += (full && n.fullHpPct != null) ? n.fullHpPct : (n.hpPct || 0);
      res.atkPct += (full && n.fullAtkPct != null) ? n.fullAtkPct : (n.atkPct || 0);
      res.defPct += (full && n.fullDefPct != null) ? n.fullDefPct : (n.defPct || 0);
      res.crit += (full && n.fullCrit != null) ? n.fullCrit : (n.crit || 0);
      res.critDmg += (full && n.fullCritDmg != null) ? n.fullCritDmg : (n.critDmg || 0);
      res.lifesteal += (full && n.fullLifesteal != null) ? n.fullLifesteal : (n.lifesteal || 0);
      res.dmgReduce += (full && n.fullDmgReduce != null) ? n.fullDmgReduce : (n.dmgReduce || 0);
      res.skillDmgPct += (full && n.fullSkillDmgPct != null) ? n.fullSkillDmgPct : (n.skillDmgPct || 0);
      res.spdPct += (full && n.fullSpdPct != null) ? n.fullSpdPct : (n.spdPct || 0);
      res.initRage += (full && n.fullInitRage != null) ? n.fullInitRage : (n.initRage || 0);
    };

    const maxSameFac = Math.max(0, ...Object.values(facCounts));
    const distinctFac = Object.keys(facCounts).length;
    const bondsCfg = C.BONDS || {};
    let bestFac = null;
    let bestSame = 0;
    let rainbowFac = null;
    (bondsCfg.factionResonance || []).forEach((fr) => {
      const sc = fr.sameCount || 0;
      if (sc > 0 && maxSameFac >= sc && sc > bestSame) {
        bestSame = sc;
        bestFac = fr;
      } else if (!sc && (fr.distinctCount || 0) > 0) {
        if (depSet.size >= (fr.minDeploy || 5) && distinctFac >= (fr.distinctCount || 4)) {
          rainbowFac = fr;
        }
      }
    });
    const actFac = bestFac || rainbowFac;
    if (actFac) {
      addNode(actFac, false);
      res.activeFaction = actFac;
    }

    (bondsCfg.heroBonds || []).forEach((hb) => {
      const need = Math.max(2, hb.need || 2);
      const hit = (hb.generals || []).filter((gid) => depSet.has(gid)).length;
      if (hit >= need) {
        const isFull = (hb.fullNeed || 0) > 0 && hit >= hb.fullNeed;
        addNode(hb, isFull);
        res.activeBonds.push(Object.assign({}, hb, { hitCount: hit, isFull }));
      }
    });
    return res;
  }

  function getGeneralBonds(gid, deployIds) {
    const depSet = new Set(deployIds || []);
    return ((C.BONDS && C.BONDS.heroBonds) || [])
      .filter((hb) => (hb.generals || []).indexOf(gid) >= 0)
      .map((hb) => {
        const hit = (hb.generals || []).filter((x) => depSet.has(x)).length;
        const need = Math.max(2, hb.need || 2);
        return Object.assign({}, hb, {
          hitCount: hit,
          active: hit >= need,
          isFull: (hb.fullNeed || 0) > 0 && hit >= hb.fullNeed,
        });
      });
  }

  function isAdEnabled() {
    return !!(C.PARAMS && C.PARAMS.adEnabled);
  }

  function setAdEnabled(val) {
    if (C.PARAMS) C.PARAMS.adEnabled = !!val;
  }

  App.Config = Object.assign(C, {
    SET_AURA_META, WEAPON_ATK_META, FOUR_SYMBOL_BEAST_IDS,
    load, isAdEnabled, setAdEnabled, getEquipBonus, getEquipSellPrice, computeSetBonus, resolveSetVfx, resolveWeaponVfx, computeArtifactBonus,
    getArtifactMaterialProgress, canUnlockArtifact, getDuplicateSoul, computeLineupBondBonus, getGeneralBonds,
    getTroopCard, getTroopMeta, getGeneralTroopId, getGeneralTroopCard, getGeneralTroopMeta, resolveGeneralCombatProfile,
    getChapterMapTheme, resolveBattleBgKey, getChapterInfo, buildStage, getChapterStages, getBeastUnlockLv, getBeastDungeons,
    getModeDifficulty, scaleRecommendedPower, getAscendInfo, getBeastAscendInfo, getBeastDisplayName, getRarityLabel, getRarityColor,
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
