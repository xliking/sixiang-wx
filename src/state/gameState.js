(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  // 数值参数集中在 config/params.js，可被后端远程配置覆盖；这里始终读取最新值
  const P = App.Config.PARAMS;
  const SHOP = App.Config.SHOP;
  const INGOT_SHOP = App.Config.INGOT_SHOP;

  // 进行中的运营活动加成（由 api.js 登录后写入）：exp 经验倍率 / drop 铜钱将魂倍率 / stamina 体力折扣
  const boosts = { exp: 1, drop: 1, stamina: 1 };
  function setBoosts(b) {
    boosts.exp = Math.max(1, Number(b && b.exp) || 1);
    boosts.drop = Math.max(1, Number(b && b.drop) || 1);
    const d = Number(b && b.stamina);
    boosts.stamina = d > 0 && d <= 1 ? d : 1;
    invalidateStatCache();
  }
  function boosted(kind, value) {
    return Math.round(value * (boosts[kind] || 1));
  }

  // 签到、每日战令、活跃度宝箱与霸业成就均由后端配置下发
  const SIGN_REWARDS = App.Config.SIGN_REWARDS;
  const DAILY_QUEST_DEFS = App.Config.DAILY_QUESTS;
  const QUEST_BOXES = App.Config.QUEST_BOXES;
  const ACHIEVEMENTS = App.Config.ACHIEVEMENTS;

  // 存档修订号与衍生属性缓存（避免每帧在列表/地图重复遍历全背包与重算套装战力）
  let saveRevision = 1;
  let lastSaveVersion = 0;
  let cachedRev = -1;
  let heroEqIndex = {};
  let beastEqIndex = {};
  let cachedArtifactBonus = null;
  let beastStatsCache = {};
  let generalStatsCache = {};
  let teamPowerCache = null;
  let nextRentExpireAt = 0;

  function nowMs() {
    return (App.API && App.API.now) ? App.API.now() : Date.now();
  }

  function invalidateStatCache() {
    saveRevision++;
    cachedRev = -1;
    if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty();
  }

  function ensureDerivedIndex() {
    if (nextRentExpireAt > 0 && nowMs() >= nextRentExpireAt) {
      nextRentExpireAt = 0;
      cachedRev = -1;
    }
    if (cachedRev === saveRevision) return;
    cachedRev = saveRevision;
    heroEqIndex = {};
    beastEqIndex = {};
    beastStatsCache = {};
    generalStatsCache = {};
    teamPowerCache = null;
    nextRentExpireAt = 0;
    const now = nowMs();
    Object.values(state.rentedGenerals || {}).forEach((rg) => {
      if (rg && rg.expireAt > now && (nextRentExpireAt === 0 || rg.expireAt < nextRentExpireAt)) {
        nextRentExpireAt = rg.expireAt;
      }
    });
    cachedArtifactBonus = App.Config.computeArtifactBonus
      ? App.Config.computeArtifactBonus(state.ownedArtifacts, state.activeArtifactId)
      : null;
    const inv = state.inventory || [];
    for (let i = 0; i < inv.length; i++) {
      const eq = inv[i];
      if (!eq) continue;
      const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
      if (!tpl) continue;
      if (eq.equippedBy && !tpl.isBeastEquip) {
        if (!heroEqIndex[eq.equippedBy]) heroEqIndex[eq.equippedBy] = {};
        heroEqIndex[eq.equippedBy][tpl.slot] = eq;
      } else if (eq.equippedByBeast && tpl.isBeastEquip) {
        if (!beastEqIndex[eq.equippedByBeast]) beastEqIndex[eq.equippedByBeast] = {};
        beastEqIndex[eq.equippedByBeast][tpl.slot] = eq;
      }
    }
  }

  function getTodayKey() {
    const nowMs = (App.API && App.API.now) ? App.API.now() : Date.now();
    const d = new Date(nowMs);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function getExpForNextLevel(lv) {
    return Math.round(P.lordExpBase + (lv - 1) * P.lordExpPerLevel);
  }

  function getItemCount(itemId) {
    return (state.items && state.items[itemId]) || 0;
  }

  function getItemCountByCat(cat) {
    let total = 0;
    Object.keys(state.items || {}).forEach((id) => {
      const n = state.items[id] || 0;
      if (n > 0 && App.Config.ITEMS[id] && App.Config.ITEMS[id].cat === cat) total += n;
    });
    return total;
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
    ensureDerivedIndex();
    return heroEqIndex[gid] || {};
  }

  function getBeastEquippedMap(bid) {
    ensureDerivedIndex();
    return beastEqIndex[bid] || {};
  }

  function getBeastExpNeed(lv) {
    return Math.round(P.beastExpBase + (lv || 1) * P.beastExpPerLevel);
  }

  function getBeastStats(bid) {
    ensureDerivedIndex();
    if (beastStatsCache[bid] !== undefined) return beastStatsCache[bid];
    const bCfg = App.Config.BEASTS[bid];
    if (!bCfg) {
      beastStatsCache[bid] = null;
      return null;
    }
    const owned = state.ownedBeasts[bid];
    const lv = owned ? (owned.lv || 1) : 1;
    const exp = owned ? (owned.exp || 0) : 0;
    const star = owned ? (owned.star || 1) : 1;
    const needExp = getBeastExpNeed(lv);

    const lvMult = 1 + (lv - 1) * (P.beastStatLvMult || 0.17);
    const starMult = 1 + (star - 1) * (P.beastStatStarMult || 0.23);
    const baseHp = Math.round(bCfg.hp * lvMult * starMult);
    const baseAtk = Math.round(bCfg.atk * lvMult * starMult);
    const baseDef = Math.round(bCfg.def * lvMult * starMult);

    let bonusHp = 0, bonusAtk = 0, bonusDef = 0, bonusCrit = 0;
    let critDmg = 0, lifesteal = 0, dmgReduce = 0, skillDmgPct = 0, spdPct = 0, initRage = 0;
    const eqMap = owned ? getBeastEquippedMap(bid) : {};
    const eqList = Object.values(eqMap);
    eqList.forEach((eq) => {
      const eb = App.Config.getEquipBonus(eq);
      bonusHp += eb.hp;
      bonusAtk += eb.atk;
      bonusDef += eb.def;
      bonusCrit += eb.crit;
      critDmg += eb.critDmg || 0;
      lifesteal += eb.lifesteal || 0;
      dmgReduce += eb.dmgReduce || 0;
      skillDmgPct += eb.skillDmgPct || 0;
      spdPct += eb.spdPct || 0;
      initRage += eb.initRage || 0;
    });
    const setBonus = App.Config.computeSetBonus ? App.Config.computeSetBonus(eqList) : { hpPct: 0, atkPct: 0, defPct: 0, crit: 0, activeSets: [] };
    bonusHp += Math.round(baseHp * setBonus.hpPct);
    bonusAtk += Math.round(baseAtk * setBonus.atkPct);
    bonusDef += Math.round(baseDef * setBonus.defPct);
    bonusCrit += setBonus.crit;
    critDmg += setBonus.critDmg || 0;
    lifesteal += setBonus.lifesteal || 0;
    dmgReduce += setBonus.dmgReduce || 0;
    skillDmgPct += setBonus.skillDmgPct || 0;
    spdPct += setBonus.spdPct || 0;
    initRage += setBonus.initRage || 0;

    // 镇军法宝全军共鸣光环同样加持上阵/已收服神兽（不计入契约装备共享 bonusHp，与服务端战力严格对齐）
    let artHp = 0, artAtk = 0, artDef = 0, artCrit = 0;
    if (owned && cachedArtifactBonus) {
      const ab = cachedArtifactBonus;
      artHp = ab.hp || 0;
      artAtk = ab.atk || 0;
      artDef = ab.def || 0;
      artCrit = ab.crit || 0;
      critDmg += ab.critDmg || 0;
      lifesteal += ab.lifesteal || 0;
      dmgReduce += ab.dmgReduce || 0;
      skillDmgPct += ab.skillDmgPct || 0;
      spdPct += ab.spdPct || 0;
      initRage += ab.activeRage || 0;
    }

    const hp = baseHp + bonusHp + artHp;
    const atk = baseAtk + bonusAtk + artAtk;
    const def = baseDef + bonusDef + artDef;
    const crit = +(0.18 + (star - 1) * 0.03 + bonusCrit + artCrit).toFixed(3);
    const tacPower = Math.round(critDmg * 450 + lifesteal * 900 + dmgReduce * 850 + skillDmgPct * 650 + spdPct * 550 + initRage * 8);
    const power = Math.round(hp * 0.45 + atk * 6.0 + def * 4.5 + crit * 700) + tacPower;

    const out = {
      lv, exp, needExp, star,
      baseHp, baseAtk, baseDef,
      bonusHp, bonusAtk, bonusDef, bonusCrit,
      hp, atk, def, crit, critDmg, lifesteal, dmgReduce, skillDmgPct, spdPct, initRage, power,
      eqCount: eqList.length,
      activeSets: setBonus.activeSets,
    };
    beastStatsCache[bid] = out;
    return out;
  }

  function getActiveRented(gid) {
    const rg = state.rentedGenerals && state.rentedGenerals[gid];
    return (rg && rg.expireAt > nowMs()) ? rg : null;
  }

  function getStandaloneGeneralPower(gid, node) {
    const base = App.Config.GENERALS[gid];
    if (!base || !node) return 0;
    const lv = node.lv || 1;
    const star = node.star || 1;
    const asc = App.Config.getAscendInfo ? App.Config.getAscendInfo(node) : null;
    const mult = (1 + (lv - 1) * (P.generalLvHpAtkMult || 0.16)) * (1 + (star - 1) * (P.generalStarMult || 0.22)) * (asc ? asc.statMult : 1);
    const hp = Math.round(base.hp * mult);
    const atk = Math.round(base.atk * mult);
    const def = Math.round(base.def * mult);
    const crit = 0.12 + (asc ? asc.crit : 0);
    const tac = asc
      ? Math.round(asc.critDmg * 450 + asc.lifesteal * 900 + asc.dmgReduce * 850 + asc.skillDmgPct * 650 + asc.spdPct * 550 + asc.initRage * 8)
      : 0;
    return Math.round(hp * 0.42 + atk * 5.5 + def * 4.2 + crit * 600) + tac;
  }

  function getEffectiveGeneral(gid) {
    const owned = state.ownedGenerals && state.ownedGenerals[gid];
    const rented = getActiveRented(gid);
    if (owned && rented) {
      return getStandaloneGeneralPower(gid, rented) >= getStandaloneGeneralPower(gid, owned) ? rented : owned;
    }
    return rented || owned || null;
  }

  function getDeployableGeneralIds() {
    const set = new Set(Object.keys(state.ownedGenerals || {}));
    const now = nowMs();
    Object.keys(state.rentedGenerals || {}).forEach((gid) => {
      const rg = state.rentedGenerals[gid];
      if (rg && rg.expireAt > now) set.add(gid);
    });
    return Array.from(set).filter((gid) => !!App.Config.GENERALS[gid]);
  }

  function getGeneralStats(gid, overrideLv, customNode) {
    if (!overrideLv && !customNode) {
      ensureDerivedIndex();
      if (generalStatsCache[gid] !== undefined) return generalStatsCache[gid];
    }
    const base = App.Config.GENERALS[gid];
    if (!base) {
      if (!overrideLv && !customNode) generalStatsCache[gid] = null;
      return null;
    }
    const eff = customNode || (overrideLv ? null : (getEffectiveGeneral(gid) || (state.hostedGenerals && state.hostedGenerals[gid])));
    const isRented = !customNode && !overrideLv && !!eff && eff === getActiveRented(gid);
    const isHosted = !customNode && !overrideLv && !getEffectiveGeneral(gid) && !!(state.hostedGenerals && state.hostedGenerals[gid]);
    const lv = overrideLv || (eff ? (eff.lv || 1) : 1);
    const star = eff ? (eff.star || 1) : 1;
    const ascInfo = (!overrideLv && eff && App.Config.getAscendInfo) ? App.Config.getAscendInfo(eff) : null;
    const lvMult = 1 + (lv - 1) * (P.generalLvHpAtkMult || 0.16);
    const starMult = 1 + (star - 1) * (P.generalStarMult || 0.22);
    const ascMult = ascInfo ? ascInfo.statMult : 1;

    const baseHp = Math.round(base.hp * lvMult * starMult * ascMult);
    const baseAtk = Math.round(base.atk * lvMult * starMult * ascMult);
    const baseDef = Math.round(base.def * lvMult * starMult * ascMult);
    let bonusHp = 0, bonusAtk = 0, bonusDef = 0, bonusCrit = ascInfo ? ascInfo.crit : 0;
    let critDmg = ascInfo ? ascInfo.critDmg : 0;
    let lifesteal = ascInfo ? ascInfo.lifesteal : 0;
    let dmgReduce = ascInfo ? ascInfo.dmgReduce : 0;
    let skillDmgPct = ascInfo ? ascInfo.skillDmgPct : 0;
    let spdPct = ascInfo ? ascInfo.spdPct : 0;
    let initRage = ascInfo ? ascInfo.initRage : 0;
    let boundBeastId = null;
    let activeSets = [];

    if (!overrideLv && !customNode) {
      const eqMap = getEquippedMap(gid);
      const eqList = Object.values(eqMap);
      eqList.forEach((eq) => {
        const b = App.Config.getEquipBonus(eq);
        bonusHp += b.hp; bonusAtk += b.atk; bonusDef += b.def; bonusCrit += b.crit;
        critDmg += b.critDmg || 0; lifesteal += b.lifesteal || 0; dmgReduce += b.dmgReduce || 0;
        skillDmgPct += b.skillDmgPct || 0; spdPct += b.spdPct || 0; initRage += b.initRage || 0;
      });
      if (App.Config.computeSetBonus) {
        const sb = App.Config.computeSetBonus(eqList, ascInfo ? ascInfo.path : null);
        bonusHp += Math.round(baseHp * sb.hpPct);
        bonusAtk += Math.round(baseAtk * sb.atkPct);
        bonusDef += Math.round(baseDef * sb.defPct);
        bonusCrit += sb.crit;
        critDmg += sb.critDmg || 0; lifesteal += sb.lifesteal || 0; dmgReduce += sb.dmgReduce || 0;
        skillDmgPct += sb.skillDmgPct || 0; spdPct += sb.spdPct || 0; initRage += sb.initRage || 0;
        activeSets = sb.activeSets;
      }
      if (cachedArtifactBonus) {
        const ab = cachedArtifactBonus;
        bonusHp += ab.hp;
        bonusAtk += ab.atk;
        bonusDef += ab.def;
        bonusCrit += ab.crit;
        critDmg += ab.critDmg || 0; lifesteal += ab.lifesteal || 0; dmgReduce += ab.dmgReduce || 0;
        skillDmgPct += ab.skillDmgPct || 0; spdPct += ab.spdPct || 0; initRage += ab.activeRage || 0;
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
    const tacPower = Math.round(critDmg * 450 + lifesteal * 900 + dmgReduce * 850 + skillDmgPct * 650 + spdPct * 550 + initRage * 8);
    const power = Math.round(hp * 0.42 + atk * 5.5 + def * 4.2 + crit * 600) + tacPower;

    const out = {
      lv, star,
      ascend: ascInfo ? ascInfo.path : null,
      ascendTier: ascInfo ? ascInfo.tier : 0,
      ascendInfo: ascInfo,
      isRented,
      rentExpireAt: isRented ? eff.expireAt : 0,
      rentOwner: isRented ? eff.ownerName : '',
      isHosted,
      baseHp, baseAtk, baseDef, bonusHp, bonusAtk, bonusDef,
      hp, atk, def, crit, spd: base.spd, critDmg, lifesteal, dmgReduce, skillDmgPct, spdPct, initRage,
      boundBeastId, activeSets, power,
    };
    if (!overrideLv && !customNode) generalStatsCache[gid] = out;
    return out;
  }

  function getGeneralPower(gid) {
    const s = getGeneralStats(gid);
    return s ? s.power : 0;
  }

  function getDeployHeroPower() {
    let total = 0;
    (state.deployIds || []).slice(0, P.maxDeploy || 5).forEach((gid) => {
      total += getGeneralPower(gid);
    });
    return total;
  }

  function getTeamPower() {
    ensureDerivedIndex();
    if (teamPowerCache !== null) return teamPowerCache;
    let total = getDeployHeroPower();
    if (state.activeBeastId && state.ownedBeasts[state.activeBeastId]) {
      const bs = getBeastStats(state.activeBeastId);
      total += bs ? bs.power : 1800;
    }
    teamPowerCache = total;
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
    rate += P.postVictoryRecruitBonus || 0;
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


  // ============================================================================================
  // 存档只是服务端数据的本地镜像：所有会改变存档的操作都调用后端接口，由服务端执行并返回最新存档。
  // 这里不做任何扣费、发奖、掷骰，只负责展示用的计算。
  // ============================================================================================
  let state = { factionId: null, lordLevel: 1, lordExp: 0, gold: 0, ingot: 0, soul: 0, stamina: 0, staminaUpdatedAt: Date.now(), ropes: 0, goldRopes: 0,
    arenaRank: 9999, arenaTickets: 0, guildCoin: 0, signDays: 0, lastSignDate: '', wheelTickets: 0, wheelTotalSpins: 0, maxClearedOrder: 0, towerFloor: 0,
    shopOffers: [], shopUpdatedAt: 0, ingotShopOffers: [], ingotShopUpdatedAt: 0, items: {}, questProgress: { claimed: {}, boxClaimed: {} }, claimedAchievements: {},
    patrolClaimedAt: Date.now() - 3600000, patrolQuick: { date: '', freeUsed: 0 },
    adCounts: {}, clearedLevels: {}, ownedGenerals: {}, hostedGenerals: {}, rentedGenerals: {},
    recruitPity: {}, ownedBeasts: {}, activeBeastId: null, ownedArtifacts: {}, activeArtifactId: null, deployIds: [], inventory: [] };
  const EMPTY = JSON.stringify(state);
  let busy = false;
  // 玩家资料（昵称、ID 等），由服务端下发
  const profile = { nickname: '', playerId: 0, named: false };

  /** 用服务端返回的存档整体替换本地镜像（就地替换，同时拦截乱序旧版响应） */
  function applyServerSave(save, saveVer) {
    if (!save) lastSaveVersion = 0;
    else if (typeof saveVer === 'number' && saveVer > 0) {
      if (saveVer < lastSaveVersion) return;
      lastSaveVersion = saveVer;
    }
    const next = Object.assign(JSON.parse(EMPTY), save || {});
    if (!next.questProgress || !next.questProgress.claimed) next.questProgress = Object.assign({ claimed: {}, boxClaimed: {} }, next.questProgress);
    if (!next.questProgress.boxClaimed) next.questProgress.boxClaimed = {};
    if (!next.claimedAchievements) next.claimedAchievements = {};
    const prevLv = state.factionId ? (state.lordLevel || 1) : 0;
    Object.keys(state).forEach((k) => { delete state[k]; });
    Object.assign(state, next);
    invalidateStatCache();
    // 升级跨过某个功能的开启等级时提示
    if (prevLv > 0 && (state.lordLevel || 1) > prevLv && App.UI && App.UI.showToast) {
      const F = App.Config.FEATURES || {};
      const opened = Object.keys(F).filter((id) => prevLv < (F[id].unlockLordLv || 1) && state.lordLevel >= (F[id].unlockLordLv || 1)).map((id) => F[id].name || id);
      if (opened.length) App.UI.showToast(`主公晋升 Lv.${state.lordLevel}！新开启：${opened.map((n) => '【' + n + '】').join('')}`, '#fde047');
    }
  }

  /** 功能开启等级（后台「功能开启」配置）；0 表示已开启 */
  function featureLockLv(id) {
    const f = (App.Config.FEATURES || {})[id];
    const need = (f && f.unlockLordLv) || 1;
    return (state.lordLevel || 1) >= need ? 0 : need;
  }

  /** 进入某个功能前调用：未开启则提示并返回 false */
  function checkFeature(id) {
    const need = featureLockLv(id);
    if (!need) return true;
    const f = (App.Config.FEATURES || {})[id] || {};
    App.UI.showToast(`主公等级达到 ${need} 级后开启【${f.name || id}】`, '#fca5a5');
    return false;
  }

  function inferLoadingInfo(path) {
    if (path.indexOf('/battle/start') >= 0) return { text: '正在击鼓点兵，奔赴沙场…', immediate: true };
    if (path.indexOf('/stage/sweep') >= 0) return { text: '铁骑疾驰扫荡关隘…', immediate: true };
    if (path.indexOf('/player/create') >= 0) return { text: '正在立旗建号…', immediate: true };
    if (path.indexOf('/player/rename') >= 0) return { text: '正在铭刻主公名讳…', immediate: true };
    if (path.indexOf('/battle/recruit') >= 0) return { text: '正在帐前劝降敌将…', immediate: false };
    if (path.indexOf('/battle/catch') >= 0) return { text: '正在祭起缚兽索…', immediate: false };
    if (path.indexOf('/synthesize') >= 0 || path.indexOf('/forge-') >= 0) return { text: '正在开炉熔铸神兵…', immediate: false };
    if (path.indexOf('/reforge') >= 0) return { text: '正在淬灵洗炼词条…', immediate: false };
    if (path.indexOf('/artifact-') >= 0) return { text: '正在祭炼镇军法宝…', immediate: false };
    if (path.indexOf('/equip/') >= 0 || path.indexOf('/general/') >= 0 || path.indexOf('/beast/') >= 0) return { text: '正在炉火精修军备…', immediate: false };
    if (path.indexOf('/wheel/spin') >= 0) return { text: '正在引动天命轮盘…', immediate: false };
    if (path.indexOf('/guild/') >= 0) return { text: '正在传令联盟大营…', immediate: false };
    if (path.indexOf('/shop/') >= 0 || path.indexOf('/market/') >= 0) return { text: '正在交割军需钱粮…', immediate: false };
    return { text: '正在同步军机指令…', immediate: false };
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
    const stopLoad = (!o.parallel && App.UI && App.UI.beginLoading) ? App.UI.beginLoading(o.loadingText || inferLoadingInfo(path).text, inferLoadingInfo(path)) : null;
    let res;
    try {
      res = await App.API.post(path, data || {});
    } finally {
      if (stopLoad) stopLoad();
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
    res.apply = () => { if (res.save) applyServerSave(res.save, res.saveVersion); };
    if (!o.defer) res.apply();
    if (App.Audio) {
      if (path.indexOf('/item/use') >= 0 || path.indexOf('/stage/sweep') >= 0 || path.indexOf('/synthesize') >= 0 || path.indexOf('/forge-') >= 0) App.Audio.playSfx('chest_open');
      else if (path.indexOf('/ascend') >= 0) App.Audio.playSfx('ultimate');
      else if (path.indexOf('/upgrade') >= 0 || path.indexOf('/star-up') >= 0 || path.indexOf('/enhance') >= 0 || path.indexOf('/advance') >= 0 || path.indexOf('/reforge') >= 0 || path.indexOf('/artifact-') >= 0 || path.indexOf('/wear') >= 0) App.Audio.playSfx('upgrade');
      else if (path.indexOf('/sell') >= 0 || path.indexOf('/claim') >= 0 || path.indexOf('/buy') >= 0 || path.indexOf('/hire/') >= 0 || path.indexOf('/exchange') >= 0) App.Audio.playSfx('coin');
    }
    if (res.msg && !o.silent) App.UI.showToast(res.msg, o.color || '#4ade80');
    return res;
  }

  // 体力自然恢复仅用于界面显示，真实数值以服务端为准（严控上限不超 staminaMax）
  function syncStamina() {
    const maxSta = P.staminaMax || 60;
    if (state.stamina >= maxSta) {
      if (state.stamina > maxSta) state.stamina = maxSta;
      return;
    }
    const ms = P.staminaRecoverMinutes * 60000;
    const elapsed = App.API.now() - (state.staminaUpdatedAt || App.API.now());
    if (elapsed >= ms) {
      const gained = Math.floor(elapsed / ms);
      state.stamina = Math.min(maxSta, state.stamina + gained);
      state.staminaUpdatedAt += gained * ms;
    }
  }

  function getNextStaminaSeconds() {
    syncStamina();
    if (state.stamina >= P.staminaMax) return 0;
    return Math.max(1, Math.ceil((P.staminaRecoverMinutes * 60000 - (App.API.now() - state.staminaUpdatedAt)) / 1000));
  }

  function getGeneralMaxLv() {
    const absMax = P.generalMaxLevel || 150;
    const minCap = P.generalLvMinCap || 12;
    const factor = P.generalLvCapFactor || 3;
    return Math.min(absMax, Math.max(minCap, (state.lordLevel || 1) * factor));
  }

  function getAdRewardAmount(type, field) {
    const cfg = (App.Config.AD_REWARDS || {})[type] || {};
    const lv = Math.max(1, state.lordLevel || 1);
    if (field === 'gold') return (cfg.gold || 0) + (lv - 1) * (cfg.goldPerLordLv || 0);
    if (field === 'soul') return (cfg.soul || 0) + (lv - 1) * (cfg.soulPerLordLv || 0);
    return cfg[field] || 0;
  }

  function getQuestReward(def) {
    const lv = Math.max(1, state.lordLevel || 1);
    return {
      gold: (def.gold || 0) + (lv - 1) * 35,
      soul: (def.soul || 0) + (lv - 1) * 2,
      exp: def.exp || 0,
      itemId: def.itemId || null,
    };
  }

  function getQuestBoxReward(box) {
    const lv = Math.max(1, state.lordLevel || 1);
    return {
      gold: (box.gold || 0) + (lv - 1) * 60,
      soul: (box.soul || 0) + (lv - 1) * 3,
      itemId: box.itemId || null,
      itemCount: box.itemCount || 1,
    };
  }

  function getActivePoints() {
    const q = state.questProgress || {};
    if (q.date !== getTodayKey()) return 0;
    return DAILY_QUEST_DEFS.reduce((sum, d) => sum + ((q[d.id] || 0) >= d.target ? (d.points || 25) : 0), 0);
  }

  function getAchievementValue(cat) {
    switch (cat) {
      case 'stage': return state.maxClearedOrder || 0;
      case 'general': return Object.keys(state.ownedGenerals || {}).length + Object.keys(state.hostedGenerals || {}).length;
      case 'tower': return state.towerFloor || 0;
      case 'beast': return Object.keys(state.ownedBeasts || {}).length;
      case 'artifact': return Object.keys(state.ownedArtifacts || {}).length;
      case 'power': return getTeamPower();
      case 'level': return state.lordLevel || 1;
      default: return 0;
    }
  }

  function hasUnclaimedQuestOrBox() {
    const q = state.questProgress || {};
    if (q.date !== getTodayKey()) return false;
    if (DAILY_QUEST_DEFS.some((d) => !(q.claimed || {})[d.id] && (q[d.id] || 0) >= d.target)) return true;
    const pts = getActivePoints();
    return QUEST_BOXES.some((bx) => !(q.boxClaimed || {})[bx.id] && pts >= (bx.needPoints || 999));
  }

  function hasUnclaimedAchievement() {
    const claimed = state.claimedAchievements || {};
    return ACHIEVEMENTS.some((a) => !claimed[a.id] && getAchievementValue(a.cat) >= (a.target || 1));
  }

  function hasUnclaimedActivity() {
    return canFreeSignToday() || hasUnclaimedQuestOrBox() || hasUnclaimedAchievement();
  }

  function getPatrolInfo() {
    const p = App.Config.PATROL || {};
    const cleared = Math.max(0, state.maxClearedOrder || 0);
    const goldPerHour = (p.baseGoldPerHour || 450) + cleared * (p.goldPerStagePerHour || 35);
    const soulPerHour = (p.baseSoulPerHour || 20) + cleared * (p.soulPerStagePerHour || 1.8);
    const expPerHour = (p.baseExpPerHour || 70) + cleared * (p.expPerStagePerHour || 4.5);
    const maxHours = Math.max(1, p.maxHours || 12);
    const minClaimMinutes = Math.max(1, p.minClaimMinutes || 5);
    const now = (App.API && App.API.now) ? App.API.now() : Date.now();
    const last = state.patrolClaimedAt || (now - 3600000);
    const elapsedMs = Math.max(0, Math.min(maxHours * 3600000, now - last));
    const hrs = elapsedMs / 3600000;
    const mins = Math.floor(elapsedMs / 60000);
    const gold = mins >= 1 ? Math.max(50, boosted('drop', Math.round(goldPerHour * hrs))) : 0;
    const soul = mins >= 1 ? Math.max(2, boosted('drop', Math.round(soulPerHour * hrs))) : 0;
    const exp = mins >= 1 ? Math.max(10, boosted('exp', Math.round(expPerHour * hrs))) : 0;
    const boxEvery = Math.max(1, p.boxEveryHours || 3);
    const boxes = Math.floor(hrs / boxEvery);
    const pq = state.patrolQuick || {};
    const freeMax = p.freeQuickDaily != null ? p.freeQuickDaily : 1;
    const freeUsed = pq.date === getTodayKey() ? (pq.freeUsed || 0) : 0;
    const freeQuickLeft = Math.max(0, freeMax - freeUsed);
    const quickHours = Math.max(1, p.quickHours || 2);
    const adLimit = ((App.Config.AD_REWARDS || {}).patrol_quick || {}).dailyLimit || 4;
    const adCounts = state.adCounts || {};
    const adUsed = adCounts.date === getTodayKey() ? (adCounts.patrol_quick || 0) : 0;
    return {
      cleared,
      goldPerHour: Math.round(goldPerHour),
      soulPerHour: Math.round(soulPerHour),
      expPerHour: Math.round(expPerHour),
      maxHours,
      minClaimMinutes,
      mins,
      hrs,
      gold,
      soul,
      exp,
      boxes,
      canClaim: mins >= minClaimMinutes,
      freeQuickLeft,
      quickHours,
      quickGold: boosted('drop', Math.round(goldPerHour * quickHours)),
      quickSoul: boosted('drop', Math.round(soulPerHour * quickHours)),
      quickExp: boosted('exp', Math.round(expPerHour * quickHours)),
      adLeft: Math.max(0, adLimit - adUsed),
    };
  }

  function getShopRefreshSeconds() {
    return Math.max(0, Math.ceil((SHOP.refreshMinutes * 60000 - (App.API.now() - (state.shopUpdatedAt || 0))) / 1000));
  }

  function getIngotShopRefreshSeconds() {
    const mins = (INGOT_SHOP && INGOT_SHOP.refreshMinutes) || 60;
    return Math.max(0, Math.ceil((mins * 60000 - (App.API.now() - (state.ingotShopUpdatedAt || 0))) / 1000));
  }

  const g = (generalId) => ({ generalId });
  const b = (beastId) => ({ beastId });

  async function setLineup(generalIds) {
    const maxDep = P.maxDeploy || 5;
    const clean = (generalIds || []).filter((id, idx, arr) => id && getEffectiveGeneral(id) && arr.indexOf(id) === idx).slice(0, maxDep);
    if (!clean.length) {
      App.UI.showToast('至少派遣 1 名将领上阵！', '#f87171');
      return { ok: false };
    }
    const res = await act('/api/general/deploy', { generalIds: clean }, { quietFail: true });
    if (res && res.ok) return res;

    // 平滑兼容尚未重启的旧版后端（仅接受单将 generalId 的 toggleDeploy）
    const cur = (state.deployIds || []).slice();
    const toRemove = cur.filter((id) => clean.indexOf(id) < 0);
    const toAdd = clean.filter((id) => cur.indexOf(id) < 0);
    if (cur.length <= 1 && toAdd.length > 0 && toRemove.length > 0) {
      const rFirst = await act('/api/general/deploy', { generalId: toAdd.shift() }, { silent: true });
      if (!rFirst.ok) return rFirst;
    }
    for (const id of toRemove) {
      const rOff = await act('/api/general/deploy', { generalId: id }, { silent: true });
      if (!rOff.ok) return rOff;
    }
    for (const id of toAdd) {
      const rOn = await act('/api/general/deploy', { generalId: id }, { silent: true });
      if (!rOn.ok) return rOn;
    }
    App.UI.showToast(`出战阵容已更新（已派遣 ${state.deployIds.length}/${maxDep} 名将）！`, '#4ade80');
    return { ok: true };
  }

  App.State = {
    get STAMINA_MAX() { return P.staminaMax; },
    get BEAST_UNLOCK_LORD_LV() { return P.beastUnlockLordLv; },
    get SHOP_REFRESH_COST() { return SHOP.refreshCost; },
    get INGOT_SHOP_REFRESH_COST() { return (INGOT_SHOP && INGOT_SHOP.refreshCost) || 2; },
    get INGOT_EXCHANGE_RATE() { return P.ingotExchangeRate || 10000; },
    SIGN_REWARDS,
    DAILY_QUEST_DEFS,
    QUEST_BOXES,
    ACHIEVEMENTS,
    get: () => state,
    getRevision: () => saveRevision,
    getTodayKey,
    getProfile: () => profile,
    setProfile: (p) => Object.assign(profile, p || {}),
    rename: (name) => act('/api/player/rename', { name }),
    isBusy: () => busy,
    applyServerSave, act, featureLockLv, checkFeature,
    // ---- 只读计算（展示用）
    getExpForNextLevel, getItemCount, getItemCountByCat, canFreeSignToday,
    hasUnclaimedQuestOrBox, hasUnclaimedAchievement, hasUnclaimedActivity,
    getGeneralMaxLv, getAdRewardAmount, getQuestReward, getQuestBoxReward, getActivePoints, getAchievementValue, getPatrolInfo,
    getCost, getStaminaCost,
    syncStamina, getNextStaminaSeconds, getEquippedMap, getBeastEquippedMap, getBeastExpNeed, getBeastStats,
    getGeneralStats, getGeneralPower, getStandaloneGeneralPower, getActiveRented, getEffectiveGeneral, getDeployableGeneralIds,
    getDeployHeroPower, getTeamPower, getAverageTeamLv, isStageUnlocked,
    computeRecruitChance, computeCatchChance, setBoosts, boosted, getBoosts: () => boosts,
    getShopOffers: () => state.shopOffers || [], getShopRefreshSeconds,
    getIngotShopOffers: () => state.ingotShopOffers || [], getIngotShopRefreshSeconds,
    // ---- 玩家操作（全部走后端）
    chooseFaction: (factionId) => act('/api/player/create', { factionId }),
    toggleDeploy: (id) => act('/api/general/deploy', g(id)),
    setLineup,
    upgradeGeneral: (id, times) => act('/api/general/upgrade', { generalId: id, times: times || 1 }),
    starUpGeneral: (id) => act('/api/general/star-up', g(id)),
    ascendGeneral: (id, path) => act('/api/general/ascend', { generalId: id, path }, { color: path === 'xian' ? '#67e8f9' : '#f472b6' }),
    ascendUpGeneral: (id) => act('/api/general/ascend-up', { generalId: id }, { color: '#fde047' }),
    switchAscendGeneral: (id) => act('/api/general/ascend-switch', { generalId: id }, { color: '#38bdf8' }),
    exileGeneral: (id) => act('/api/general/exile', g(id)),
    publishHire: (generalId, pricePerHour) => act('/api/hire/publish', { generalId, pricePerHour }, { color: '#fde047' }),
    repriceHire: (id, pricePerHour) => act('/api/hire/reprice', { id, pricePerHour }, { color: '#fde047' }),
    recallHire: (id) => act('/api/hire/recall', { id }, { color: '#4ade80' }),
    rentHire: (id, hours) => act('/api/hire/rent', { id, hours }, { color: '#fde047' }),
    extendHire: (id, hours) => act('/api/hire/extend', { id, hours }, { color: '#fde047' }),
    equipItem: (generalId, uid) => act('/api/equip/wear', { generalId, uid }, { silent: true }),
    equipBeastItem: (beastId, uid) => act('/api/equip/wear', { beastId, uid }),
    unequipItem: (uid) => act('/api/equip/take-off', { uid }, { silent: true }),
    enhanceEquip: (uid, times) => act('/api/equip/enhance', { uid, times: times || 1 }),
    upgradeTroop: (troopId) => act('/api/equip/troop-upgrade', { troopId }),
    towerIdle: () => act('/api/tower/idle', {}, { color: '#fde047' }),
    starUpEquip: (uid) => act('/api/equip/star-up', { uid }),
    advanceEquip: (uid) => act('/api/equip/advance', { uid }),
    synthesizeEquip: (uids) => act('/api/equip/synthesize', { uids }, { color: '#fde047' }),
    forgeOreEquip: () => act('/api/equip/forge-ore', {}, { color: '#fde047' }),
    forgeSilkEquip: () => act('/api/equip/forge-silk', {}, { color: '#fde047' }),
    reforgeEquip: (uid) => act('/api/equip/reforge', { uid }, { color: '#4ade80' }),
    lockEquipAffix: (uid, index) => act('/api/equip/lock-affix', { uid, index }, { silent: true }),
    unlockArtifact: (artifactId) => act('/api/equip/artifact-unlock', { artifactId }, { color: '#fde047' }),
    upgradeArtifact: (artifactId, useTribute) => act('/api/equip/artifact-upgrade', { artifactId, useTribute: !!useTribute }, { color: '#fde047' }),
    equipArtifact: (artifactId) => act('/api/equip/artifact-equip', { artifactId: artifactId || null }),
    demonRedeem: (id) => act('/api/demon/redeem', { id }),
    arenaReward: () => act('/api/arena/reward', {}, { color: '#fde047' }),
    shareClaim: () => act('/api/share/claim', {}, { color: '#fde047' }),
    bindInviter: (code, quiet) => act('/api/invite/bind', { code: String(code) }, quiet ? { quietFail: true, parallel: true } : { color: '#fde047' }),
    claimInvite: (count) => act('/api/invite/claim', { count }, { color: '#fde047' }),
    sellEquip: (uid) => act('/api/equip/sell', { uid }, { color: '#fde047' }),
    sellAllBlueEquips: () => act('/api/equip/sell-all-blue', {}, { color: '#fde047' }),
    upgradeBeast: (id) => act('/api/beast/feed', b(id)),
    feedBeastScroll: (id) => act('/api/beast/feed-scroll', b(id)),
    starUpBeast: (id) => act('/api/beast/star-up', b(id)),
    bindBeastToGeneral: (beastId, generalId) => act('/api/beast/bind', { beastId, generalId }, { silent: true }),
    setActiveBeast: (beastId) => act('/api/beast/active', { beastId: beastId || null }, { silent: true }),
    useOrOpenItem: (itemId, count) => act('/api/item/use', { itemId, count: count || 1 }, { color: '#fde047' }),
    sellItem: (itemId, count) => act('/api/item/sell', { itemId, count: count || 1 }, { color: '#fde047' }),
    claimSignDay: (ad) => act('/api/sign/claim', { ad: !!ad }, { color: '#fde047' }),
    claimQuest: (questId) => act('/api/quest/claim', { questId }),
    claimQuestBox: (boxId) => act('/api/quest/box', { boxId }, { color: '#fde047' }),
    claimAchievement: (id) => act('/api/achievement/claim', { id }, { color: '#fde047' }),
    claimPatrol: (quick, ad) => act('/api/patrol/claim', { quick: !!quick, ad: !!ad }, { color: '#fde047' }),
    spinWheel: (ingotCost) => act('/api/wheel/spin', ingotCost > 0 ? { ingotCost: Math.floor(ingotCost) } : {}, { defer: true, silent: true }),
    claimAd: (type) => act('/api/ad/claim', { type }),
    exchangeCurrency: (direction, amount) => act('/api/shop/exchange', { direction, amount: Math.floor(Number(amount) || 0) }, { color: '#fde047' }),
    openShop: () => act('/api/shop/open', {}, { silent: true, quietFail: true, parallel: true }),
    refreshShop: (ad) => act('/api/shop/refresh', { ad: !!ad }, { color: '#fde047' }),
    buyShopOffer: (index) => act('/api/shop/buy', { index }),
    openIngotShop: () => act('/api/shop/ingot/open', {}, { silent: true, quietFail: true, parallel: true }),
    refreshIngotShop: (ad) => act('/api/shop/ingot/refresh', { ad: !!ad }, { color: '#fde047' }),
    buyIngotShopOffer: (index) => act('/api/shop/ingot/buy', { index }, { color: '#fde047' }),
    sweepStage: (stage, count) => act('/api/stage/sweep', { target: String(stage.order), count: count || 1 }, { silent: true }),
    startBattle: (mode, target) => act('/api/battle/start', { mode, target: String(target) }, { silent: true }),
    finishBattle: (battleId, win, score) => act('/api/battle/finish', { battleId, win, score: score || 0 }, { silent: true, parallel: true }),
    battlePill: (battleId) => act('/api/battle/pill', { battleId }, { parallel: true }),
    doubleReward: (battleId) => act('/api/battle/double', { battleId }),
    recruit: (battleId, ad) => act('/api/battle/recruit', { battleId, ad: !!ad }, { silent: true }),
    catchBeast: (battleId, goldRope) => act('/api/battle/catch', { battleId, goldRope: !!goldRope }, { silent: true }),
    refresh: () => App.API.get('/api/player/state').then((res) => { if (res && res.ok && res.profile) Object.assign(profile, res.profile); if (res && res.ok && res.save) applyServerSave(res.save, res.saveVersion); return res; }),
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
