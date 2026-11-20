(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  // 数值参数集中在 config/params.js，可被后端远程配置覆盖；这里始终读取最新值
  const P = App.Config.PARAMS;
  const SHOP = App.Config.SHOP;

  // 进行中的运营活动加成（由 api.js 登录后写入）：exp 经验倍率 / drop 铜钱将魂倍率 / stamina 体力折扣
  const boosts = { exp: 1, drop: 1, stamina: 1 };
  function setBoosts(b) {
    boosts.exp = Math.max(1, Number(b && b.exp) || 1);
    boosts.drop = Math.max(1, Number(b && b.drop) || 1);
    const d = Number(b && b.stamina);
    boosts.stamina = d > 0 && d <= 1 ? d : 1;
  }
  function boosted(kind, value) {
    return Math.round(value * (boosts[kind] || 1));
  }

  // 签到与每日任务的内容由后端配置下发
  const SIGN_REWARDS = App.Config.SIGN_REWARDS;
  const DAILY_QUEST_DEFS = App.Config.DAILY_QUESTS;

  function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function getExpForNextLevel(lv) {
    return Math.round(P.lordExpBase + (lv - 1) * P.lordExpPerLevel);
  }

  function getItemCount(itemId) {
    return (state.items && state.items[itemId]) || 0;
  }

  function canFreeSignToday() {
    return state.signDays < 7 && state.lastSignDate !== getTodayKey();
  }

  function getCost(kind, n) {
    switch (kind) {
      case 'enhance': return P.equipEnhanceBaseCost + n * P.equipEnhanceStepCost;
      case 'generalUp': return P.generalUpgradeBaseCost + n * P.generalUpgradeStepCost;
      case 'generalStar': return n * P.starUpSoulPerStar;
      case 'beastFeed': return P.beastUpgradeBaseCost + n * P.beastUpgradeStepCost;
      case 'beastStar': return n * P.beastStarSoulPerStar;
      default: return 0;
    }
  }

  function getStaminaCost(cost) {
    return Math.max(1, Math.ceil(cost * boosts.stamina));
  }

  function getEquippedMap(gid) {
    const map = {};
    state.inventory.forEach((eq) => {
      if (eq.equippedBy === gid) {
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        if (tpl && !tpl.isBeastEquip) map[tpl.slot] = eq;
      }
    });
    return map;
  }

  function getBeastEquippedMap(bid) {
    const map = {};
    state.inventory.forEach((eq) => {
      if (eq.equippedByBeast === bid) {
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        if (tpl && tpl.isBeastEquip) map[tpl.slot] = eq;
      }
    });
    return map;
  }

  function getBeastExpNeed(lv) {
    return Math.round(P.beastExpBase + (lv || 1) * P.beastExpPerLevel);
  }

  function getBeastStats(bid) {
    const bCfg = App.Config.BEASTS[bid];
    if (!bCfg) return null;
    const owned = state.ownedBeasts[bid];
    const lv = owned ? (owned.lv || 1) : 1;
    const exp = owned ? (owned.exp || 0) : 0;
    const star = owned ? (owned.star || 1) : 1;
    const needExp = getBeastExpNeed(lv);

    const lvMult = 1 + (lv - 1) * P.beastStatLvMult;
    const starMult = 1 + (star - 1) * P.beastStatStarMult;
    const baseHp = Math.round(bCfg.hp * lvMult * starMult);
    const baseAtk = Math.round(bCfg.atk * lvMult * starMult);
    const baseDef = Math.round(bCfg.def * lvMult * starMult);

    let bonusHp = 0, bonusAtk = 0, bonusDef = 0, bonusCrit = 0;
    const eqMap = owned ? getBeastEquippedMap(bid) : {};
    const eqList = Object.values(eqMap);
    eqList.forEach((eq) => {
      const eb = App.Config.getEquipBonus(eq);
      bonusHp += eb.hp;
      bonusAtk += eb.atk;
      bonusDef += eb.def;
      bonusCrit += eb.crit;
    });
    const setBonus = App.Config.computeSetBonus ? App.Config.computeSetBonus(eqList) : { hpPct: 0, atkPct: 0, defPct: 0, crit: 0, activeSets: [] };
    bonusHp += Math.round(baseHp * setBonus.hpPct);
    bonusAtk += Math.round(baseAtk * setBonus.atkPct);
    bonusDef += Math.round(baseDef * setBonus.defPct);
    bonusCrit += setBonus.crit;

    const hp = baseHp + bonusHp;
    const atk = baseAtk + bonusAtk;
    const def = baseDef + bonusDef;
    const crit = +(0.18 + (star - 1) * 0.03 + bonusCrit).toFixed(3);
    const power = Math.round(hp * 0.45 + atk * 6.0 + def * 4.5 + crit * 700);

    return {
      lv, exp, needExp, star,
      baseHp, baseAtk, baseDef,
      bonusHp, bonusAtk, bonusDef, bonusCrit,
      hp, atk, def, crit, power,
      eqCount: eqList.length,
      activeSets: setBonus.activeSets,
    };
  }

  function getGeneralStats(gid, overrideLv) {
    const base = App.Config.GENERALS[gid];
    if (!base) return null;
    const owned = state.ownedGenerals[gid];
    const lv = overrideLv || (owned ? owned.lv : 1);
    const star = owned ? owned.star : 1;
    const lvMult = 1 + (lv - 1) * P.generalLvHpAtkMult;
    const starMult = 1 + (star - 1) * P.generalStarMult;

    const baseHp = Math.round(base.hp * lvMult * starMult);
    const baseAtk = Math.round(base.atk * lvMult * starMult);
    const baseDef = Math.round(base.def * lvMult * starMult);
    let bonusHp = 0, bonusAtk = 0, bonusDef = 0, bonusCrit = 0;
    let boundBeastId = null;
    let activeSets = [];

    if (!overrideLv) {
      const eqMap = getEquippedMap(gid);
      const eqList = Object.values(eqMap);
      eqList.forEach((eq) => {
        const b = App.Config.getEquipBonus(eq);
        bonusHp += b.hp; bonusAtk += b.atk; bonusDef += b.def; bonusCrit += b.crit;
      });
      if (App.Config.computeSetBonus) {
        const sb = App.Config.computeSetBonus(eqList);
        bonusHp += Math.round(baseHp * sb.hpPct);
        bonusAtk += Math.round(baseAtk * sb.atkPct);
        bonusDef += Math.round(baseDef * sb.defPct);
        bonusCrit += sb.crit;
        activeSets = sb.activeSets;
      }
      for (const bid of App.Config.BEAST_IDS) {
        const b = state.ownedBeasts[bid];
        if (b && b.boundGeneralId === gid) {
          const bCfg = App.Config.BEASTS[bid];
          const bStats = getBeastStats(bid);
          const bScale = (1 + ((b.lv || 1) - 1) * P.beastLvMult) * (1 + ((b.star || 1) - 1) * P.beastBondStarMult);
          const share = P.beastBondEquipShare;
          bonusHp += Math.round(baseHp * bCfg.bondHpPct * bScale + (bStats ? bStats.bonusHp * share : 0));
          bonusAtk += Math.round(baseAtk * bCfg.bondAtkPct * bScale + (bStats ? bStats.bonusAtk * share : 0));
          bonusDef += Math.round(bStats ? bStats.bonusDef * share : 0);
          bonusCrit += bCfg.bondCrit;
          boundBeastId = bid;
          break;
        }
      }
    }

    const hp = baseHp + bonusHp;
    const atk = baseAtk + bonusAtk;
    const def = baseDef + bonusDef;
    const crit = +(0.12 + bonusCrit).toFixed(3);
    const power = Math.round(hp * 0.42 + atk * 5.5 + def * 4.2 + crit * 600);

    return {
      lv, star, baseHp, baseAtk, baseDef, bonusHp, bonusAtk, bonusDef,
      hp, atk, def, crit, spd: base.spd, boundBeastId, activeSets, power,
    };
  }

  function getGeneralPower(gid) {
    const s = getGeneralStats(gid);
    return s ? s.power : 0;
  }

  function getTeamPower() {
    let total = 0;
    state.deployIds.slice(0, P.maxDeploy).forEach((gid) => { total += getGeneralPower(gid); });
    if (state.activeBeastId && state.ownedBeasts[state.activeBeastId]) {
      const bs = getBeastStats(state.activeBeastId);
      total += bs ? bs.power : 1800;
    }
    return total;
  }

  function getAverageTeamLv() {
    const ids = Object.keys(state.ownedGenerals);
    if (!ids.length) return 1;
    return Math.max(1, Math.round(ids.reduce((a, id) => a + state.ownedGenerals[id].lv, 0) / ids.length));
  }

  function isStageUnlocked(order) {
    return order <= (state.maxClearedOrder || 0) + 1;
  }

  function computeRecruitChance(gid, hpRatio, isControlled, isAdDouble, useEdict) {
    const g = App.Config.GENERALS[gid];
    if (!g) return 0;
    const fac = App.Config.FACTIONS[state.factionId];
    let rate = g.baseRecruitRate + (fac && fac.recruitBonus ? fac.recruitBonus : 0);
    rate += Math.max(0, Math.min(1, (0.38 - hpRatio) / 0.37)) * 0.16;
    if (isControlled) rate += 0.15;
    if (useEdict || getItemCount(App.Config.SPECIAL.recruitEdictItem) > 0) rate += P.recruitEdictBonus;
    rate += state.recruitPity[gid] || 0;
    if (isAdDouble) rate *= 2;
    return Math.max(P.recruitMinRate, Math.min(P.recruitMaxRate, rate));
  }

  function computeCatchChance(bid, hpRatio, useGoldRope) {
    const b = App.Config.BEASTS[bid];
    if (!b) return 0;
    let rate = b.baseCatchRate;
    if (useGoldRope) rate = Math.min(P.goldRopeMaxRate, rate * P.goldRopeMult);
    return Math.max(P.catchMinRate, Math.min(P.catchMaxRate, rate));
  }

  function setBoosts(b) {
    boosts.exp = Math.max(1, Number(b && b.exp) || 1);
    boosts.drop = Math.max(1, Number(b && b.drop) || 1);
    const d = Number(b && b.stamina);
    boosts.stamina = d > 0 && d <= 1 ? d : 1;
  }

  function boosted(kind, value) {
    return Math.round(value * (boosts[kind] || 1));
  }


  // ============================================================================================
  // 存档只是服务端数据的本地镜像：所有会改变存档的操作都调用后端接口，由服务端执行并返回最新存档。
  // 这里不做任何扣费、发奖、掷骰，只负责展示用的计算。
  // ============================================================================================
  let state = { factionId: null, lordLevel: 1, lordExp: 0, gold: 0, soul: 0, stamina: 0, staminaUpdatedAt: Date.now(), ropes: 0, goldRopes: 0,
    arenaRank: 500, arenaTickets: 0, signDays: 0, lastSignDate: '', wheelTickets: 0, wheelTotalSpins: 0, maxClearedOrder: 0,
    shopOffers: [], shopUpdatedAt: 0, items: {}, questProgress: { claimed: {} }, adCounts: {}, clearedLevels: {}, ownedGenerals: {},
    recruitPity: {}, ownedBeasts: {}, activeBeastId: null, deployIds: [], inventory: [] };
  const EMPTY = JSON.stringify(state);
  let busy = false;
  // 玩家资料（昵称、ID 等），由服务端下发
  const profile = { nickname: '', playerId: 0, named: false };

  /** 用服务端返回的存档整体替换本地镜像（就地替换，保证各场景拿到的引用始终有效） */
  function applyServerSave(save) {
    const next = Object.assign(JSON.parse(EMPTY), save || {});
    if (!next.questProgress || !next.questProgress.claimed) next.questProgress = Object.assign({ claimed: {} }, next.questProgress);
    Object.keys(state).forEach((k) => { delete state[k]; });
    Object.assign(state, next);
  }

  /**
   * 执行一个玩家操作：请求后端 → 应用返回的存档 → 提示结果。
   * opts.silent 不弹成功提示；opts.defer 先不应用存档（如轮盘要等动画结束），由调用方之后调 res.apply()。
   * 始终 resolve，失败时 res.ok 为 false。
   */
  async function act(path, data, opts) {
    const o = opts || {};
    if (busy && !o.parallel) return { ok: false, busy: true };
    busy = true;
    let res;
    try {
      res = await App.API.post(path, data || {});
    } finally {
      busy = false;
    }
    if (!res) {
      App.UI.showToast('网络异常，请检查网络后重试', '#f87171');
      return { ok: false, msg: '网络异常' };
    }
    if (!res.ok) {
      if (!o.quietFail) App.UI.showToast(res.msg || '操作失败', '#f87171');
      return res;
    }
    if (res.profile) Object.assign(profile, res.profile);
    res.apply = () => { if (res.save) applyServerSave(res.save); };
    if (!o.defer) res.apply();
    if (App.Audio) {
      if (path.indexOf('/item/use') >= 0 || path.indexOf('/stage/sweep') >= 0) App.Audio.playSfx('chest_open');
      else if (path.indexOf('/upgrade') >= 0 || path.indexOf('/star-up') >= 0 || path.indexOf('/enhance') >= 0 || path.indexOf('/wear') >= 0) App.Audio.playSfx('upgrade');
      else if (path.indexOf('/sell') >= 0 || path.indexOf('/claim') >= 0 || path.indexOf('/buy') >= 0) App.Audio.playSfx('coin');
    }
    if (res.msg && !o.silent) App.UI.showToast(res.msg, o.color || '#4ade80');
    return res;
  }

  // 体力自然恢复仅用于界面显示，真实数值以服务端为准
  function syncStamina() {
    if (state.stamina >= P.staminaMax) return;
    const ms = P.staminaRecoverMinutes * 60000;
    const elapsed = App.API.now() - (state.staminaUpdatedAt || App.API.now());
    if (elapsed >= ms) {
      const gained = Math.floor(elapsed / ms);
      state.stamina = Math.min(P.staminaMax, state.stamina + gained);
      state.staminaUpdatedAt += gained * ms;
    }
  }

  function getNextStaminaSeconds() {
    syncStamina();
    if (state.stamina >= P.staminaMax) return 0;
    return Math.max(1, Math.ceil((P.staminaRecoverMinutes * 60000 - (App.API.now() - state.staminaUpdatedAt)) / 1000));
  }

  function hasUnclaimedActivity() {
    if (canFreeSignToday()) return true;
    const q = state.questProgress || {};
    if (q.date !== getTodayKey()) return false;
    return DAILY_QUEST_DEFS.some((d) => !(q.claimed || {})[d.id] && (q[d.id] || 0) >= d.target);
  }

  function getShopRefreshSeconds() {
    return Math.max(0, Math.ceil((SHOP.refreshMinutes * 60000 - (App.API.now() - (state.shopUpdatedAt || 0))) / 1000));
  }

  const g = (generalId) => ({ generalId });
  const b = (beastId) => ({ beastId });

  App.State = {
    get STAMINA_MAX() { return P.staminaMax; },
    get BEAST_UNLOCK_LORD_LV() { return P.beastUnlockLordLv; },
    get SHOP_REFRESH_COST() { return SHOP.refreshCost; },
    SIGN_REWARDS,
    DAILY_QUEST_DEFS,
    get: () => state,
    getProfile: () => profile,
    setProfile: (p) => Object.assign(profile, p || {}),
    rename: (name) => act('/api/player/rename', { name }),
    isBusy: () => busy,
    applyServerSave, act,
    // ---- 只读计算（展示用）
    getExpForNextLevel, getItemCount, canFreeSignToday, hasUnclaimedActivity, getCost, getStaminaCost,
    syncStamina, getNextStaminaSeconds, getEquippedMap, getBeastEquippedMap, getBeastExpNeed, getBeastStats,
    getGeneralStats, getGeneralPower, getTeamPower, getAverageTeamLv, isStageUnlocked,
    computeRecruitChance, computeCatchChance, setBoosts, boosted, getBoosts: () => boosts,
    getShopOffers: () => state.shopOffers || [], getShopRefreshSeconds,
    // ---- 玩家操作（全部走后端）
    chooseFaction: (factionId) => act('/api/player/create', { factionId }),
    toggleDeploy: (id) => act('/api/general/deploy', g(id)),
    upgradeGeneral: (id) => act('/api/general/upgrade', g(id)),
    starUpGeneral: (id) => act('/api/general/star-up', g(id)),
    exileGeneral: (id) => act('/api/general/exile', g(id)),
    equipItem: (generalId, uid) => act('/api/equip/wear', { generalId, uid }, { silent: true }),
    equipBeastItem: (beastId, uid) => act('/api/equip/wear', { beastId, uid }),
    unequipItem: (uid) => act('/api/equip/take-off', { uid }, { silent: true }),
    enhanceEquip: (uid) => act('/api/equip/enhance', { uid }),
    upgradeTroop: (troopId) => act('/api/equip/troop-upgrade', { troopId }),
    towerIdle: () => act('/api/tower/idle', {}, { color: '#fde047' }),
    starUpEquip: (uid) => act('/api/equip/star-up', { uid }),
    advanceEquip: (uid) => act('/api/equip/advance', { uid }),
    demonRedeem: (id) => act('/api/demon/redeem', { id }),
    sellEquip: (uid) => act('/api/equip/sell', { uid }, { color: '#fde047' }),
    sellAllBlueEquips: () => act('/api/equip/sell-all-blue', {}, { color: '#fde047' }),
    upgradeBeast: (id) => act('/api/beast/feed', b(id)),
    feedBeastScroll: (id) => act('/api/beast/feed-scroll', b(id)),
    starUpBeast: (id) => act('/api/beast/star-up', b(id)),
    bindBeastToGeneral: (beastId, generalId) => act('/api/beast/bind', { beastId, generalId }, { silent: true }),
    setActiveBeast: (beastId) => act('/api/beast/active', { beastId: beastId || null }, { silent: true }),
    useOrOpenItem: (itemId) => act('/api/item/use', { itemId }, { color: '#fde047' }),
    sellItem: (itemId) => act('/api/item/sell', { itemId }, { color: '#fde047' }),
    claimSignDay: (ad) => act('/api/sign/claim', { ad: !!ad }, { color: '#fde047' }),
    claimQuest: (questId) => act('/api/quest/claim', { questId }),
    spinWheel: () => act('/api/wheel/spin', {}, { defer: true, silent: true }),
    claimAd: (type) => act('/api/ad/claim', { type }),
    openShop: () => act('/api/shop/open', {}, { silent: true, quietFail: true, parallel: true }),
    refreshShop: (ad) => act('/api/shop/refresh', { ad: !!ad }, { color: '#fde047' }),
    buyShopOffer: (index) => act('/api/shop/buy', { index }),
    sweepStage: (stage) => act('/api/stage/sweep', { target: String(stage.order) }, { silent: true }),
    startBattle: (mode, target) => act('/api/battle/start', { mode, target: String(target) }, { silent: true }),
    finishBattle: (battleId, win, score) => act('/api/battle/finish', { battleId, win, score: score || 0 }, { silent: true, parallel: true }),
    battlePill: (battleId) => act('/api/battle/pill', { battleId }, { parallel: true }),
    doubleReward: (battleId) => act('/api/battle/double', { battleId }),
    recruit: (battleId, ad) => act('/api/battle/recruit', { battleId, ad: !!ad }, { silent: true }),
    catchBeast: (battleId, goldRope) => act('/api/battle/catch', { battleId, goldRope: !!goldRope }, { silent: true }),
    refresh: () => App.API.get('/api/player/state').then((res) => { if (res && res.ok && res.profile) Object.assign(profile, res.profile); if (res && res.ok && res.save) applyServerSave(res.save); return res; }),
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
