(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const WORLD_W = 1760;
  const LANE_MIN_Y = 205;
  const LANE_MAX_Y = 382;

  function getPlayerCampFrontX(battle) {
    return (battle && battle.playerBase && battle.playerBase.alive) ? (battle.playerBase.x + 144) : 115;
  }

  function getEnemyCampFrontX(battle) {
    return (battle && battle.enemyBase && battle.enemyBase.alive) ? (battle.enemyBase.x - 134) : (WORLD_W - 55);
  }

  function clampUnitX(battle, u, nextX) {
    const minX = (u && u.side === 'player' && !u.isProp) ? getPlayerCampFrontX(battle) : 55;
    const maxX = (u && u.side === 'enemy' && !u.isProp) ? getEnemyCampFrontX(battle) : (WORLD_W - 55);
    return Math.max(minX, Math.min(maxX, nextX));
  }

  // 兵种卡由后端配置下发
  const TROOP_CARDS = App.Config.TROOP_CARDS;

  const MANUAL_AIM_SKILLS = new Set([
    'fire_aoe', 'freeze_aoe', 'thunder_aoe', 'wushuang_aoe',
    'pierce_column', 'precision_mercy', 'heavy_cleave', 'poison_curse',
  ]);

  function pickGeneralSpriteKey(gid, weaponEq) {
    if (App.Config.resolveGeneralCombatProfile) {
      return App.Config.resolveGeneralCombatProfile(gid, weaponEq).spriteKey;
    }
    const g = App.Config.GENERALS[gid];
    if (!g) return 'unit_gen_silver';
    if (g.gender === 'female') return 'unit_gen_female';
    if (g.troopId === 'mage') return 'unit_gen_mage';
    return 'unit_gen_silver';
  } 

  // 根据兵种、武将类型与已穿戴武器匹配专属武器模型与手部动作（弯弓搭箭 / 羽扇施法 / 挺枪猛戳 / 佩剑横斩 / 刀戟重劈）
  function inferAttackStyle(u) {
    if (!u) return 'cleave';
    if (u.kind === 'beast') return 'beast';
    if (u.kind === 'soldier') {
      if (u.id === 'archer') return 'bow';
      if (u.id === 'mage' || u.isMagic) return 'fan';
      if (u.id === 'pike' || u.id === 'cavalry') return 'thrust';
      return 'cleave';
    }
    const cfg = u.cfg || App.Config.GENERALS[u.id];
    const eqW = u.equips && u.equips.weapon;
    if (App.Config.resolveGeneralCombatProfile) {
      const prof = App.Config.resolveGeneralCombatProfile(cfg || u.id, eqW);
      u.weaponKind = prof.weaponKind;
      u.isMagic = prof.isMagic;
      return prof.atkStyle;
    }
    return 'thrust';
  }

  function isSpriteMounted(spriteKey, kind, troopId) {
    if (kind === 'general') return true;
    if (troopId === 'mage') return false;
    if (troopId === 'cavalry') return true;
    const s = String(spriteKey || '');
    return s.startsWith('battle_gen_') || s === 'unit_cavalry' || s === 'unit_cavalry_enemy' || s === 'unit_gen_silver' || s === 'unit_gen_heavy' || s === 'unit_gen_mage' || s === 'unit_gen_female';
  }

  function makeBattleArtifact(side, artId, lv, initX, initY) {
    const cfg = artId && App.Config.ARTIFACTS ? App.Config.ARTIFACTS[artId] : null;
    const effLv = Math.max(1, Number(lv) || 1);
    if (!cfg || effLv <= 0) return null;
    const qCol = cfg.quality === 'gold' ? '#facc15' : (cfg.quality === 'purple' ? '#c084fc' : '#38bdf8');
    const subCol = cfg.quality === 'gold' ? '#fef08a' : (cfg.quality === 'purple' ? '#f5d0fe' : '#bae6fd');
    const interval = cfg.quality === 'gold' ? 5.8 : (cfg.quality === 'purple' ? 6.5 : 7.2);
    const imgKey = cfg.imgKey || ('art_' + artId);
    if (App.Assets && App.Assets.get) App.Assets.get(imgKey);
    return {
      side,
      id: artId,
      lv: effLv,
      cfg,
      name: cfg.name || '镇军法宝',
      title: cfg.title || '镇军圣器',
      quality: cfg.quality || 'blue',
      imgKey,
      color: qCol,
      subColor: subCol,
      x: initX,
      y: initY,
      facing: side === 'player' ? 1 : -1,
      pulseTimer: side === 'player' ? 3.0 : 4.2,
      pulseInterval: interval,
      castFlash: 0,
      introBlessed: false,
    };
  }

  function createBattle(opts) {
    const mode = opts.mode || 'city';
    const level = opts.level;
    const arenaMatch = opts.arenaMatch || null;
    // 共享血量 BOSS：血量与限时以服务端开战时返回的为准
    if (level && level.raid && opts.serverBattle) {
      level.raid.hp = opts.serverBattle.bossHp || level.raid.hp;
      level.raid.maxHp = opts.serverBattle.bossMaxHp || level.raid.maxHp;
      level.raid.seconds = opts.serverBattle.seconds || level.raid.seconds;
    }
    const st = App.State.get();
    const fac = App.Config.FACTIONS[st.factionId];

    let uidCounter = 1;
    const units = [];
    const towers = [];

    // 1. 我方最多 5 名出战将领
    const artBonus = App.Config.computeArtifactBonus ? App.Config.computeArtifactBonus(st.ownedArtifacts, st.activeArtifactId) : { activeRage: 0 };
    st.deployIds.slice(0, 5).forEach((gid, idx) => {
      const cfg = App.Config.GENERALS[gid];
      const stats = App.State.getGeneralStats(gid);
      if (!cfg || !stats) return;
      const eqMap = App.State.getEquippedMap(gid);
      const eqArr = Object.values(eqMap);
      const cProf = App.Config.resolveGeneralCombatProfile
        ? App.Config.resolveGeneralCombatProfile(cfg, eqMap.weapon)
        : null;
      units.push({
        uid: uidCounter++,
        side: 'player',
        facing: 1,
        kind: 'general',
        id: gid,
        spriteKey: cProf ? cProf.spriteKey : pickGeneralSpriteKey(gid, eqMap.weapon),
        atkStyle: cProf ? cProf.atkStyle : null,
        weaponKind: cProf ? cProf.weaponKind : null,
        isMagic: cProf ? cProf.isMagic : false,
        name: `${stats.isRented ? '[佣]' : ''}${stats.ascendInfo ? `[${stats.ascendInfo.glyph}]` : ''}${cfg.name}`,
        ascend: stats.ascend || '',
        unitType: cfg.type,
        troopId: App.Config.getGeneralTroopId ? App.Config.getGeneralTroopId(gid) : (cfg.troopId || 'spear'),
        equips: eqMap,
        weaponVfx: App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(eqMap.weapon) : null,
        setVfx: (App.Config.resolveSetVfx ? App.Config.resolveSetVfx(eqArr) : null) || (stats.ascendInfo ? stats.ascendInfo.auraVfx : null),
        needsManualAim: !(cfg.skillPower === 0) && !cfg.isFullscreenSkill && !/【全屏/.test(cfg.skillDesc || '') && MANUAL_AIM_SKILLS.has(cfg.skillType),
        x: 356 + (idx % 2) * 48,
        y: 214 + idx * 39,
        maxHp: stats.hp,
        hp: stats.hp,
        atk: Math.round(stats.atk * (fac.atkMult || 1)),
        def: stats.def,
        crit: stats.crit,
        critDmg: stats.critDmg || 0,
        lifesteal: stats.lifesteal || 0,
        dmgReduce: stats.dmgReduce || 0,
        skillDmgPct: stats.skillDmgPct || 0,
        spdPct: stats.spdPct || 0,
        spd: 122 + (cfg.type === 'cavalry' ? 20 : 0),
        range: (cProf ? cProf.isRanged : (cfg.type === 'archer')) ? 200 : 54,
        rage: Math.min(100, 25 + (stats.initRage || artBonus.activeRage || 0)), // ★ 开局蓄势怒气 + 套装与供奉法宝先机怒气！
        atkTimer: 0.35,
        attackAnim: 0,
        runPhase: Math.random() * 6,
        stunTimer: 0,
        hitFlash: 0,
        moving: false,
        alive: true,
        cfg,
      });
    });

    // 2. 我方巨型出战神兽（完整继承神兽等级、星级与4槽神兽装备属性及外观！）
    let playerBeastUnit = null;
    if (st.activeBeastId && st.ownedBeasts[st.activeBeastId]) {
      const bCfg = App.Config.BEASTS[st.activeBeastId];
      const bStats = App.State.getBeastStats(st.activeBeastId);
      const bEquips = App.State.getBeastEquippedMap(st.activeBeastId);
      const bEqArr = Object.values(bEquips);
      playerBeastUnit = {
        uid: uidCounter++,
        side: 'player',
        facing: 1,
        kind: 'beast',
        id: bCfg.id,
        lv: bStats.lv,
        star: bStats.star,
        equips: bEquips,
        weaponVfx: App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(bEquips.beast_claw) : null,
        setVfx: App.Config.resolveSetVfx ? App.Config.resolveSetVfx(bEqArr) : null,
        spriteKey: 'beast_sprite_' + bCfg.id,
        name: bCfg.name,
        unitType: 'cavalry',
        x: 416,
        y: 298,
        maxHp: bStats.hp,
        hp: bStats.hp,
        atk: bStats.atk,
        def: bStats.def,
        crit: bStats.crit,
        critDmg: bStats.critDmg || 0,
        lifesteal: bStats.lifesteal || 0,
        dmgReduce: bStats.dmgReduce || 0,
        skillDmgPct: bStats.skillDmgPct || 0,
        spdPct: bStats.spdPct || 0,
        spd: 106,
        range: 74,
        rage: Math.min(100, 25 + (bStats.initRage || 0)), // 神兽初始灵气 + 兽装先机怒气
        atkTimer: 0.45,
        attackAnim: 0,
        runPhase: 0,
        stunTimer: 0,
        hitFlash: 0,
        moving: false,
        alive: true,
        beastCfg: bCfg,
      };
      units.push(playerBeastUnit);
    }

    const isRaid = !!(level && level.raid);
    const noTroops = isRaid || mode === 'arena';
    const deployedTroopSet = new Set(
      units.filter((u) => u.side === 'player' && u.kind === 'general' && u.troopId).map((u) => u.troopId)
    );
    const deployedTroopCards = noTroops ? [] : TROOP_CARDS.filter((c) => deployedTroopSet.has(c.id));
    if (!noTroops && deployedTroopCards.length > 0) {
      for (let i = 0; i < 4; i++) {
        const initCard = deployedTroopCards[i % deployedTroopCards.length];
        units.push(makeSoldier(uidCounter++, 'player', initCard, 548 + i * 22, 220 + (i % 4) * 42, Math.max(1, st.lordLevel)));
      }
    }

    let bossGeneralId = null;
    let targetBeastId = null;
    const dCfg = App.Config.DIFFICULTY || {};
    const diff = App.Config.getModeDifficulty(mode, level);
    const stageOrdBase = (level && level.order) || 1;
    const lvScale = (mode === 'city' && stageOrdBase > 3) ? (dCfg.stageLvScale || 1.10) : 1;
    const effStageLv = Math.max(1, Math.round(((level && level.recommendedLv) || 1) * lvScale));
    const sMult = mode === 'city' ? (dCfg.stageSoldierMult || 1.10) : 1;
    const enemySoldierMult = { hpMult: diff.hpMult * sMult, atkMult: diff.atkMult * sMult, defMult: diff.defMult };

    if (mode === 'arena' && arenaMatch) {
      const aSolMult = { hpMult: diff.hpMult / 1.15, atkMult: diff.atkMult / 1.12, defMult: 1 };
      arenaMatch.generals.slice(0, 5).forEach((gid, idx) => {
        const cfg = App.Config.GENERALS[gid];
        const stats = App.State.getGeneralStats(gid, arenaMatch.lv);
        if (!cfg || !stats) return;
        if (!bossGeneralId) bossGeneralId = gid;
        const oppEqMap = (arenaMatch.generalEquips && arenaMatch.generalEquips[gid]) || {};
        const oppEqArr = Object.values(oppEqMap);
        units.push({
          uid: uidCounter++,
          side: 'enemy',
          facing: -1,
          kind: 'general',
          id: gid,
          spriteKey: pickGeneralSpriteKey(gid, oppEqMap.weapon),
          equips: oppEqMap,
          weaponVfx: App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(oppEqMap.weapon) : null,
          setVfx: App.Config.resolveSetVfx ? App.Config.resolveSetVfx(oppEqArr) : null,
          name: cfg.name,
          unitType: cfg.type,
          x: WORLD_W - 356 - (idx % 2) * 45,
          y: 220 + idx * 36,
          maxHp: Math.round(stats.hp * diff.hpMult),
          hp: Math.round(stats.hp * diff.hpMult),
          atk: Math.round(stats.atk * diff.atkMult),
          def: stats.def,
          crit: 0.15,
          spd: 118 + (cfg.type === 'cavalry' ? 18 : 0),
          range: cfg.type === 'archer' ? 195 : 54,
          rage: 40,
          atkTimer: 0.5,
          attackAnim: 0,
          runPhase: Math.random() * 6,
          stunTimer: 0,
          hitFlash: 0,
          moving: false,
          alive: true,
          cfg,
        });
      });
      if (arenaMatch.beast) {
        const bCfg = App.Config.BEASTS[arenaMatch.beast];
        const sc = 1 + (arenaMatch.lv - 1) * 0.16;
        units.push({
          uid: uidCounter++, side: 'enemy', facing: -1, kind: 'beast',
          id: bCfg.id, spriteKey: 'beast_sprite_' + bCfg.id, name: bCfg.name, unitType: 'spear',
          x: WORLD_W - 420, y: 295,
          maxHp: Math.round(bCfg.hp * 0.85 * sc * aSolMult.hpMult), hp: Math.round(bCfg.hp * 0.85 * sc * aSolMult.hpMult),
          atk: Math.round(bCfg.atk * 0.55 * sc * aSolMult.atkMult), def: Math.round(bCfg.def * 0.65 * sc),
          crit: 0.18, spd: 74, range: 72, rage: 30, atkTimer: 0.7,
          attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true, beastCfg: bCfg,
        });
      }
    } else {
      // 平滑渐进难度曲线：首两关平稳上手，随章节推进与后台难度配置全面强化压迫感！
      const stageOrder = stageOrdBase;
      const stageLv = effStageLv;
      const isEarly = mode === 'city' && stageOrder <= 3;

      if (mode === 'beast' && level.beastId) {
        targetBeastId = level.beastId;
        const bCfg = App.Config.BEASTS[level.beastId];
        const mult = level.beastScale || 6.0;
        units.push({
          uid: uidCounter++, side: 'enemy', facing: -1, kind: 'beast',
          id: bCfg.id, spriteKey: 'beast_sprite_' + bCfg.id, name: bCfg.name, unitType: 'spear',
          isWildBeast: true,
          x: WORLD_W - 250, y: 298,
          maxHp: Math.round(bCfg.hp * 0.75 * mult * diff.hpMult),
          hp: Math.round(bCfg.hp * 0.75 * mult * diff.hpMult),
          atk: Math.round(bCfg.atk * 0.34 * (mult * 0.68) * diff.atkMult),
          def: Math.round(bCfg.def * 0.34 * 1.55 * diff.defMult),
          crit: 0.25, critDmg: 0.28, dmgReduce: 0.24, skillDmgPct: 0.22,
          spd: 72, range: 78, rage: 55,
          beastSkillTimer: 3.8,
          atkTimer: 0.70, attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true,
          beastCfg: bCfg,
        });
      }

      // Boss与副将数值倍率随关卡与后台配置增长（补偿中后期玩家星级、神装套装、法宝与仙魔养成跨度）
      const lateStageBoost = (mode === 'city' && stageOrder > 30) ? Math.pow(stageOrder - 30, 1.08) * 0.010 : 0;
      const bossHpCurve = mode === 'city'
        ? Math.min(dCfg.stageBossHpMax || 12.50, (dCfg.stageBossHpBase || 1.38) + stageOrder * (dCfg.stageBossHpGrowth || 0.022) + lateStageBoost)
        : 1.55;
      const bossAtkCurve = mode === 'city'
        ? Math.min(dCfg.stageBossAtkMax || 6.00, (dCfg.stageBossAtkBase || 1.15) + stageOrder * (dCfg.stageBossAtkGrowth || 0.010) + lateStageBoost * 0.45)
        : 1.28;
      const initRage = (mode === 'city' && stageOrder <= 1) ? 0 : Math.min(100, Math.max(0, dCfg.enemyInitRage !== undefined ? dCfg.enemyInitRage : 28));

      // 分轮作战：副将在中间几轮登场，守将（BOSS）只在最后一轮出现。副将不足时取关卡守将补位
      const plan = getRoundPlan(mode, level);
      // 前期章节（副将数为 0）不出副将，只保留守将
      const egList = (level.enemyGenerals || []).filter((e) => e.isBoss || mode !== 'city' || plan.subGenerals > 0);
      for (let k = 1; (mode === 'city' || mode === 'beast') && egList.filter((e) => !e.isBoss).length < plan.subGenerals && k <= 16; k++) {
        const refOrd = Math.max(1, (mode === 'beast' ? stageOrder + k * 3 : stageOrder - k));
        const prev = App.Config.STAGES[refOrd];
        if (prev && prev.bossId && !egList.some((e) => e.id === prev.bossId)) {
          egList.push({ id: prev.bossId, lv: Math.max(1, (level.recommendedLv || stageLv) - 1), isBoss: false });
        }
      }
      egList.forEach((eg, idx) => {
        const cfg = App.Config.GENERALS[eg.id];
        const egLv = mode === 'city' ? Math.max(1, Math.round((eg.lv || level.recommendedLv || 1) * lvScale)) : (eg.lv || stageLv);
        const stats = App.State.getGeneralStats(eg.id, egLv);
        if (!cfg || !stats) return;
        if (eg.isBoss || (!bossGeneralId && mode === 'city')) bossGeneralId = eg.id;
        const gHpMult = (eg.isBoss ? bossHpCurve : bossHpCurve * 0.90) * diff.hpMult;
        const gAtkMult = (eg.isBoss ? bossAtkCurve : bossAtkCurve * 0.92) * diff.atkMult;
        const tacScale = isEarly ? 0 : Math.max(0, egLv - 3);
        units.push({
          uid: uidCounter++, side: 'enemy', facing: -1, kind: 'general',
          id: eg.id, spriteKey: pickGeneralSpriteKey(eg.id), name: cfg.name, unitType: cfg.type,
          isBoss: !!eg.isBoss,
          x: WORLD_W - 360 - idx * 56, y: 252 + idx * 54,
          maxHp: Math.round(stats.hp * gHpMult),
          hp: Math.round(stats.hp * gHpMult),
          atk: Math.round(stats.atk * gAtkMult),
          def: Math.round(stats.def * (isEarly ? 0.96 : 1.18) * diff.defMult),
          crit: +Math.min(0.32, 0.14 + tacScale * 0.0012).toFixed(3),
          critDmg: +Math.min(0.50, tacScale * 0.003).toFixed(3),
          dmgReduce: isEarly ? 0 : +Math.min(0.36, 0.06 + tacScale * 0.0018).toFixed(3),
          skillDmgPct: +Math.min(0.45, tacScale * 0.0025).toFixed(3),
          spd: 112 + (cfg.type === 'cavalry' ? 18 : 0),
          range: cfg.type === 'archer' ? 195 : 54,
          rage: initRage, atkTimer: 0.70, attackAnim: 0, runPhase: Math.random() * 6,
          stunTimer: 0, hitFlash: 0, moving: false, alive: true, cfg,
        });
      });

      const guardCount = isRaid ? 0 : (mode === 'beast' ? 9 : Math.min(11, 3 + Math.floor(stageOrder / 2)));
      for (let i = 0; i < guardCount; i++) {
        const tCard = TROOP_CARDS[i % 4];
        units.push(makeSoldier(uidCounter++, 'enemy', tCard, 800 + (i % 4) * 120, 215 + (i % 4) * 42, stageLv, enemySoldierMult));
      }
    }

    // 魔将：体型巨大、血量与攻击按后台配置的倍率放大
    if (mode === 'demon' && level.demon) {
      units.filter((u) => u.side === 'enemy' && u.kind === 'general' && u.isBoss).forEach((u) => {
        u.maxHp = Math.round(u.maxHp * (level.demon.hpMult || 6));
        u.hp = u.maxHp;
        u.atk = Math.round(u.atk * (level.demon.atkMult || 1.8));
        if (level.demon.defMult) u.def = Math.round(u.def * level.demon.defMult);
        u.scale = level.demon.scale || 1.9;
        u.range = Math.round(u.range * 1.4);
        u.name = level.demon.name || u.name;
        // 共享血量 BOSS（世界 BOSS / 联盟 BOSS）：血量取服务端当前剩余值，本场造成的伤害会被统计上报
        if (level.raid) {
          u.maxHp = Math.max(1, level.raid.maxHp || u.maxHp);
          u.hp = Math.max(1, Math.min(u.maxHp, level.raid.hp || u.maxHp));
          u.isRaidBoss = true;
        }
        u.setVfx = {
          auraVfx: 'shadow_phantom',
          auraName: '魔神煞气阵',
          auraColor: level.demon.color || '#c084fc',
          auraSubColor: '#fca5a5',
          vfxTier: 3,
          quality: 'gold',
        };
        u.weaponVfx = {
          active: true,
          atkVfx: 'blood_crescent',
          color: level.demon.color || '#ef4444',
          coreColor: '#fde047',
          tex1: 'vfx_crimson_slash',
          tex2: 'vfx_tiger_roar',
          tier: 3,
          scaleMult: 1.35,
        };
      });
    }

    // 把敌军拆成多轮：第 1 轮只有守军，中间轮加入副将，最后一轮守将 / 神兽登场
    const roundQueue = [];
    let totalRounds = 1;
    if (mode !== 'arena') {
      const plan = getRoundPlan(mode, level);
      totalRounds = plan.rounds;
      const enemies = units.filter((u) => u.side === 'enemy');
      const bosses = enemies.filter((u) => u.isWildBeast || u.isBoss || (u.kind === 'general' && u.id === bossGeneralId));
      const subs = enemies.filter((u) => u.kind === 'general' && bosses.indexOf(u) < 0);
      const guards = enemies.filter((u) => u.kind === 'soldier');
      if (totalRounds > 1) {
        for (let i = units.length - 1; i >= 0; i--) if (units[i].side === 'enemy') units.splice(i, 1);
        const lv = effStageLv;
        const extraSoldiers = (mode === 'city' && stageOrdBase <= 2) ? 0 : Math.max(0, Math.round(dCfg.stageExtraSoldiers !== undefined ? dCfg.stageExtraSoldiers : 1));
        const subStart = Math.max(2, Math.ceil(totalRounds / 2));
        for (let r = 1; r <= totalRounds; r++) {
          const list = [];
          const n = Math.max(2, Math.min(10, Math.round(guards.length * (0.65 + 0.16 * r)) + extraSoldiers));
          for (let i = 0; i < n; i++) list.push(makeSoldier(uidCounter++, 'enemy', TROOP_CARDS[i % Math.min(4, TROOP_CARDS.length)], 0, 215 + (i % 4) * 42, lv, enemySoldierMult));
          if (r === totalRounds) bosses.forEach((b) => list.push(b));
          else if (r >= subStart && subs.length) list.push(subs.shift());
          list.forEach((u, i) => { u.x = (r === 1 ? 1040 : WORLD_W - 332) + (i % 4) * (r === 1 ? 52 : -28); });
          roundQueue.push(list);
        }
        subs.forEach((u) => roundQueue[totalRounds - 1].push(u)); // 轮数不够放的副将随守将一起出场
        roundQueue.shift().forEach((u) => units.push(u));
      }
    }

    // 特殊副本：清掉常规敌军，按副本规则布置（宝箱车、帅帐、粮车、凶兽、连闯五关等）
    const special = (level && level.special) ? buildSpecial(mode, level, units, towers, roundQueue, () => uidCounter++) : null;
    if (special && special.totalRounds) totalRounds = special.totalRounds;

    // ★ 布置双方大本营【主营】与【一上一下对称双箭垒】（享受演武营等级加成，且箭垒高血量耐战！）
    const campCfg = App.Config.TROOP_CAMP || {};
    const campStep = campCfg.statPerLevel || 0.08;
    const tLevels = st.troopLevels || {};
    const lordLv = Math.max(1, st.lordLevel || 1);
    const pLordGrowth = 1 + (lordLv - 1) * 0.12;
    const pBaseMult = pLordGrowth * (1 + (tLevels.base || 0) * campStep);
    const pTowerMult = pLordGrowth * (1 + (tLevels.tower || 0) * campStep);

    let playerBase = units.find((u) => u.side === 'player' && u.isBase) || null;
    if (playerBase) {
      // 剑阁死守的帅帐同步享受演武营【中军主营】等级加成
      const boost = 1 + (tLevels.base || 0) * campStep;
      playerBase.maxHp = Math.round(playerBase.maxHp * boost);
      playerBase.hp = playerBase.maxHp;
      playerBase.isMainBase = true;
    } else if (mode !== 'escort') {
      const pBaseHp = Math.round((campCfg.baseHp || 3800) * pBaseMult);
      const pBaseDef = Math.round((campCfg.baseDef || 45) * (1 + (lordLv - 1) * 0.05) * (1 + (tLevels.base || 0) * campStep));
      playerBase = makeProp(uidCounter++, 'player', '我方主营', '', 176, 340, pBaseHp, {
        isBase: true,
        isMainBase: true,
        def: pBaseDef,
        propSprite: 'prop_command_tent',
      });
      units.push(playerBase);
    }

    // 我方上下双箭垒（大幅前推至 x=532，与主营之间留出宽敞点兵与撤退驻防校场！）
    const pTowerHp = Math.round((campCfg.towerHp || 1850) * pTowerMult);
    const pTowerAtk = Math.round((campCfg.towerAtk || 56) * (1 + (lordLv - 1) * 0.10) * (1 + (tLevels.tower || 0) * campStep));
    const pTowerDef = Math.round((campCfg.towerDef || 32) * (1 + (lordLv - 1) * 0.05) * (1 + (tLevels.tower || 0) * campStep));
    [
      { y: 226, name: '我方上箭垒' },
      { y: 364, name: '我方下箭垒' },
    ].forEach((pos, idx) => {
      towers.push({
        uid: uidCounter++,
        side: 'player',
        name: pos.name,
        x: 532,
        y: pos.y,
        maxHp: pTowerHp,
        hp: pTowerHp,
        atk: pTowerAtk,
        def: pTowerDef,
        atkTimer: 0.65 + idx * 0.35,
        hitFlash: 0,
        alive: true,
      });
    });

    // 敌方上下双箭垒（对称前推至 WORLD_W - 532，与敌军主营拉开宽阔纵深间距） + 敌方主营
    const refEnemyLv = mode === 'arena' && arenaMatch ? arenaMatch.lv : (special ? ((special.cfg && special.cfg.enemyLv) || 10) : effStageLv);
    const isEarlyCity = mode === 'city' && stageOrdBase <= 3;
    const eTowerScale = (dCfg.stageTowerMult || 1.38) * ((diff.hpMult + diff.atkMult) * 0.5);
    const fortHpCurve = (mode === 'arena' || isEarlyCity) ? 1 : (1 + Math.pow(Math.max(0, refEnemyLv - 4), 1.22) * 0.032);
    const fortAtkCurve = (mode === 'arena' || isEarlyCity) ? 1 : (1 + Math.pow(Math.max(0, refEnemyLv - 4), 1.12) * 0.020);
    let enemyBase = null;

    if (mode !== 'tomb' && mode !== 'treasury' && mode !== 'defend' && mode !== 'escort' && !(level && level.raid)) {
      const eTowerHp = mode === 'arena'
        ? Math.round((campCfg.towerHp || 1850) * (1 + (refEnemyLv - 1) * 0.12) * diff.hpMult)
        : Math.round((isEarlyCity ? (1250 + stageOrdBase * 240) : (1800 + refEnemyLv * 340)) * eTowerScale * fortHpCurve);
      const eTowerAtk = Math.round((isEarlyCity ? (28 + stageOrdBase * 5) : (48 + refEnemyLv * 8.2)) * diff.atkMult * fortAtkCurve);
      const eTowerDef = Math.round((32 + refEnemyLv * 2.6) * diff.defMult * Math.sqrt(fortAtkCurve));

      [
        { y: 226, name: '敌军上箭垒' },
        { y: 364, name: '敌军下箭垒' },
      ].forEach((pos, idx) => {
        towers.push({
          uid: uidCounter++,
          side: 'enemy',
          name: pos.name,
          x: WORLD_W - 532,
          y: pos.y,
          maxHp: eTowerHp,
          hp: eTowerHp,
          atk: eTowerAtk,
          def: eTowerDef,
          atkTimer: 0.85 + idx * 0.35,
          hitFlash: 0,
          alive: true,
        });
      });

      if (mode !== 'beast' && mode !== 'chaos') {
        const eBaseHp = mode === 'arena'
          ? Math.round((campCfg.baseHp || 3800) * (1 + (refEnemyLv - 1) * 0.12) * diff.hpMult)
          : Math.round((isEarlyCity ? (2100 + stageOrdBase * 340) : (3000 + refEnemyLv * 440)) * eTowerScale * fortHpCurve);
        const eBaseDef = Math.round((38 + refEnemyLv * 2.8) * diff.defMult * Math.sqrt(fortAtkCurve));
        enemyBase = makeProp(uidCounter++, 'enemy', '敌军主营', '', WORLD_W - 176, 338, eBaseHp, {
          isBase: true,
          isMainBase: true,
          def: eBaseDef,
          propSprite: 'city_fortress',
        });
        units.push(enemyBase);
      }
    }

    const chapterNum = (level && level.chapter) || 1;
    const chapterTheme = (level && level.mapTheme) || (App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(chapterNum) : null);
    const battleBgKey = App.Config.resolveBattleBgKey
      ? App.Config.resolveBattleBgKey({ mode, level, chapter: chapterNum, chapterTheme, biome: (level && level.biome) || 'plains' })
      : ((chapterTheme && chapterTheme.battleKey) || 'bg_battle');
    if (App.Assets && App.Assets.get) App.Assets.get(battleBgKey);
    // ★ 自然灾害并非每关必出：仅在关卡/神兽战中以约 40% 概率随机降临（第1关与演武场保持晴朗），每次进入关卡天象未知！
    const stageOrdForDis = (level && level.order) || 1;
    const forcedDisaster = level && level.forceDisasterId;
    const enableRandomDisaster = forcedDisaster ? true : !(level && level.noDisaster) && mode !== 'arena' && !(mode === 'city' && stageOrdForDis <= 1) && Math.random() < 0.40;

    function finalizeUnits(list) {
      list.forEach((u) => {
        if (u.kind === 'general' && App.Config.resolveGeneralCombatProfile) {
          const prof = App.Config.resolveGeneralCombatProfile(u.cfg || u.id, u.equips && u.equips.weapon);
          u.spriteKey = prof.spriteKey;
          u.fallbackSpriteKey = prof.fallbackSpriteKey;
          u.battleSpec = prof.battleSpec;
          if (!u.scale && prof.scale && prof.scale !== 1) u.scale = prof.scale;
          u.atkStyle = prof.atkStyle;
          u.weaponKind = prof.weaponKind;
          u.isMagic = prof.isMagic;
          if (!u.isRaidBoss && !(battleSpecKeepRange(u))) {
            u.range = prof.isRanged ? (u.side === 'player' ? 200 : 195) : 56;
          } else if (prof.isRanged && (!u.range || u.range < 160)) {
            u.range = u.side === 'player' ? 200 : 195;
          }
          // 触发当前关卡/演武场出场武将独立对战贴图的即时异步预热
          if (App.Assets && App.Assets.get) App.Assets.get(u.spriteKey);
        } else {
          u.atkStyle = u.atkStyle || inferAttackStyle(u);
        }
        u.isMounted = isSpriteMounted(u.spriteKey, u.kind);
        u.atkProg = 0;
        u.comboStep = (u.uid || 0) % 3;
        u.atkDur = u.atkStyle === 'bow' ? 0.58 : (u.atkStyle === 'fan' ? 0.56 : (u.atkStyle === 'cleave' ? 0.54 : (u.atkStyle === 'sword' ? 0.48 : 0.50)));
        u.atkReleased = false;
        u.atkTarget = null;
        u.knockX = 0;
        u.hitRecoil = 0;
        u.moveBlend = 0;
        u.inCombat = false;
        u.idlePhase = ((u.uid || 1) * 1.73) % (Math.PI * 2);
        u.engageSlotY = (((u.uid || 1) % 5) - 2) * 13;
        u.rangeJitter = (((u.uid || 1) * 7) % 13) - 6;
      });
      return list;
    }

    function battleSpecKeepRange(u) {
      return !!(u && u.scale && u.scale > 1.35);
    }

    // 伐木营与军粮仓演武营等级加成（提升开局储量与每 2 秒自动产出速率！）
    const lumberLv = tLevels.lumber || 0;
    const granaryLv = tLevels.granary || 0;
    const initWood = (campCfg.initWoodBase || 120) + lumberLv * (campCfg.initWoodPerLv || 10);
    const initFood = (campCfg.initFoodBase || 120) + granaryLv * (campCfg.initFoodPerLv || 10);
    const woodTick = (campCfg.lumberBase || 10) + lumberLv * (campCfg.lumberPerLv || 1);
    const foodTick = (campCfg.granaryBase || 10) + granaryLv * (campCfg.granaryPerLv || 1);

    // ★ 我方与敌方（演武场对手）供奉出战的【镇军法宝】随军悬浮真身！
    const pArtId = st.activeArtifactId;
    const pArtLv = (pArtId && st.ownedArtifacts && st.ownedArtifacts[pArtId]) || 0;
    const playerArtifact = (pArtId && pArtLv > 0) ? makeBattleArtifact('player', pArtId, pArtLv, 336, 148) : null;
    const enemyArtifact = (mode === 'arena' && arenaMatch && arenaMatch.activeArtifactId)
      ? makeBattleArtifact('enemy', arenaMatch.activeArtifactId, arenaMatch.activeArtifactLv || 1, WORLD_W - 336, 148)
      : null;

    if (App.Audio) App.Audio.playSfx('battle_start');

    return {
      mode, level, arenaMatch,
      chapter: chapterNum,
      chapterTheme,
      battleBgKey,
      biome: (level && level.biome) || 'plains',
      worldW: WORLD_W,
      cameraX: 0,
      autoCam: App.Settings ? !!App.Settings.get('autoCamera') : true,
      order: (level && level.special && (mode === 'defend' || mode === 'escort')) ? 'hold' : 'attack',
      wood: initWood,
      food: initFood,
      woodTick,
      foodTick,
      adSupplyUsed: false,
      resTimer: 0,
      noTroops,
      deployedTroopIds: noTroops ? [] : deployedTroopCards.map((c) => c.id),
      autoTroops: {},
      autoTroopCursor: 0,
      autoTroopTimer: 0,
      autoTroopInterval: 1.15,
      centerNode: noTroops ? null : { x: 880, y: 185, owner: null },
      playerBase,
      enemyBase,
      playerArtifact,
      enemyArtifact,
      enemyWaveTimer: mode === 'city' && level && level.order <= 6 ? 8.8 : 6.0,
      // ★ 随机自然灾害系统（按局随机决定是否出现，且单局最多触发 1~2 次，严格互斥绝不重叠）
      hasDisaster: enableRandomDisaster,
      disasterCount: 0,
      maxDisasters: enableRandomDisaster ? (Math.random() < 0.72 ? 1 : 2) : 0,
      activeDisaster: null,
      disasterRemain: 0,
      nextDisasterTimer: 7.5 + Math.random() * 8.5,
      hailTickTimer: 0,
      plagueTickTimer: 0,
      introTimer: 1.45, // ★ 开局两军主将【将领应战】高清立绘交锋特写动画！
      leadPlayerGenId: st.deployIds[0],
      leadEnemyGenId: bossGeneralId,
      leadEnemyBeastId: targetBeastId,
      uidCounter,
      units: finalizeUnits(units),
      raidTimeLeft: (level && level.raid) ? (level.raid.seconds || 75) : 0, raidDamage: 0,
      special, timeLeft: special ? (special.duration || 0) : 0, specialTimer: 0, order0: special && special.startOrder,
      round: 1, totalRounds, roundQueue: roundQueue.map((l) => finalizeUnits(l)), roundCountdown: 0, roundWaiting: false,
      playerBeastUnit,
      dyingUnits: [],
      dustParticles: [],
      sparks: [],
      skillEffects: [], // ★ 华丽元素大招特效层（狂雷/火柱/冰刺/半月刀罡）
      aoeZones: [],
      aimingUnit: null,
      towers,
      projectiles: [],
      floatTexts: [],
      banner: null,
      shakeTimer: 0,
      animTime: 0,
      speedMult: 1,
      userPaused: false,
      adPaused: false,
      settingsPaused: false,
      retreatConfirmOpen: false,
      paused: false,
      status: 'fighting',
      captiveGeneralId: mode === 'city' ? bossGeneralId : null,
      recruitState: 'pending',
      recruitTries: 0,
      recruitDuplicate: false,
      captiveBeastId: mode === 'beast' ? targetBeastId : null,
      catchState: 'pending',
      catchTries: 0,
      droppedEquip: null,
      droppedMat: null,
      // 服务端战斗会话：奖励数值、结算、招降与捕获都由服务端决定
      serverId: opts.serverBattle ? opts.serverBattle.id : null,
      settling: false,
      settled: false,
      expGain: opts.serverBattle ? opts.serverBattle.exp : 0,
      levelUpInfo: null,
      rewardClaimed: false,
      doubleAdUsed: false,
      goldReward: opts.serverBattle ? opts.serverBattle.gold : 0,
      soulReward: opts.serverBattle ? opts.serverBattle.soul : 0,
    };
  }

  function makeEnemyGeneral(uid, gid, lv, x, y, hpMult, atkMult, isBoss, defMult, initRage) {
    const cfg = App.Config.GENERALS[gid];
    const stats = App.State.getGeneralStats(gid, lv);
    if (!cfg || !stats) return null;
    const tacScale = Math.max(0, (lv || 1) - 3);
    return {
      uid, side: 'enemy', facing: -1, kind: 'general', id: gid, spriteKey: pickGeneralSpriteKey(gid), name: cfg.name, unitType: cfg.type, isBoss: !!isBoss,
      x, y, maxHp: Math.round(stats.hp * hpMult), hp: Math.round(stats.hp * hpMult), atk: Math.round(stats.atk * atkMult), def: Math.round(stats.def * (defMult || 1)),
      crit: +Math.min(0.32, 0.14 + tacScale * 0.0012).toFixed(3),
      critDmg: +Math.min(0.50, tacScale * 0.003).toFixed(3),
      dmgReduce: +Math.min(0.36, 0.06 + tacScale * 0.0018).toFixed(3),
      skillDmgPct: +Math.min(0.45, tacScale * 0.0025).toFixed(3),
      spd: 112 + (cfg.type === 'cavalry' ? 18 : 0), range: cfg.type === 'archer' ? 195 : 54, rage: initRage || 0, atkTimer: 0.70, attackAnim: 0, runPhase: Math.random() * 6,
      stunTimer: 0, hitFlash: 0, moving: false, alive: true, cfg,
    };
  }

  // 不会移动和攻击的目标物：宝箱车、金矿、帅帐、粮车
  function makeProp(uid, side, name, icon, x, y, hp, extra) {
    return Object.assign({
      uid, side, facing: side === 'player' ? 1 : -1, kind: 'prop', isProp: true, id: 'prop', name, icon, x, y, maxHp: hp, hp,
      atk: 0, def: 24, crit: 0, spd: 0, range: 0, atkTimer: 999, attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true,
    }, extra || {});
  }

  function buildSpecial(mode, level, units, towers, roundQueue, nextUid) {
    const sp = level.special, cfg = sp.cfg || {}, lv = cfg.enemyLv || 10;
    const diff = App.Config.getModeDifficulty(mode, level);
    const dCfg = App.Config.DIFFICULTY || {};
    const initRage = Math.min(100, Math.max(0, dCfg.enemyInitRage !== undefined ? dCfg.enemyInitRage : 25));
    for (let i = units.length - 1; i >= 0; i--) if (units[i].side === 'enemy') units.splice(i, 1);
    towers.length = 0;
    const cards = TROOP_CARDS, nCard = Math.max(1, Math.min(4, cards.length));
    const soldiers = (n, x, lvl, namePrefix) => Array.from({ length: n }, (_, i) => {
      const u = makeSoldier(nextUid(), 'enemy', cards[i % nCard], x + (i % 4) * 30, 215 + (i % 4) * 42, lvl, diff);
      if (namePrefix) u.name = namePrefix;
      return u;
    });
    const out = { type: mode, cfg };
    if (mode === 'tomb') {
      const total = (cfg.chests || 7) + (cfg.mines || 5);
      for (let i = 0; i < total; i++) {
        const mine = i < (cfg.mines || 5);
        units.push(makeProp(nextUid(), 'enemy', mine ? '黄金矿洞' : '宝箱车', '', 520 + i * 86, 226 + (i % 3) * 64, Math.round((mine ? 880 : 680) * (1 + lv * 0.18) * diff.hpMult), {
          isLoot: true,
          def: 36 + lv * 2,
          propSprite: mine ? 'building_goldmine' : 'prop_treasure_cart',
        }));
      }
      soldiers(9, 620, lv, '护陵金吾卫').forEach((u) => units.push(u));
      const tombGuard = makeEnemyGeneral(nextUid(), 'zhanghe', lv + 1, 960, 286, 1.45 * diff.hpMult, 1.12 * diff.atkMult, false, diff.defMult, initRage);
      if (tombGuard) { tombGuard.name = '镇陵校尉·' + tombGuard.name; units.push(tombGuard); }
      out.duration = cfg.duration || 60;
      out.lootTotal = total;
    } else if (mode === 'treasury') {
      const chests = cfg.chests || 10, mines = cfg.mines || 6;
      const total = chests + mines;
      for (let i = 0; i < total; i++) {
        const mine = i < mines;
        units.push(makeProp(nextUid(), 'enemy', mine ? '郿坞金窖' : '赤金粮车', '', 500 + i * 74, 218 + (i % 4) * 48, Math.round((mine ? 960 : 720) * (1 + lv * 0.18) * diff.hpMult), {
          isLoot: true,
          def: 36 + lv * 2,
          propSprite: mine ? 'building_goldmine' : 'prop_treasure_cart',
        }));
      }
      soldiers(10, 600, lv, '西凉虎贲').forEach((u) => units.push(u));
      const guard = makeEnemyGeneral(nextUid(), 'dongzhuo', lv + 2, 980, 290, 1.65 * diff.hpMult, 1.18 * diff.atkMult, false, diff.defMult, initRage);
      if (guard) { guard.name = '郿坞都尉·' + guard.name; units.push(guard); }
      out.duration = cfg.duration || 65;
      out.lootTotal = total;
    } else if (mode === 'defend') {
      units.push(makeProp(nextUid(), 'player', '帅帐大营', '', 104, 302, cfg.baseHp || 9000, { isBase: true, def: 40, propSprite: 'prop_command_tent' }));
      const waves = cfg.waves || 15, names = cfg.waveNames || [];
      for (let w = 1; w <= waves; w++) {
        const list = soldiers(Math.min(9, 4 + Math.floor(w / 2)), WORLD_W - 120, lv + Math.floor(w / 3), names[(w - 1) % Math.max(1, names.length)]);
        if (w % 5 === 0) list.push(makeProp(nextUid(), 'enemy', '精英冲车', '', WORLD_W - 60, 300, Math.round(950 * (1 + lv * 0.16) * diff.hpMult), { isRam: true, propSprite: 'prop_siege_ram', spd: 48, atk: Math.round((65 + lv * 10) * diff.atkMult), range: 60, atkTimer: 1 }));
        roundQueue.push(list);
      }
      roundQueue.shift().forEach((u) => units.push(u));
      out.totalRounds = waves;
      out.duration = cfg.duration || 90;
      out.waveEvery = out.duration / waves;
    } else if (mode === 'pass' || mode === 'xian' || mode === 'mo') {
      const defPasses = mode === 'xian'
        ? [{ name: '南天仙门', generalId: 'zhugeliang' }, { name: '紫霄雷坛', generalId: 'zhaoyun' }, { name: '九天凌霄台', generalId: 'guanyu' }]
        : (mode === 'mo'
          ? [{ name: '黄泉血河', generalId: 'dongzhuo' }, { name: '炼狱魔坛', generalId: 'zhangjiao' }, { name: '九幽魔神殿', generalId: 'lvbu' }]
          : [{ name: '东岭关', generalId: 'huaxiong' }, { name: '洛阳城', generalId: 'zhangliao' }, { name: '滑州津', generalId: 'dianwei' }]);
      const passes = (cfg.passes && cfg.passes.length) ? cfg.passes : defPasses;
      const soldierTag = mode === 'xian' ? '护道天兵' : (mode === 'mo' ? '炼狱魔卒' : '');
      passes.forEach((p, i) => {
        const list = soldiers(4 + Math.ceil(i / 2), i === 0 ? 760 : WORLD_W - 150, lv + i, soldierTag);
        const g = makeEnemyGeneral(nextUid(), p.generalId, lv + i * 2, i === 0 ? 980 : WORLD_W - 90, 280, (1.55 + i * 0.28) * diff.hpMult, (1.15 + i * 0.10) * diff.atkMult, true, diff.defMult, initRage);
        if (g) {
          g.name = p.name + '·' + g.name;
          if (mode === 'xian' || mode === 'mo') {
            const isXian = mode === 'xian';
            g.setVfx = {
              auraVfx: isXian ? 'jade_vitality' : 'shadow_phantom',
              auraName: isXian ? '九天仙罡阵' : '九幽魔煞阵',
              auraColor: isXian ? '#67e8f9' : '#e879f9',
              auraSubColor: isXian ? '#fef08a' : '#fb7185',
              vfxTier: 3,
              quality: 'gold',
            };
          }
          list.push(g);
        }
        roundQueue.push(list);
      });
      (roundQueue.shift() || []).forEach((u) => units.push(u));
      out.totalRounds = Math.max(1, passes.length);
    } else if (mode === 'escort') {
      units.push(makeProp(nextUid(), 'player', '木牛流马', '', 150, 302, cfg.cartHp || 5600, { isCart: true, def: 30, propSprite: 'prop_wooden_ox' }));
      soldiers(5, 640, lv, '山贼').forEach((u) => units.push(u));
      out.manualEnd = true;
      out.noAutoWave = true;
    } else if (mode === 'chaos') {
      const boss = sp.boss || {}, bCfg = App.Config.BEASTS[boss.sprite];
      if (bCfg) {
        const m = boss.hpMult || 9;
        units.push({
          uid: nextUid(), side: 'enemy', facing: -1, kind: 'beast', id: bCfg.id, spriteKey: 'beast_sprite_' + bCfg.id, name: '太古凶兽·' + boss.name, unitType: 'spear',
          isWildBeast: true, shieldCounter: boss.counter, shieldReduce: cfg.shieldReduce || 0.9,
          x: WORLD_W - 250, y: 298, maxHp: Math.round(bCfg.hp * 0.75 * m * (1 + lv * 0.1) * diff.hpMult), hp: Math.round(bCfg.hp * 0.75 * m * (1 + lv * 0.1) * diff.hpMult),
          atk: Math.round(bCfg.atk * 0.34 * (boss.atkMult || 2) * (1 + lv * 0.05) * diff.atkMult), def: Math.round(bCfg.def * 0.34 * 1.6 * diff.defMult), crit: 0.22, spd: 68, range: 78, rage: 45,
          beastSkillTimer: 4.5, atkTimer: 0.75, attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true, beastCfg: bCfg,
        });
      }
      soldiers(6, 900, lv).forEach((u) => units.push(u));
    }
    return out;
  }

  /** 特殊副本的本场表现分（服务端按上限封顶后据此发奖） */
  function specialScore(battle) {
    const sp = battle.special;
    if (battle.level && battle.level.raid) return Math.round(battle.raidDamage || 0);
    if (!sp) return 0;
    if (sp.type === 'tomb' || sp.type === 'treasury') return sp.lootTotal - battle.units.filter((u) => u.isLoot && u.alive).length;
    if (sp.type === 'defend') return battle.status === 'victory' && battle.baseAlive !== false ? battle.totalRounds : Math.max(0, battle.round - 1);
    if (sp.type === 'pass' || sp.type === 'xian' || sp.type === 'mo') return battle.passCleared || 0;
    if (sp.type === 'escort') { const p = battle.cartHpPct || 0; return p >= 0.8 ? 3 : (p >= 0.4 ? 2 : 1); }
    return 1;
  }

  /** 特殊副本每帧逻辑：倒计时、粮车推进、伏兵、定时出波 */
  function updateSpecial(battle, dt) {
    const sp = battle.special;
    if (!sp || battle.status !== 'fighting' || battle.introTimer > 0) return;
    const end = (win) => { battle.forceEnd = win ? 'win' : 'lose'; checkBattleEnd(battle); };
    if (sp.duration) {
      battle.timeLeft -= dt;
      if (battle.timeLeft <= 0) {
        battle.timeLeft = 0;
        return end((sp.type !== 'tomb' && sp.type !== 'treasury') || specialScore(battle) > 0);
      }
    }
    if ((sp.type === 'tomb' || sp.type === 'treasury') && !battle.units.some((u) => u.isLoot && u.alive)) return end(true);
    if (sp.type === 'treasury') {
      battle.specialTimer += dt;
      if (battle.specialTimer >= 14) {
        battle.specialTimer = 0;
        const lv = sp.cfg.enemyLv || 14;
        const trDiff = App.Config.getModeDifficulty('treasury', battle.level);
        for (let i = 0; i < 3; i++) {
          const u = makeSoldier(battle.uidCounter++, 'enemy', TROOP_CARDS[i % Math.max(1, Math.min(4, TROOP_CARDS.length))],
            WORLD_W - 140 - i * 28, LANE_MIN_Y + 25 + i * 52, lv, trDiff);
          u.name = '西凉禁军';
          battle.units.push(u);
        }
      }
    }
    if (sp.type === 'defend') {
      const base = battle.units.find((u) => u.isBase);
      if (!base || !base.alive) { battle.baseAlive = false; return end(battle.round - 1 >= 1); }
      battle.specialTimer += dt;
      if (battle.specialTimer >= sp.waveEvery && battle.round < battle.totalRounds) { battle.specialTimer = 0; nextRound(battle); }
    }
    if (sp.type === 'escort') {
      const cart = battle.units.find((u) => u.isCart);
      if (!cart || !cart.alive) return end(false);
      battle.cartHpPct = cart.hp / cart.maxHp;
      cart.x += (sp.cfg.cartSpeed || 26) * dt;
      cart.moving = true;
      if (cart.x >= WORLD_W - 150) return end(true);
      battle.specialTimer += dt;
      if (battle.specialTimer >= (sp.cfg.ambushEvery || 6.2)) {
        battle.specialTimer = 0;
        const lv = sp.cfg.enemyLv || 12, front = Math.random() < 0.7;
        const escDiff = App.Config.getModeDifficulty('escort', battle.level);
        for (let i = 0; i < 4; i++) {
          const u = makeSoldier(battle.uidCounter++, 'enemy', TROOP_CARDS[Math.floor(Math.random() * Math.min(4, TROOP_CARDS.length))],
            Math.max(40, Math.min(WORLD_W - 40, cart.x + (front ? 300 + i * 26 : -240 - i * 26))), LANE_MIN_Y + Math.random() * 165, lv, escDiff);
          u.name = '山贼伏兵';
          battle.units.push(u);
        }
        addFloatText(battle, cart.x, cart.y - 90, front ? '前方有伏兵！' : '后方遭袭！', '#fca5a5', true);
      }
    }
  }

  // 轮数与副将数量由后台「战斗轮次」配置按章节决定
  function getRoundPlan(mode, level) {
    const w = App.Config.WAVES || {};
    if (level && level.special) return { rounds: 1, subGenerals: 0 }; // 特殊副本自己安排波次
    if (level && level.raid) return { rounds: 1, subGenerals: 0 }; // 共享血量 BOSS 开场即登场
    if (mode === 'beast') return { rounds: w.dungeonRounds || 6, subGenerals: 2 };
    if (mode === 'demon') return { rounds: w.demonRounds || 4, subGenerals: 0 };
    if (mode === 'tower') return { rounds: (level.enemyGenerals || []).length ? 4 : 3, subGenerals: 4 };
    const ch = (level && level.chapter) || 1;
    const tier = (w.tiers || []).find((t) => ch <= t.maxChapter) || { rounds: 3, subGenerals: 0 };
    return { rounds: Math.max(1, tier.rounds || 3), subGenerals: tier.subGenerals || 0 };
  }

  /** 统一聚合多源暂停标记（手动暂停 / 撤退确认框 / 局内设置窗 / 激励广告），互不覆盖冲突 */
  function syncPaused(battle) {
    if (!battle) return false;
    battle.paused = !!(battle.userPaused || battle.adPaused || battle.settingsPaused || battle.retreatConfirmOpen);
    return battle.paused;
  }

  /** 进入下一轮（倒计时结束或玩家点「嘲讽」） */
  function nextRound(battle) {
    if (syncPaused(battle) || battle.status !== 'fighting' || battle.round >= battle.totalRounds) return false;
    battle.round += 1;
    if (battle.special && (battle.special.type === 'pass' || battle.special.type === 'xian' || battle.special.type === 'mo')) {
      battle.passCleared = battle.round - 1;
      const pct = battle.special.cfg.healPct || 0.25;
      battle.units.forEach((u) => { if (u.alive && u.side === 'player' && u.kind !== 'soldier') u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * pct)); });
    }
    battle.roundWaiting = false;
    battle.roundCountdown = 0;
    (battle.roundQueue.shift() || []).forEach((u) => battle.units.push(u));
    const last = battle.round >= battle.totalRounds;
    showBanner(battle, last ? '最终轮 · 守将亲征' : `第 ${battle.round} / ${battle.totalRounds} 轮`, last ? '击破守将即可攻克此关！' : '敌军援兵杀到！', last ? '#f87171' : '#fde047');
    if (App.Audio) App.Audio.playSfx('battle_start');
    return true;
  }

  function makeSoldier(uid, side, card, x, y, lv, statMult) {
    // 我方小兵额外享受「兵种演武营」的等级加成；敌方小兵享受后台难度倍率
    const campLv = side === 'player' ? ((App.State.get().troopLevels || {})[card.id] || 0) : 0;
    const sc = (1 + (lv - 1) * 0.14) * (1 + campLv * ((App.Config.TROOP_CAMP || {}).statPerLevel || 0));
    const mHp = statMult && statMult.hpMult ? statMult.hpMult : 1;
    const mAtk = statMult && statMult.atkMult ? statMult.atkMult : 1;
    const mDef = statMult && statMult.defMult ? statMult.defMult : 1;
    const u = {
      uid, side, facing: side === 'player' ? 1 : -1,
      kind: 'soldier', id: card.id, spriteKey: card.spriteKey,
      name: card.name, unitType: card.unitType || card.id, isMagic: !!card.isMagic,
      x, y,
      maxHp: Math.round(card.hp * sc * mHp), hp: Math.round(card.hp * sc * mHp),
      atk: Math.round(card.atk * sc * mAtk), def: Math.round(card.def * sc * mDef),
      crit: 0.07, spd: (card.id === 'cavalry' && (!card.spd || card.spd === 128)) ? 88 : card.spd, range: card.range, rage: 0,
      atkTimer: 0.45 + Math.random() * 0.35, attackAnim: 0, runPhase: Math.random() * 6,
      stunTimer: 0, hitFlash: 0, moving: false, alive: true,
    };
    u.atkStyle = inferAttackStyle(u);
    u.isMounted = isSpriteMounted(u.spriteKey, 'soldier', card.id);
    u.atkProg = 0;
    u.comboStep = uid % 3;
    u.atkDur = u.atkStyle === 'bow' ? 0.56 : (u.atkStyle === 'fan' ? 0.54 : 0.48);
    u.atkReleased = false;
    u.atkTarget = null;
    u.knockX = 0;
    u.hitRecoil = 0;
    u.moveBlend = 0;
    u.inCombat = false;
    u.idlePhase = (uid * 1.73) % (Math.PI * 2);
    u.engageSlotY = ((uid % 5) - 2) * 12;
    u.rangeJitter = ((uid * 7) % 11) - 5;
    return u;
  }

  // 判定我方出战武将是否已全部战死（我方武将全部战死即对局失败）
  function areAllPlayerGeneralsDead(battle) {
    if (!battle || !battle.units) return false;
    const playerGens = battle.units.filter((u) => u.side === 'player' && u.kind === 'general');
    return playerGens.length > 0 && playerGens.every((u) => !u.alive || u.hp <= 0);
  }

  // 查询我方某兵营兵种的统率武将状态（仅出战武将对应兵种存在；统率该兵种的出战武将全部战死后不可继续派兵）
  function getTroopCommandState(battle, cardId) {
    if (!battle || !battle.units) {
      return { deployed: false, aliveCount: 0, totalCount: 0, generals: [], aliveGenerals: [] };
    }
    const gens = battle.units.filter((u) => u.side === 'player' && u.kind === 'general' && u.troopId === cardId);
    if (!gens.length) {
      return { deployed: false, aliveCount: 0, totalCount: 0, generals: [], aliveGenerals: [] };
    }
    const aliveGens = gens.filter((u) => u.alive && u.hp > 0);
    return {
      deployed: true,
      aliveCount: aliveGens.length,
      totalCount: gens.length,
      generals: gens,
      aliveGenerals: aliveGens,
    };
  }

  function getDeployedTroopEntries(battle) {
    if (!battle || battle.noTroops) return [];
    const out = [];
    for (let idx = 0; idx < TROOP_CARDS.length; idx++) {
      const card = TROOP_CARDS[idx];
      const cmd = getTroopCommandState(battle, card.id);
      if (cmd.deployed) out.push({ card, cardIdx: idx, cmd });
    }
    return out;
  }

  function dispatchOneTroop(battle, cardIdx, silentInsufficient) {
    if (!battle || battle.noTroops) return false;
    const card = TROOP_CARDS[cardIdx];
    if (!card || battle.status !== 'fighting') return false;
    const cmd = getTroopCommandState(battle, card.id);
    if (!cmd.deployed || cmd.aliveCount <= 0) {
      if (battle.autoTroops) battle.autoTroops[cardIdx] = false;
      if (!silentInsufficient && App.UI) {
        const msg = !cmd.deployed
          ? `未出战统率【${card.name}】的武将，无法派兵！`
          : `统率【${card.name}】的武将已战死，无法继续派兵！`;
        App.UI.showToast(msg, '#f87171');
      }
      return false;
    }
    if (battle.wood < card.wood || battle.food < card.food) {
      if (!silentInsufficient && App.UI) App.UI.showToast('木材或粮草暂不足，待资源产出后将自动派兵！', '#fbbf24');
      return false;
    }
    const pSoldierCount = battle.units.filter((u) => u.alive && u.side === 'player' && u.kind === 'soldier').length;
    if (pSoldierCount >= 32) return false;
    battle.wood -= card.wood;
    battle.food -= card.food;
    const avgLv = App.State.getAverageTeamLv();
    const y = LANE_MIN_Y + Math.random() * (LANE_MAX_Y - LANE_MIN_Y);
    // ★ 从中军帅帐正前方辕门列队出兵（x >= 322，完全位于主营战鼓前侧，绝不被帅帐遮挡！）
    const spawnX = getPlayerCampFrontX(battle) + 6 + ((battle.uidCounter || 0) % 3) * 10;
    battle.units.push(makeSoldier(battle.uidCounter++, 'player', card, spawnX, y, avgLv));
    return true;
  }

  // 点击兵种卡：开启持续自动派兵（并立即派出一兵），再次点击取消该兵种自动派兵！
  function toggleAutoTroop(battle, cardIdx) {
    if (!battle || battle.noTroops) return false;
    const card = TROOP_CARDS[cardIdx];
    if (!card || battle.status !== 'fighting') return false;
    if (syncPaused(battle)) {
      if (App.UI) App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
      return false;
    }
    battle.autoTroops = battle.autoTroops || {};
    const cmd = getTroopCommandState(battle, card.id);
    if (!cmd.deployed || cmd.aliveCount <= 0) {
      battle.autoTroops[cardIdx] = false;
      if (App.UI) {
        const msg = !cmd.deployed
          ? `未出战统率【${card.name}】的武将，无法派兵！`
          : `统率【${card.name}】的武将已战死，无法继续派兵！`;
        App.UI.showToast(msg, '#f87171');
      }
      return false;
    }
    const nextOn = !battle.autoTroops[cardIdx];
    battle.autoTroops[cardIdx] = nextOn;
    if (nextOn) {
      const spawnedNow = dispatchOneTroop(battle, cardIdx, false);
      battle.autoTroopTimer = spawnedNow ? (battle.autoTroopInterval || 1.15) : 0.25;
    }
    return nextOn;
  }

  function spawnPlayerTroop(battle, cardIdx) {
    return toggleAutoTroop(battle, cardIdx);
  }

  function addFloatText(battle, x, y, text, color, big) {
    let nx = x;
    let ny = y;
    let stacked = 0;
    for (let i = battle.floatTexts.length - 1; i >= 0 && stacked < 4; i--) {
      const f = battle.floatTexts[i];
      if (f.life > 0.58 && Math.abs(f.x - nx) < 52 && Math.abs(f.y - ny) < 17) {
        stacked++;
        ny -= 16;
        nx += (stacked % 2 === 0 ? 12 : -12);
      }
    }
    const vx = (Math.random() - 0.5) * 14;
    if (battle.floatTexts.length >= 32) battle.floatTexts.shift();
    battle.floatTexts.push({ x: nx, y: ny, vx, text, color: color || '#fff', big: !!big, life: 1.0, maxLife: 1.0 });
  }

  function spawnSparks(battle, x, y, color, count) {
    const n = Math.min(7, Math.max(2, Math.ceil((count || 4) * 0.42)));
    for (let i = 0; i < n; i++) {
      if (battle.sparks.length >= 64) battle.sparks.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = 65 + Math.random() * 120;
      battle.sparks.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 32,
        color: color || '#fde047', size: 1.3 + Math.random() * 1.1, life: 0.22 + Math.random() * 0.14,
      });
    }
  }

  function showBanner(battle, title, sub, color, portraitId, beastPortraitId) {
    battle.banner = {
      title, sub, color: color || '#fde047',
      portraitId: portraitId || null,
      beastPortraitId: beastPortraitId || null,
      timer: 1.55, maxTimer: 1.55,
    };
    battle.shakeTimer = 0.26;
  }

  function findNearestEnemy(battle, u) {
    const enemySide = u.side === 'player' ? 'enemy' : 'player';
    let best = null, bestD = Infinity;
    for (const e of battle.units) {
      if (!e.alive || e.side !== enemySide) continue;
      // 优先迎战前线兵将，其次再围攻敌军主营
      const rawD = Math.hypot(e.x - u.x, (e.y - u.y) * 1.15);
      const scoreD = e.isMainBase ? rawD + 35 : rawD;
      if (scoreD < bestD) { bestD = scoreD; best = e; }
    }
    for (const t of battle.towers) {
      if (!t.alive || t.side !== enemySide) continue;
      const d = Math.hypot(t.x - u.x, (t.y - u.y) * 1.15);
      if (d < bestD) { bestD = d; best = t; }
    }
    const trueDist = best ? Math.hypot(best.x - u.x, (best.y - u.y) * 1.15) : Infinity;
    return { target: best, dist: trueDist };
  }

  // 箭垒索敌规则：射程内只要存在小兵（含攻城冲车），一律优先攻击最近的小兵；无小兵时才攻击敌将/神兽
  function findTowerTarget(battle, tower) {
    const maxRange = 290;
    let bestSoldier = null, bestSoldierD = maxRange;
    let bestOther = null, bestOtherD = maxRange;
    for (const u of battle.units) {
      if (!u.alive || u.side === tower.side || u.isMainBase || u.isBase) continue;
      const d = Math.hypot(u.x - tower.x, (u.y - tower.y) * 1.1);
      if (d >= maxRange) continue;
      if (u.kind === 'soldier' || u.isRam) {
        if (d < bestSoldierD) {
          bestSoldierD = d;
          bestSoldier = u;
        }
      } else if (d < bestOtherD) {
        bestOtherD = d;
        bestOther = u;
      }
    }
    return bestSoldier || bestOther;
  }

  function dealDamage(battle, attacker, target, mult, opts) {
    if (!target || !target.alive) return 0;
    const o = opts || {};
    const disDmgMult = (attacker.side === 'player' && battle.activeDisaster && battle.activeDisaster.dmgMult)
      ? battle.activeDisaster.dmgMult
      : 1.0;
    const atkMult = Math.max(0.35, 1 + ((attacker.atkBuffTimer > 0 && attacker.atkBuffPct) ? attacker.atkBuffPct : 0) - ((attacker.weakenTimer > 0 && attacker.weakenAtkPct) ? attacker.weakenAtkPct : 0));
    const effAtk = (attacker.atk || 20) * atkMult;
    const burnMelt = target.burnTimer > 0 ? 0.16 : 0;
    const defMult = Math.max(0.10, (1 + ((target.defBuffTimer > 0 && target.defBuffPct) ? target.defBuffPct : 0) - ((target.armorBreakTimer > 0 && target.armorBreakPct) ? target.armorBreakPct : 0) - burnMelt) * (1 - (o.armorIgnore || 0)));
    const effDef = (target.def || 15) * defMult;

    let dmg = Math.max(15, effAtk * mult * disDmgMult - effDef * 0.42);
    const effCritRate = (attacker.crit || 0.1) + ((attacker.critBuffTimer > 0 && attacker.critBuffPct) ? attacker.critBuffPct : 0);
    const isCrit = !!o.forceCrit || Math.random() < effCritRate;
    if (isCrit) dmg *= (1.5 + (attacker.critDmg || 0) + (o.bonusCritDmg || 0));
    if (target.petrifyTimer > 0) {
      dmg *= 1.25; // ★ 石化脆岩状态：受到的物理/绝技碎石伤害额外 +25%！
      if (Math.random() < 0.45) spawnSparks(battle, target.x, target.y - 30, '#d6d3d1', 5);
    }
    if (target.vulnTimer > 0 && target.vulnPct) dmg *= (1 + target.vulnPct);
    const totalDmgRed = (target.dmgReduce || 0) + ((target.dmgRedBuffTimer > 0 && target.dmgRedBuffPct) ? target.dmgRedBuffPct : 0);
    if (totalDmgRed > 0) dmg *= Math.max(0.32, 1 - totalDmgRed);
    if (target.shieldCounter && attacker.side === 'player' && App.State.get().activeBeastId !== target.shieldCounter) {
      dmg *= 1 - (target.shieldReduce || 0.9); // 没带克制神兽：凶兽护盾抵消大部分伤害
      if (Math.random() < 0.15) addFloatText(battle, target.x, target.y - 110, '护盾未破', '#93c5fd');
    }
    if (target.isMainBase && target.side === 'enemy') {
      // 若敌军后续波次尚未出营便遭前锋叩营，立即鸣金派下一轮守军与守将出营迎战；敌将/箭垒尚存时主营固若金汤不可隔空强秒！
      const hasKeyDefenders = battle.units.some((u) => u.alive && u.side === 'enemy' && (u.kind === 'general' || u.isWildBeast))
        || battle.towers.some((t) => t.alive && t.side === 'enemy');
      if (battle.round < battle.totalRounds) {
        if (!o.fromSkill) nextRound(battle);
        dmg *= 0.18;
      } else if (hasKeyDefenders) {
        dmg *= 0.22;
      } else {
        const hasDefenders = battle.units.some((u) => u.alive && u.side === 'enemy' && !u.isMainBase);
        if (!hasDefenders) dmg *= 2.4; // 肃清外围守军与双箭垒后，全军合力破营倍增伤害！
      }
    }
    dmg = Math.round(dmg);

    // 护盾优先吸收伤害（刘备仁德盾、曹仁八门金锁、赵云龙胆盾、夏侯惇刚烈盾等）
    let hpDmg = dmg;
    if ((target.shieldHp || 0) > 0 && hpDmg > 0) {
      const absorbed = Math.min(target.shieldHp, hpDmg);
      target.shieldHp -= absorbed;
      hpDmg -= absorbed;
      if (absorbed >= 15 && Math.random() < 0.45) {
        addFloatText(battle, target.x, target.y - 68, `护盾-${absorbed}`, '#67e8f9');
      }
    }

    if (target.isRaidBoss && hpDmg > 0) battle.raidDamage = (battle.raidDamage || 0) + Math.min(hpDmg, target.hp);

    target.hp = Math.max(0, target.hp - hpDmg);
    target.hitFlash = 0.16;
    target.hitRecoil = isCrit ? 1.0 : 0.72;
    const hitDir = target.x >= attacker.x ? 1 : -1;
    if (target.knockX !== undefined) {
      target.knockX = hitDir * (isCrit ? 7.2 : 4.2);
    }
    // 受击适度积攒怒气 (+3.8)，配合普攻约7.5秒集满绝技
    if (target.rage !== undefined) target.rage = Math.min(100, target.rage + 3.8);

    if (o.fromSkill) {
      spawnSparks(battle, target.x, target.y - 32, o.sparkColor || '#fde047', isCrit ? 12 : 7);
      battle.projectiles.push({
        kind: 'impact_ring',
        x2: target.x,
        y2: target.y - 26,
        color: o.sparkColor || '#fde047',
        isFan: true,
        life: 0.26,
        maxLife: 0.26,
      });
    } else if (!o.fromProjectile && (!attacker.range || attacker.range <= 100)) {
      const style = attacker.atkStyle || 'cleave';
      const isBeastAtk = attacker.kind === 'beast';
      if (App.Audio) App.Audio.playSfx(style === 'thrust' ? 'spear_thrust' : 'sword_hit');
      const wEq = attacker.equips && attacker.equips.weapon ? App.Config.EQUIP_TEMPLATES[attacker.equips.weapon.tplId] : null;
      const wVfx = attacker.weaponVfx || (wEq && App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(attacker.equips.weapon) : null);
      const beastGlow = isBeastAtk && attacker.beastCfg ? attacker.beastCfg.glow : null;
      const baseCol = wVfx ? wVfx.color : (isCrit ? '#facc15' : (beastGlow || (wEq ? (wEq.glowColor || '#38bdf8') : (attacker.side === 'player' ? '#fef08a' : '#fca5a5'))));
      const midX = (attacker.x + target.x) * 0.5 + hitDir * 6;
      const midY = (attacker.y + target.y) * 0.5 - (target.kind === 'beast' ? 44 : (target.isMounted ? 36 : 25));
      const hitY2 = target.y - (target.kind === 'beast' ? 44 : (target.isMounted ? 36 : 25));
      const wScaleMult = wVfx ? (wVfx.scaleMult || 1.15) : 1.0;
      battle.projectiles.push({
        kind: isBeastAtk ? 'beast_strike' : (style === 'thrust' ? 'thrust' : 'slash'),
        beastId: isBeastAtk ? attacker.id : null,
        attackerKind: attacker.kind,
        soldierId: attacker.kind === 'soldier' ? attacker.id : null,
        atkVfx: wVfx ? wVfx.atkVfx : null,
        vfxTier: wVfx ? wVfx.tier : 0,
        vfxTex1: wVfx ? wVfx.tex1 : null,
        vfxTex2: wVfx ? wVfx.tex2 : null,
        coreColor: wVfx ? wVfx.coreColor : '#ffffff',
        x1: attacker.x + hitDir * (isBeastAtk ? 24 : 14),
        y1: attacker.y - (isBeastAtk ? 46 : (attacker.isMounted ? 38 : 25)),
        x2: target.x,
        y2: hitY2,
        dir: hitDir,
        isCrit,
        scale: (attacker.kind === 'general' ? 1.32 : (isBeastAtk ? 1.58 : 0.96)) * wScaleMult * (isCrit ? 1.16 : 1),
        color: baseCol,
        life: isBeastAtk ? 0.32 : (wVfx ? 0.32 : 0.25),
        maxLife: isBeastAtk ? 0.32 : (wVfx ? 0.32 : 0.25),
      });
      if (wVfx && wVfx.active && !isBeastAtk) {
        battle.projectiles.push({
          kind: 'weapon_burst',
          atkVfx: wVfx.atkVfx,
          vfxTier: wVfx.tier,
          vfxTex1: wVfx.tex1,
          vfxTex2: wVfx.tex2,
          color: wVfx.color,
          coreColor: wVfx.coreColor,
          x2: target.x,
          y2: hitY2,
          dir: hitDir,
          isCrit,
          scale: (isCrit ? 1.34 : 1.04) * wScaleMult,
          life: isCrit ? 0.36 : 0.28,
          maxLife: isCrit ? 0.36 : 0.28,
        });
      }
      battle.projectiles.push({
        kind: 'clash_star',
        x2: midX,
        y2: midY,
        scale: (isCrit ? 1.45 : (attacker.kind === 'general' ? 1.15 : (isBeastAtk ? 1.35 : 0.85))) * (wVfx ? 1.15 : 1),
        color: wVfx ? wVfx.color : (isCrit ? '#fde047' : baseCol),
        life: 0.22,
        maxLife: 0.22,
      });
      spawnSparks(battle, midX, midY, wVfx ? wVfx.color : (isCrit ? '#fde047' : (beastGlow || '#fed7aa')), (isCrit ? 14 : (isBeastAtk ? 10 : 7)) + (wVfx ? 5 : 0));
    } else {
      spawnSparks(battle, target.x, target.y - 28, o.sparkColor || (isCrit ? '#fde047' : '#bae6fd'), isCrit ? 9 : 5);
    }

    addFloatText(battle, target.x, target.y - 54, (isCrit ? '暴击 ' : '') + '-' + dmg, isCrit ? '#fde047' : '#ffffff', isCrit);

    const effLifesteal = (attacker.lifesteal || 0) + ((attacker.lifestealBuffTimer > 0 && attacker.lifestealBuffPct) ? attacker.lifestealBuffPct : 0);
    if (attacker.alive && effLifesteal > 0 && dmg > 0 && attacker.hp < attacker.maxHp) {
      const vamp = Math.max(1, Math.round(dmg * effLifesteal));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + vamp);
      if (vamp >= 18 && Math.random() < 0.45) addFloatText(battle, attacker.x, attacker.y - 58, `吸血+${vamp}`, '#4ade80');
    }

    // 刚烈/恶来反伤甲：受击时反弹真实震伤（不递归触发）
    if (!o.fromThorns && !o.fromDot && !o.fromChain && target.thornsTimer > 0 && target.thornsPct > 0 && attacker.alive && attacker.kind && !attacker.isProp) {
      const refDmg = Math.max(8, Math.round(dmg * target.thornsPct));
      attacker.hp = Math.max(1, attacker.hp - refDmg);
      if (Math.random() < 0.5) addFloatText(battle, attacker.x, attacker.y - 64, `反伤-${refDmg}`, '#f87171');
    }

    // 凤雏铁索连环 / 夷陵火阵传导：受击时向周围其他连环单位传导 32% 溅射伤害！
    if (!o.fromChain && !o.fromDot && target.chainLinkTimer > 0 && dmg > 20) {
      const linked = battle.units.filter((u) => u.alive && u !== target && u.side === target.side && u.chainLinkTimer > 0 && Math.hypot(u.x - target.x, u.y - target.y) <= 260);
      linked.slice(0, 2).forEach((lu) => {
        const cDmg = Math.max(10, Math.round(dmg * 0.32));
        lu.hp = Math.max(0, lu.hp - cDmg);
        lu.hitFlash = 0.12;
        addFloatText(battle, lu.x, lu.y - 62, `连环-${cDmg}`, '#fb923c');
        if (lu.hp <= 0) {
          lu.alive = false;
          if (lu.kind) battle.dyingUnits.push(Object.assign({}, lu, { dieTimer: 0.55, maxDie: 0.55 }));
        }
      });
    }

    if (target.hp <= 0) {
      target.alive = false;
      spreadVenomOnDeath(battle, target);
      if (attacker.rage !== undefined) attacker.rage = Math.min(100, attacker.rage + 6);
      if (target.kind) {
        battle.dyingUnits.push(Object.assign({}, target, { dieTimer: 0.55, maxDie: 0.55 }));
      }
      if (target.side === 'player' && target.kind === 'general') {
        const allGensDead = areAllPlayerGeneralsDead(battle);
        if (target.troopId) {
          const cmd = getTroopCommandState(battle, target.troopId);
          if (cmd.deployed && cmd.aliveCount <= 0) {
            const deadIdx = TROOP_CARDS.findIndex((c) => c.id === target.troopId);
            if (deadIdx >= 0) {
              if (battle.autoTroops) battle.autoTroops[deadIdx] = false;
              const deadCard = TROOP_CARDS[deadIdx];
              if (!allGensDead) {
                addFloatText(battle, target.x, target.y - 76, `${deadCard.name}停派`, '#f87171', true);
                if (App.UI && battle.status === 'fighting') {
                  App.UI.showToast(`【${target.name}】战死，所属【${deadCard.name}】停止继续派兵！`, '#f87171');
                }
              }
            }
          }
        }
        if (allGensDead) {
          if (battle.autoTroops) {
            Object.keys(battle.autoTroops).forEach((k) => { battle.autoTroops[k] = false; });
          }
          addFloatText(battle, target.x, target.y - 96, '我方武将全部战死！', '#f87171', true);
          if (App.UI && battle.status === 'fighting') {
            App.UI.showToast('我方上阵武将全部战死，三军无主，对局失败！', '#f87171');
          }
          battle.defeatReason = 'generals_dead';
          battle.forceEnd = 'lose';
          checkBattleEnd(battle);
          return dmg;
        }
      }
      if (target.side === 'enemy' && !battle.noTroops) {
        const gain = target.kind ? 8 : 45;
        battle.wood = Math.min(999, battle.wood + gain);
        battle.food = Math.min(999, battle.food + gain);
        addFloatText(battle, target.x, target.y - 72, `缴获+${gain}木粮`, '#86efac', !target.kind);
      }

      if (target.isWildBeast && battle.mode === 'beast') {
        addFloatText(battle, target.x, target.y - 94, '神兽已被镇伏！大获全胜！', '#fde047', true);
        battle.units.forEach((u) => { if (u.side === 'enemy') u.alive = false; });
        battle.towers.forEach((t) => { if (t.side === 'enemy') t.alive = false; });
        checkBattleEnd(battle);
      } else if (target.isMainBase && target.side === 'enemy' && battle.round >= battle.totalRounds) {
        addFloatText(battle, target.x, target.y - 94, '敌军主营已破！大获全胜！', '#fde047', true);
        battle.units.forEach((u) => { if (u.side === 'enemy') u.alive = false; });
        battle.towers.forEach((t) => { if (t.side === 'enemy') t.alive = false; });
        checkBattleEnd(battle);
      } else if ((target.isBase || target.isMainBase) && target.side === 'player') {
        addFloatText(battle, target.x, target.y - 94, '我方主营失守！', '#f87171', true);
        if (!(battle.special && battle.special.type === 'defend')) {
          battle.forceEnd = 'lose';
          checkBattleEnd(battle);
        }
      }
    }
    return dmg;
  }

  // ★ 真实抛物线/法术弹道发射器：羽箭从弓弦发出、罡风灵刃从羽扇挥出，飞行命中瞬间再触发受击伤害与爆点！
  function launchBallisticProjectile(battle, attacker, target, mult, kindOverride) {
    if (!target || !target.alive) return;
    const facing = target.x >= attacker.x ? 1 : -1;
    const isTower = !attacker.kind;
    const style = isTower ? 'tower' : (attacker.atkStyle || 'bow');
    const isGen = attacker.kind === 'general';

    let pKind = kindOverride;
    if (!pKind) {
      if (isTower) pKind = 'tower_arrow';
      else if (style === 'fan' || (style === 'sword' && attacker.isMagic)) pKind = isGen ? 'gen_fan' : 'fan_wave';
      else pKind = isGen ? 'gen_arrow' : 'arrow';
    }

    const startX = isTower ? attacker.x + facing * 12 : attacker.x + facing * (attacker.isMounted ? 22 : 15);
    const startY = isTower ? attacker.y - 66 : attacker.y - (attacker.isMounted ? 48 : 29);
    const endX = target.x;
    const endY = target.y - (target.kind === 'beast' ? 46 : (target.isMounted ? 36 : 24));
    const dist = Math.hypot(endX - startX, endY - startY);

    const isFan = pKind === 'fan_wave' || pKind === 'gen_fan';
    const speed = isFan ? 560 : 650;
    const duration = Math.max(0.20, Math.min(0.42, dist / speed));
    const arcH = isFan ? Math.min(20, 6 + dist * 0.05) : (isTower ? 18 : Math.min(46, 14 + dist * 0.13));

    const elColorMap = {
      fire: '#fb923c', ice: '#38bdf8', thunder: '#facc15',
      shadow: '#c084fc', heal_petal: '#4ade80', slash_cyan: '#22d3ee',
    };
    const cfgEl = attacker.cfg && attacker.cfg.skillElement;
    const wVfx = isGen ? (attacker.weaponVfx || (attacker.equips && attacker.equips.weapon && App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(attacker.equips.weapon) : null)) : null;
    const mainColor = wVfx
      ? wVfx.color
      : (isFan
        ? (elColorMap[cfgEl] || (attacker.isMagic ? '#c084fc' : '#2dd4bf'))
        : (pKind === 'tower_arrow' ? '#fb923c' : (attacker.side === 'player' ? '#fde047' : '#fca5a5')));

    if (App.Audio && !isTower) {
      App.Audio.playSfx(isFan ? 'fan_cast' : 'bow_shoot');
    }

    battle.projectiles.push({
      kind: pKind,
      ballistic: true,
      atkVfx: wVfx ? wVfx.atkVfx : null,
      vfxTier: wVfx ? wVfx.tier : 0,
      vfxTex1: wVfx ? wVfx.tex1 : null,
      vfxTex2: wVfx ? wVfx.tex2 : null,
      coreColor: wVfx ? wVfx.coreColor : '#ffffff',
      vfxScale: wVfx ? (wVfx.scaleMult || 1.15) : 1.0,
      x1: startX, y1: startY,
      x2: endX, y2: endY,
      cx: startX, cy: startY,
      ang: Math.atan2(endY - startY, endX - startX),
      arcH,
      t: 0,
      duration,
      attacker,
      target,
      dmgMult: mult || 1.0,
      color: mainColor,
      side: attacker.side,
      trail: [{ x: startX, y: startY }],
    });
  }

  function triggerPlayerGeneralSkill(battle, caster) {
    if (!caster || !caster.alive || caster.rage < 100 || battle.status !== 'fighting') return false;
    if (syncPaused(battle)) {
      if (App.UI) App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
      return false;
    }
    const cfg = caster.cfg || {};
    const isPureSupport = cfg.skillPower === 0;
    // ★ 纯群疗/回春辅助与全屏大招直接点击立即施放，无需繁琐选点！
    if (isPureSupport) {
      const allies = battle.units.filter((a) => a.alive && a.side === caster.side && !a.isProp);
      const ax = allies.length ? Math.round(allies.reduce((s, a) => s + a.x, 0) / allies.length) : caster.x;
      return executeGeneralSkillAt(battle, caster, ax, 288);
    }
    if (cfg.isFullscreenSkill || /【全屏/.test(cfg.skillDesc || '')) {
      return executeGeneralSkillAt(battle, caster, battle.cameraX + App.Platform.LOGICAL_W / 2, 285);
    }
    if (caster.needsManualAim) {
      battle.aimingUnit = battle.aimingUnit === caster ? null : caster;
      if (battle.aimingUnit && App.UI) {
        App.UI.showToast(`请点击战场目标位置释放【${cfg.skillName}】！`, '#fde047');
      }
      return true;
    }
    return executeGeneralSkillAt(battle, caster, caster.x + caster.facing * 180, caster.y);
  }

  function cleanseUnitDebuffs(u) {
    u.stunTimer = 0;
    u.petrifyTimer = 0;
    u.slowTimer = 0; u.slowPct = 0;
    u.armorBreakTimer = 0; u.armorBreakPct = 0;
    u.weakenTimer = 0; u.weakenAtkPct = 0;
    u.vulnTimer = 0; u.vulnPct = 0;
    u.burnTimer = 0; u.burnDps = 0;
    u.bleedTimer = 0; u.bleedDps = 0;
    u.poisonTimer = 0; u.poisonDps = 0; u.poisonSpread = false; u.healCutPct = 0;
    u.chainLinkTimer = 0;
  }

  function spreadVenomOnDeath(battle, deadUnit) {
    if (!deadUnit || !(deadUnit.poisonTimer > 0.6) || !deadUnit.poisonSpread) return;
    const remSec = Math.min(5.0, deadUnit.poisonTimer);
    const dps = deadUnit.poisonDps || 18;
    const cut = deadUnit.healCutPct || 0.45;
    const hosts = battle.units.filter((u) => u.alive && u !== deadUnit && u.side === deadUnit.side && !u.isProp && Math.hypot(u.x - deadUnit.x, u.y - deadUnit.y) <= 210);
    if (!hosts.length) return;
    spawnSparks(battle, deadUnit.x, deadUnit.y - 28, '#a3e635', 14);
    hosts.slice(0, 2).forEach((hu) => {
      hu.poisonDps = Math.max(hu.poisonDps || 0, dps);
      hu.poisonTimer = Math.max(hu.poisonTimer || 0, remSec);
      hu.poisonSpread = true;
      hu.healCutPct = Math.max(hu.healCutPct || 0, cut);
      addFloatText(battle, hu.x, hu.y - 74, '☠毒瘴传染!', '#a3e635', true);
    });
  }

  function executeGeneralSkillAt(battle, caster, worldX, worldY) {
    if (!caster || !caster.alive) return false;
    caster.rage = 0;
    caster.attackAnim = 1.0;
    caster.castAnim = 0.85;
    battle.aimingUnit = null;

    const cfg = caster.cfg;
    const mech = (cfg && cfg.skillMechanic) || {};
    const buffSec = mech.buffSec || 5.5;
    const debuffSec = mech.debuffSec || mech.buffSec || 5.0;
    const facing = caster.facing || (caster.side === 'player' ? 1 : -1);
    const prevX = caster.x;
    const prevY = caster.y;

    // 突进型名将真实位移冲阵！
    if (mech.dashAdvance && !caster.isProp) {
      const nextX = clampUnitX(battle, caster, caster.x + facing * mech.dashAdvance);
      for (let d = 0; d < 4; d++) {
        battle.dustParticles.push({
          x: prevX + (nextX - prevX) * (d / 4),
          y: caster.y + 4,
          vx: -facing * 26,
          vy: -9,
          size: 5.8,
          life: 0.34,
          maxLife: 0.34,
        });
      }
      caster.x = nextX;
    }

    const isFull = !!(cfg.isFullscreenSkill || (cfg.vfxSpec && cfg.vfxSpec.isFullscreen) || /【全屏/.test(cfg.skillDesc || ''));
    const hasOffensiveDmg = cfg.skillPower === undefined ? true : (cfg.skillPower > 0.05);
    const enemySide = caster.side === 'player' ? 'enemy' : 'player';
    const enemies = battle.units.filter((e) => e.alive && e.side === enemySide);
    const allies = battle.units.filter((a) => a.alive && a.side === caster.side && !a.isProp);
    const sparkColMap = {
      fire: '#fb923c', ice: '#7dd3fc', thunder: '#fde047',
      shadow: '#c084fc', heal_petal: '#4ade80', slash_green: '#34d399', slash_cyan: '#22d3ee', slash_crimson: '#f87171',
    };
    const skillSparkCol = cfg.skillRole === 'poison_dot' ? '#a3e635' : (sparkColMap[cfg.skillElement] || '#fde047');

    // 若为纯治疗/回春辅助绝技，特效焦点自动落于我方军阵中心！
    let vfxX = worldX;
    let vfxY = worldY;
    if (!hasOffensiveDmg && allies.length > 0) {
      vfxX = Math.round(allies.reduce((s, a) => s + a.x, 0) / allies.length);
      vfxY = 295;
    } else if (mech.targetCorePoison && enemies.length > 0) {
      const coreEnemy = enemies.filter((e) => e.kind === 'general' && !e.isProp).sort((a, b) => (b.atk || 0) - (a.atk || 0))[0] || enemies[0];
      if (coreEnemy) { vfxX = coreEnemy.x; vfxY = coreEnemy.y; }
    }

    // 触发带名将立绘切入的技能特写横幅 + 震屏 + 名将专属原画大招演出！
    if (App.Audio) App.Audio.playSfx('ultimate');
    if (caster.side === 'player' && App.Platform && App.Platform.vibrateShort) App.Platform.vibrateShort('medium');
    showBanner(
      battle,
      `${caster.name} · ${cfg.skillName}${isFull ? '【全屏】' : ''}`,
      cfg.skillDesc,
      caster.side === 'player' ? (hasOffensiveDmg ? '#fde047' : '#4ade80') : '#f87171',
      caster.id,
      null
    );
    battle.shakeTimer = Math.max(battle.shakeTimer || 0, caster.id === 'lvbu' ? 0.38 : (isFull ? 0.32 : (hasOffensiveDmg ? 0.24 : 0.12)));

    const vfxDur = caster.id === 'lvbu' ? 1.42 : (isFull ? 1.32 : 1.18);
    battle.skillEffects.push({
      generalId: caster.id,
      casterName: caster.name,
      x: vfxX,
      y: vfxY,
      casterX: prevX,
      casterY: prevY,
      facing,
      skillRole: cfg.skillRole || '',
      skillName: cfg.skillName,
      skillMechanicKind: mech.kind || '',
      isFullscreen: isFull,
      element: cfg.skillElement || 'thunder',
      vfxSpec: cfg.vfxSpec || null,
      life: vfxDur,
      maxLife: vfxDur,
    });
    spawnSparks(battle, vfxX, vfxY - 28, skillSparkCol, isFull ? 42 : 30);

    const hitRadius = isFull
      ? 720
      : ((cfg.skillType === 'pierce_column' || (cfg.vfxSpec && (cfg.vfxSpec.form === 'cavalry_stampede' || cfg.vfxSpec.form === 'dragon_lance_beam'))) ? 340 : 235);
    const skillBuffMult = 1 + (caster.skillDmgPct || 0) + ((caster.skillBuffTimer > 0 && caster.skillBuffPct) ? caster.skillBuffPct : 0);
    const missingHpScale = mech.missingHpBonus ? (1 + mech.missingHpBonus * Math.max(0, 1 - caster.hp / Math.max(1, caster.maxHp))) : 1;
    const rawPower = cfg.skillPower === undefined ? 2.0 : cfg.skillPower;
    const baseDmgScale = (isFull ? rawPower * (caster.id === 'lvbu' ? 0.94 : 0.86) : rawPower) * skillBuffMult * missingHpScale;

    // 1. 自身与全军特色治疗、持续回春、净化、护盾、增益与怒气激励！
    const plagueMult = (caster.side === 'player' && battle.activeDisaster && battle.activeDisaster.id === 'plague') ? 0.65 : 1.0;
    if (mech.cleanseSelf) {
      cleanseUnitDebuffs(caster);
      caster.immuneCtrlTimer = Math.max(caster.immuneCtrlTimer || 0, buffSec);
      addFloatText(battle, caster.x, caster.y - 74, '净化免控!', '#67e8f9', true);
    }
    if (mech.cleanseTeam) {
      let cleansedCnt = 0;
      allies.forEach((a) => {
        if (a.petrifyTimer > 0 || a.poisonTimer > 0 || a.burnTimer > 0 || a.bleedTimer > 0 || a.stunTimer > 0 || a.slowTimer > 0) cleansedCnt++;
        cleanseUnitDebuffs(a);
      });
      if (cleansedCnt > 0) addFloatText(battle, caster.x, caster.y - 84, '✦全军净化!', '#a7f3d0', true);
    }

    // ★ 群体一次性爆发治疗（含残血急救暴涨 + 剧毒重伤减疗判定 + 医圣溢出转护盾！）
    const teamHealPct = mech.healPct || mech.teamHealPct || (cfg.skillType === 'heal_burn' && !mech.kind ? 0.25 : 0);
    if (teamHealPct > 0) {
      allies.forEach((a) => {
        const lowHpMult = (mech.lowHpHealBonus && (a.hp / Math.max(1, a.maxHp)) <= 0.45) ? (1 + mech.lowHpHealBonus) : 1;
        const poisonCut = a.poisonTimer > 0 ? (1 - (a.healCutPct || 0.45)) : 1;
        const rawHeal = Math.max(1, Math.round((a.maxHp * teamHealPct + caster.atk * 0.45) * lowHpMult * plagueMult * poisonCut));
        const overheal = Math.max(0, (a.hp + rawHeal) - a.maxHp);
        a.hp = Math.min(a.maxHp, a.hp + rawHeal);
        if (mech.overhealShield && overheal > 10) {
          a.shieldHp = Math.max(a.shieldHp || 0, Math.round(overheal * 0.65));
          a.shieldTimer = Math.max(a.shieldTimer || 0, buffSec);
        }
        if (a.kind === 'general' || a.kind === 'beast' || Math.random() < 0.55) {
          addFloatText(battle, a.x, a.y - 56, `群疗+${rawHeal}`, '#4ade80', a.kind === 'general');
          battle.projectiles.push({ kind: 'impact_ring', x2: a.x, y2: a.y - 18, color: '#4ade80', isFan: true, life: 0.30, maxLife: 0.30 });
        }
      });
    }

    const selfHealPct = mech.selfHealPct || (cfg.skillType === 'lifesteal_cleave' && !mech.kind ? 0.22 : 0);
    if (selfHealPct > 0) {
      const poisonCut = caster.poisonTimer > 0 ? (1 - (caster.healCutPct || 0.45)) : 1;
      const heal = Math.max(1, Math.round(caster.maxHp * selfHealPct * plagueMult * poisonCut));
      caster.hp = Math.min(caster.maxHp, caster.hp + heal);
      addFloatText(battle, caster.x, caster.y - 62, `回血+${heal}`, '#4ade80', true);
    }
    if (mech.teamShieldPct) {
      allies.forEach((a) => {
        const sh = Math.round(a.maxHp * mech.teamShieldPct);
        a.shieldHp = Math.max(a.shieldHp || 0, sh);
        a.shieldTimer = Math.max(a.shieldTimer || 0, buffSec);
      });
      addFloatText(battle, caster.x, caster.y - 78, '🛡全军护盾!', '#67e8f9', true);
    }
    if (mech.selfShieldPct) {
      const sh = Math.round(caster.maxHp * mech.selfShieldPct);
      caster.shieldHp = Math.max(caster.shieldHp || 0, sh);
      caster.shieldTimer = Math.max(caster.shieldTimer || 0, buffSec);
      addFloatText(battle, caster.x, caster.y - 78, `护盾+${sh}`, '#67e8f9', true);
    }

    // ★ 逐渐持续治疗 (HoT)：按秒持续润脉回血！
    if (mech.selfHotPct) {
      caster.hotDps = Math.max(12, Math.round((caster.maxHp * mech.selfHotPct + caster.atk * 0.55) / buffSec));
      caster.hotTimer = buffSec;
      addFloatText(battle, caster.x, caster.y - 72, '✚持续生肌!', '#86efac', true);
    }
    if (mech.teamHotPct) {
      allies.forEach((a) => {
        a.hotDps = Math.max(10, Math.round((a.maxHp * mech.teamHotPct + caster.atk * 0.55) / buffSec));
        a.hotTimer = buffSec;
      });
      addFloatText(battle, vfxX, 218, '✚全军持续回春!', '#86efac', true);
    }

    if (mech.teamAtkBuff) allies.forEach((a) => { a.atkBuffPct = Math.max(a.atkBuffPct || 0, mech.teamAtkBuff); a.atkBuffTimer = Math.max(a.atkBuffTimer || 0, buffSec); });
    if (mech.selfAtkBuff) { caster.atkBuffPct = Math.max(caster.atkBuffPct || 0, mech.selfAtkBuff); caster.atkBuffTimer = Math.max(caster.atkBuffTimer || 0, buffSec); }
    if (mech.teamDefBuff) allies.forEach((a) => { a.defBuffPct = Math.max(a.defBuffPct || 0, mech.teamDefBuff); a.defBuffTimer = Math.max(a.defBuffTimer || 0, buffSec); });
    if (mech.selfDefBuff) { caster.defBuffPct = Math.max(caster.defBuffPct || 0, mech.selfDefBuff); caster.defBuffTimer = Math.max(caster.defBuffTimer || 0, buffSec); }
    if (mech.teamSpdBuff) allies.forEach((a) => { a.spdBuffPct = Math.max(a.spdBuffPct || 0, mech.teamSpdBuff); a.spdBuffTimer = Math.max(a.spdBuffTimer || 0, buffSec); });
    if (mech.selfSpdBuff) { caster.spdBuffPct = Math.max(caster.spdBuffPct || 0, mech.selfSpdBuff); caster.spdBuffTimer = Math.max(caster.spdBuffTimer || 0, buffSec); }
    if (mech.teamDmgRed) allies.forEach((a) => { a.dmgRedBuffPct = Math.max(a.dmgRedBuffPct || 0, mech.teamDmgRed); a.dmgRedBuffTimer = Math.max(a.dmgRedBuffTimer || 0, buffSec); });
    if (mech.selfDmgRed) { caster.dmgRedBuffPct = Math.max(caster.dmgRedBuffPct || 0, mech.selfDmgRed); caster.dmgRedBuffTimer = Math.max(caster.dmgRedBuffTimer || 0, buffSec); }
    if (mech.teamCritBuff) allies.forEach((a) => { a.critBuffPct = Math.max(a.critBuffPct || 0, mech.teamCritBuff); a.critBuffTimer = Math.max(a.critBuffTimer || 0, buffSec); });
    if (mech.selfCritBuff) { caster.critBuffPct = Math.max(caster.critBuffPct || 0, mech.selfCritBuff); caster.critBuffTimer = Math.max(caster.critBuffTimer || 0, buffSec); }
    if (mech.teamSkillBuff) allies.forEach((a) => { a.skillBuffPct = Math.max(a.skillBuffPct || 0, mech.teamSkillBuff); a.skillBuffTimer = Math.max(a.skillBuffTimer || 0, buffSec); });
    if (mech.selfSkillBuff) { caster.skillBuffPct = Math.max(caster.skillBuffPct || 0, mech.selfSkillBuff); caster.skillBuffTimer = Math.max(caster.skillBuffTimer || 0, buffSec); }
    if (mech.selfLifesteal) { caster.lifestealBuffPct = Math.max(caster.lifestealBuffPct || 0, mech.selfLifesteal); caster.lifestealBuffTimer = Math.max(caster.lifestealBuffTimer || 0, buffSec); }
    if (mech.selfThorns) { caster.thornsPct = Math.max(caster.thornsPct || 0, mech.selfThorns); caster.thornsTimer = Math.max(caster.thornsTimer || 0, buffSec); }

    if (mech.teamRageGrant) {
      allies.forEach((a) => {
        if (a !== caster && a.kind === 'general' && a.rage !== undefined) {
          a.rage = Math.min(100, a.rage + mech.teamRageGrant);
          addFloatText(battle, a.x, a.y - 68, `怒气+${mech.teamRageGrant}`, '#fde047');
        }
      });
    }
    if (mech.selfRageRefund) {
      caster.rage = Math.min(100, (caster.rage || 0) + mech.selfRageRefund);
    }

    // 貂蝉专属【闭月倾城魅惑】：优先锁定敌方攻击力最高的主将强控并夺取怒气
    if (mech.charmStrongestSec) {
      const enemyGens = enemies.filter((e) => e.kind === 'general' && !e.isProp);
      const topGen = enemyGens.sort((a, b) => (b.atk || 0) - (a.atk || 0))[0] || enemies[0];
      if (topGen && topGen.alive && !(topGen.immuneCtrlTimer > 0)) {
        topGen.stunTimer = Math.max(topGen.stunTimer || 0, mech.charmStrongestSec);
        if (mech.rageDrain && topGen.rage !== undefined) {
          const drained = Math.min(topGen.rage, mech.rageDrain);
          topGen.rage -= drained;
          caster.rage = Math.min(100, (caster.rage || 0) + Math.round(drained * 0.5));
        }
        addFloatText(battle, topGen.x, topGen.y - 84, '★倾城魅惑!', '#f472b6', true);
      }
    }

    // 召唤系名将专属亲卫登场（共享血量世界/联盟 BOSS 纯将战模式下不出小兵）
    if (!battle.noTroops && mech.summonTroop && mech.summonCount > 0 && TROOP_CARDS && TROOP_CARDS.length > 0) {
      const sCard = TROOP_CARDS.find((c) => c.id === mech.summonTroop) || TROOP_CARDS[0];
      const stLv = caster.side === 'player'
        ? Math.max(1, (App.State && App.State.get ? App.State.get().lordLevel : 1) || 1)
        : Math.max(1, (battle.level && battle.level.recommendedLv) || 5);
      const customTitleMap = {
        huangyueying: '机关甲士',
        zhangjiao: '黄巾力士',
        yuanshao: '先登死士',
        gongsunzan: '白马义从',
      };
      for (let i = 0; i < mech.summonCount; i++) {
        const sx = clampUnitX(battle, caster, caster.x + facing * (34 + i * 22));
        const sy = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, caster.y + (i % 2 === 0 ? -18 : 18)));
        const su = makeSoldier(battle.uidCounter++, caster.side, sCard, sx, sy, stLv);
        if (customTitleMap[caster.id]) su.name = customTitleMap[caster.id];
        battle.units.push(su);
        spawnSparks(battle, sx, sy - 20, skillSparkCol, 10);
      }
      addFloatText(battle, caster.x, caster.y - 82, `召唤·${customTitleMap[caster.id] || sCard.name}!`, '#fde047', true);
    }

    // 2. 对敌军造成伤害与专属破盾、斩杀、击退、牵引、连环、破甲与剧毒/灼烧/流血持续异常！
    if (hasOffensiveDmg) {
      enemies.forEach((e) => {
        if (e.isMainBase && Math.abs(e.x - caster.x) > 320) return;
        const inRange = isFull
          ? (Math.abs(e.x - vfxX) <= hitRadius)
          : (Math.hypot(e.x - vfxX, (e.y - vfxY) * 1.2) <= hitRadius || (mech.dashAdvance && Math.hypot(e.x - caster.x, (e.y - caster.y) * 1.2) <= 185));
        if (!inRange) return;

        if (mech.breakShields && (e.shieldHp || 0) > 0) {
          e.shieldHp = 0;
          e.shieldTimer = 0;
          addFloatText(battle, e.x, e.y - 80, '破盾!', '#fbbf24', true);
        }

        let unitScale = baseDmgScale;
        if (mech.executeBonus && (e.hp / Math.max(1, e.maxHp)) <= 0.50) {
          unitScale *= (1 + mech.executeBonus);
        }
        if (mech.towerBonusDmg && (e.isBase || e.isMainBase)) {
          unitScale *= (1 + mech.towerBonusDmg);
        }

        if (mech.poisonDpsPct && !e.isProp) {
          const coreBoost = (mech.targetCorePoison && e.kind === 'general') ? 1.25 : 1.0;
          e.poisonDps = Math.max(e.poisonDps || 0, Math.round(caster.atk * mech.poisonDpsPct * coreBoost));
          e.poisonTimer = Math.max(e.poisonTimer || 0, debuffSec);
          e.poisonSpread = !!(e.poisonSpread || mech.poisonSpread);
          e.healCutPct = Math.max(e.healCutPct || 0, mech.healCutPct || 0.45);
        }

        const dmgOpts = {
          fromSkill: true,
          sparkColor: skillSparkCol,
          forceCrit: !!mech.guaranteedCrit,
          bonusCritDmg: mech.bonusCritDmg || 0,
          armorIgnore: mech.armorIgnore || 0,
        };
        dealDamage(battle, caster, e, unitScale, dmgOpts);
        if (mech.bonusHits && e.alive) {
          for (let bh = 0; bh < mech.bonusHits; bh++) {
            if (!e.alive) break;
            dealDamage(battle, caster, e, unitScale * 0.28, dmgOpts);
          }
        }
        if (!e.alive) return;

        if (mech.poisonDpsPct && !e.isProp && (e.kind === 'general' || Math.random() < 0.45)) {
          addFloatText(battle, e.x, e.y - 74, '☠剧毒禁疗!', '#a3e635', e.kind === 'general');
        }

        if (!e.isProp && !e.isMainBase) {
          if (mech.knockback) {
            e.x = clampUnitX(battle, e, e.x + facing * mech.knockback);
            e.knockX = facing * 9;
          } else if (mech.pullIn) {
            e.x = clampUnitX(battle, e, e.x + (vfxX - e.x) * 0.42);
            e.y = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, e.y + (vfxY - e.y) * 0.35));
          }
        }

        const petrifyDur = mech.petrifySec || (cfg.skillType === 'petrify_aoe' ? 2.2 : 0);
        if (petrifyDur > 0 && !(e.immuneCtrlTimer > 0) && !e.isProp) {
          e.petrifyTimer = Math.max(e.petrifyTimer || 0, petrifyDur);
          e.moving = false;
          e.moveBlend = 0;
          e.atkProg = 0;
          spawnSparks(battle, e.x, e.y - 26, '#d6d3d1', 8);
          addFloatText(battle, e.x, e.y - 78, '🗿石化禁锢!', '#e7e5e4', true);
        }

        const stunDur = mech.stunSec || ((cfg.skillType.includes('stun') || cfg.skillType.includes('freeze')) ? (isFull ? 2.0 : 2.5) : 0);
        if (stunDur > 0 && !(e.immuneCtrlTimer > 0) && !e.isProp) {
          e.stunTimer = Math.max(e.stunTimer || 0, stunDur);
          const stunLabel = caster.id === 'lvbu' ? '★无双震晕!' : (cfg.skillElement === 'ice' ? '★冰封!' : '★眩晕!');
          addFloatText(battle, e.x, e.y - 76, stunLabel, '#fde047', true);
        }

        if (mech.armorBreak) { e.armorBreakPct = Math.max(e.armorBreakPct || 0, mech.armorBreak); e.armorBreakTimer = Math.max(e.armorBreakTimer || 0, debuffSec); }
        if (mech.weakenAtk) { e.weakenAtkPct = Math.max(e.weakenAtkPct || 0, mech.weakenAtk); e.weakenTimer = Math.max(e.weakenTimer || 0, debuffSec); }
        if (mech.slowPct) { e.slowPct = Math.max(e.slowPct || 0, mech.slowPct); e.slowTimer = Math.max(e.slowTimer || 0, debuffSec); }
        if (mech.vulnPct) { e.vulnPct = Math.max(e.vulnPct || 0, mech.vulnPct); e.vulnTimer = Math.max(e.vulnTimer || 0, debuffSec); }
        if (mech.chainLink && !e.isProp) {
          e.chainLinkTimer = Math.max(e.chainLinkTimer || 0, debuffSec);
          addFloatText(battle, e.x, e.y - 70, '⛓连环', '#fb923c');
        }
        if (mech.burnDpsPct && !e.isProp) {
          e.burnDps = Math.max(e.burnDps || 0, Math.round(caster.atk * mech.burnDpsPct));
          e.burnTimer = Math.max(e.burnTimer || 0, debuffSec);
          if (e.kind === 'general') addFloatText(battle, e.x, e.y - 72, '🔥灼烧!', '#fb923c');
        }
        if (mech.bleedDpsPct && !e.isProp) {
          e.bleedDps = Math.max(e.bleedDps || 0, Math.round(caster.atk * mech.bleedDpsPct));
          e.bleedTimer = Math.max(e.bleedTimer || 0, debuffSec);
          if (e.kind === 'general') addFloatText(battle, e.x, e.y - 72, '🩸撕裂!', '#fb7185');
        }
        if ((mech.silenceRage || (mech.rageDrain && !mech.charmStrongestSec)) && e.kind === 'general' && e.rage !== undefined) {
          const drainAmt = mech.silenceRage || mech.rageDrain || 0;
          e.rage = Math.max(0, e.rage - drainAmt);
        }
      });

      battle.towers.forEach((t) => {
        if (t.alive && t.side === enemySide && (isFull ? Math.abs(t.x - vfxX) <= hitRadius : Math.hypot(t.x - vfxX, t.y - vfxY) <= 205)) {
          const twMult = baseDmgScale * 0.82 * (mech.towerBonusDmg ? (1 + mech.towerBonusDmg) : 1);
          dealDamage(battle, caster, t, twMult, { fromSkill: true, sparkColor: skillSparkCol });
        }
      });
    }

    checkBattleEnd(battle);
    return true;
  }

  function castBeastUltimate(battle, beastUnit) {
    if (!beastUnit || !beastUnit.alive || battle.status !== 'fighting') return false;
    const bCfg = beastUnit.beastCfg || App.Config.BEASTS[beastUnit.id];
    const enemySide = beastUnit.side === 'player' ? 'enemy' : 'player';
    const rawTargets = battle.units.filter((u) => u.alive && u.side === enemySide && (!u.isMainBase || Math.abs(u.x - beastUnit.x) <= 320));
    const enemyTowers = battle.towers.filter((tw) => tw.alive && tw.side === enemySide);
    if (!rawTargets.length && !enemyTowers.length) return false;

    beastUnit.rage = 0;
    beastUnit.attackAnim = 1.0;
    beastUnit.castAnim = 0.92;

    // 优先轰击前线敌将与机动敌兵，再波及敌军主营
    const targets = rawTargets.slice().sort((a, b) => (a.isMainBase ? 1 : 0) - (b.isMainBase ? 1 : 0));

    if (App.Audio) App.Audio.playSfx('ultimate');
    if (beastUnit.side === 'player' && App.Platform && App.Platform.vibrateShort) App.Platform.vibrateShort('heavy');
    showBanner(battle, `四象降临 · ${bCfg.name}【${bCfg.skillName}】`, bCfg.skillDesc, bCfg.glow, null, beastUnit.id);
    battle.shakeTimer = Math.max(battle.shakeTimer || 0, 0.45);
    const elemMap = { qinglong: 'thunder', zhuque: 'fire', baihu: 'slash_crimson', xuanwu: 'ice' };
    const focusX = targets[0] ? targets[0].x : (enemyTowers[0] ? enemyTowers[0].x : (battle.cameraX + App.Platform.LOGICAL_W / 2));

    battle.skillEffects.push({
      beastId: beastUnit.id,
      casterName: bCfg.name,
      x: Math.max(220, Math.min(WORLD_W - 180, focusX)),
      y: 285,
      casterX: beastUnit.x,
      casterY: beastUnit.y,
      facing: beastUnit.facing || 1,
      skillName: bCfg.skillName,
      isFullscreen: true,
      element: elemMap[beastUnit.id] || 'thunder',
      life: 1.90,
      maxLife: 1.90,
    });

    const bSkillMult = 1 + (beastUnit.skillDmgPct || 0);
    targets.slice(0, 8).forEach((t) => {
      dealDamage(battle, beastUnit, t, (beastUnit.id === 'baihu' ? 2.15 : 1.65) * bSkillMult, { fromSkill: true, sparkColor: bCfg.glow || '#fde047' });
      if (t.alive && (beastUnit.id === 'qinglong' || beastUnit.id === 'xuanwu')) {
        t.stunTimer = Math.max(t.stunTimer, 2.1);
      }
    });
    enemyTowers.forEach((tw) => {
      dealDamage(battle, beastUnit, tw, 1.35, { fromSkill: true, sparkColor: bCfg.glow || '#fde047' });
    });

    if (beastUnit.id === 'zhuque') {
      battle.units.filter((a) => a.alive && a.side === beastUnit.side).forEach((a) => {
        const h = Math.round(a.maxHp * 0.24);
        a.hp = Math.min(a.maxHp, a.hp + h);
        addFloatText(battle, a.x, a.y - 52, `+${h}`, '#4ade80');
      });
    }
    checkBattleEnd(battle);
    return true;
  }

  // 招降 / 捕获：成功与否由服务端掷骰，这里只更新界面状态（严格等待结算落库并对齐次数上限）
  function postVictoryRecruit(battle, isAdDouble) {
    if (!battle.captiveGeneralId || battle.recruitState === 'success' || battle.recruitState === 'exhausted') {
      return Promise.resolve({ ok: false });
    }
    if (!battle.settled || battle.settling) {
      if (App.UI) App.UI.showToast('正在同步凯旋战果，请稍候…', '#fde047');
      return Promise.resolve({ ok: false });
    }
    return App.State.recruit(battle.serverId, isAdDouble).then((res) => {
      if (!res.ok) return res;
      battle.recruitTries = (battle.recruitTries || 0) + 1;
      if (res.success) {
        battle.recruitState = 'success';
      } else if (isAdDouble || battle.recruitTries >= 2) {
        battle.recruitState = 'exhausted';
      } else {
        battle.recruitState = 'failed';
      }
      battle.recruitDuplicate = !!res.duplicate;
      if (res.success && App.Audio) App.Audio.playSfx('recruit');
      if (res.success && App.Platform && App.Platform.vibrateShort) App.Platform.vibrateShort('heavy');
      return res;
    });
  }

  function postVictoryCatchBeast(battle, useGoldRope) {
    if (!battle.captiveBeastId || battle.catchState === 'success' || battle.catchState === 'exhausted') {
      return Promise.resolve({ ok: false });
    }
    if (!battle.settled || battle.settling) {
      if (App.UI) App.UI.showToast('正在同步讨伐战果，请稍候…', '#fde047');
      return Promise.resolve({ ok: false });
    }
    return App.State.catchBeast(battle.serverId, useGoldRope).then((res) => {
      if (!res.ok) return res;
      battle.catchTries = (battle.catchTries || 0) + 1;
      if (res.success) {
        battle.catchState = 'success';
      } else if (useGoldRope || battle.catchTries >= 2) {
        battle.catchState = 'exhausted';
      } else {
        battle.catchState = 'failed';
      }
      if (res.success && App.Audio) App.Audio.playSfx('recruit');
      return res;
    });
  }

  function checkBattleEnd(battle) {
    if (battle.status !== 'fighting') return;
    const pAlive = battle.units.filter((u) => u.alive && u.side === 'player');
    const eAlive = battle.units.filter((u) => u.alive && u.side === 'enemy');
    const eTowersAlive = battle.towers.filter((t) => t.alive && t.side === 'enemy');
    const beastCleared = battle.mode === 'beast' && !battle.units.some((u) => u.alive && u.isWildBeast);
    const chaosCleared = battle.mode === 'chaos' && !battle.units.some((u) => u.alive && u.isWildBeast);
    const enemyBaseCleared = battle.enemyBase ? !battle.enemyBase.alive : true;
    const playerBaseLost = battle.playerBase ? !battle.playerBase.alive : false;

    const finalRound = battle.round >= battle.totalRounds;
    const sp = battle.special;
    // 共享血量 BOSS：BOSS 倒下、限时结束或我军覆没都算完成一场，按造成的伤害结算
    const raid = !!(battle.level && battle.level.raid);
    const raidCleared = raid && !battle.units.some((u) => u.alive && u.isRaidBoss);
    const normalWin = !(sp && sp.manualEnd) && finalRound && (
      beastCleared
      || chaosCleared
      || raidCleared
      || (battle.enemyBase && enemyBaseCleared)
      || (eAlive.length === 0 && eTowersAlive.length === 0)
    );
    const pMobileCount = pAlive.filter((u) => !u.isProp).length;
    const allPlayerGensDead = areAllPlayerGeneralsDead(battle);
    if (allPlayerGensDead) {
      if (!battle.defeatReason) battle.defeatReason = 'generals_dead';
      battle.forceEnd = 'lose';
    }
    // 我方出战武将全部战死即对局失败；或我方主营被攻破 / 机动兵将全灭判负
    const isPassMode = sp && (sp.type === 'pass' || sp.type === 'xian' || sp.type === 'mo');
    const wiped = allPlayerGensDead
      || (playerBaseLost && !(sp && sp.type === 'defend'))
      || (!battle.playerBase && pMobileCount === 0 && !(sp && (sp.type === 'defend' || sp.type === 'escort')))
      || (isPassMode && pMobileCount === 0);
    if (isPassMode && normalWin && !allPlayerGensDead) battle.passCleared = battle.totalRounds;
    if (isPassMode && wiped && !allPlayerGensDead && (battle.passCleared || 0) >= 1 && !battle.forceEnd) battle.forceEnd = 'win';
    if ((raid && (battle.forceEnd || wiped || normalWin)) || (!allPlayerGensDead && (battle.forceEnd === 'win' || (battle.forceEnd !== 'lose' && normalWin)))) {
      battle.status = 'victory';
      battle.aimingUnit = null;
      if (App.Audio) App.Audio.playSfx('victory');
      if (App.Platform && App.Platform.vibrateShort) App.Platform.vibrateShort('medium');
      if (!battle.rewardClaimed) {
        battle.rewardClaimed = true;
        // 胜负上报服务端，由服务端发放铜钱、将魂、装备、经验并标记通关
        battle.status = 'victory';
        if (!battle.serverId) {
          battle.settled = true;
        } else {
          battle.settling = true;
          App.State.finishBattle(battle.serverId, true, specialScore(battle)).then((res) => {
            battle.settling = false;
            battle.settled = true;
            if (!res || !res.ok) return;
            if (res.battle) {
              const fc = res.firstClearBonus || {};
              battle.goldReward = (res.battle.gold || 0) + (fc.gold || 0);
              battle.soulReward = (res.battle.soul || 0) + (fc.soul || 0);
              battle.expGain = res.battle.exp || 0;
              if (fc.gold > 0) App.UI.showToast(`★ 首通破城双倍悬赏：额外铜钱+${fc.gold} · 将魂+${fc.soul}！`, '#fde047');
            }
            if (res.loot && res.loot.length) { battle.lootText = (raid ? '' : '战利品：') + res.loot.join(' · '); App.UI.showToast(battle.lootText, '#fde047'); }
            battle.droppedEquip = res.droppedEquip || null;
            battle.droppedMat = res.droppedMat || null;
            if (res.droppedMat && res.droppedMat.name) {
              App.UI.showToast(`✦ 鸿运爆出章节法宝灵材：【${res.droppedMat.name}】×${res.droppedMat.count || 1}！`, '#fda4af');
            }
            battle.levelUpInfo = res.lvInfo || null;
            if (res.arenaRank && res.arenaRankFrom && res.arenaRank < res.arenaRankFrom) App.UI.showToast(`演武场名次提升：第 ${res.arenaRankFrom} 名 → 第 ${res.arenaRank} 名！`, '#fde047');
            else if (res.arenaNote) App.UI.showToast(res.arenaNote, '#fde68a');
          }).catch(() => {
            battle.settling = false;
            battle.settled = true;
          });
        }
      }
    } else if (battle.forceEnd === 'lose' || wiped) {
      if (!battle.defeatReason) {
        if (allPlayerGensDead) battle.defeatReason = 'generals_dead';
        else if (playerBaseLost) battle.defeatReason = 'base_lost';
        else if (sp && sp.type === 'escort') battle.defeatReason = 'cart_lost';
        else battle.defeatReason = 'wiped';
      }
      battle.status = 'defeat';
      battle.aimingUnit = null;
      if (App.Audio) App.Audio.playSfx('defeat');
      if (!battle.serverId) {
        battle.settled = true;
      } else {
        battle.settling = true;
        App.State.finishBattle(battle.serverId, false).finally(() => {
          battle.settling = false;
          battle.settled = true;
        });
      }
    }
  }

  function updateSingleBattleArtifact(battle, relic, dt, rawDt) {
    if (!relic) return;
    if (relic.castFlash > 0) relic.castFlash = Math.max(0, relic.castFlash - rawDt * 1.6);

    // 随军悬浮护主定位：紧随己方先锋主将斜上方灵空悬浮，镜头全程可见！
    const allies = battle.units.filter((u) => u.alive && u.side === relic.side && !u.isProp);
    const gens = allies.filter((u) => u.kind === 'general');
    let anchor = null;
    if (gens.length) {
      anchor = gens.reduce((best, g) => {
        if (!best) return g;
        return relic.side === 'player' ? (g.x > best.x ? g : best) : (g.x < best.x ? g : best);
      }, null);
    } else if (allies.length) {
      anchor = allies[0];
    } else {
      anchor = relic.side === 'player' ? battle.playerBase : battle.enemyBase;
    }
    if (anchor) {
      const dir = relic.side === 'player' ? 1 : -1;
      relic.facing = dir;
      const tx = Math.max(96, Math.min(WORLD_W - 96, anchor.x - dir * 34));
      const ty = Math.max(114, Math.min(182, anchor.y - 108));
      const lerp = Math.min(1, rawDt * 6.2);
      relic.x += (tx - relic.x) * lerp;
      relic.y += (ty - relic.y) * lerp;
    }

    if (battle.status !== 'fighting' || dt <= 0 || battle.introTimer > 0) return;

    // 1. 开战瞬间：法宝护军金环共鸣与先机提示
    if (!relic.introBlessed) {
      relic.introBlessed = true;
      relic.castFlash = 0.90;
      gens.forEach((g) => {
        battle.projectiles.push({
          kind: 'impact_ring',
          x2: g.x,
          y2: g.y - 10,
          color: relic.color,
          isFan: true,
          life: 0.38,
          maxLife: 0.38,
        });
      });
      if (anchor) {
        const rageBonus = relic.cfg.activeRage != null ? relic.cfg.activeRage : 10;
        addFloatText(battle, relic.x, relic.y - 34, `✦${relic.name}护军 · 怒+${rageBonus}✦`, relic.subColor, true);
      }
    }

    // 2. 周期蓄满释放【镇军法宝神威】：化出神光轰击前线敌群并庇护友军！
    relic.pulseTimer -= dt;
    if (relic.pulseTimer <= 0) {
      const enemySide = relic.side === 'player' ? 'enemy' : 'player';
      const candidates = battle.units.filter((u) => u.alive && u.side === enemySide && Math.abs(u.x - relic.x) <= 460 && (!u.isMainBase || Math.abs(u.x - relic.x) <= 290));
      const nearTowers = battle.towers.filter((tw) => tw.alive && tw.side === enemySide && Math.abs(tw.x - relic.x) <= 420);
      if (!candidates.length && !nearTowers.length) {
        relic.pulseTimer = 0.35;
        return;
      }
      relic.pulseTimer = relic.pulseInterval;
      relic.castFlash = 1.0;

      // 优先锁定敌方武将与前锋兵卒
      const sorted = candidates.slice().sort((a, b) => {
        const pa = a.kind === 'general' ? 0 : (a.kind === 'beast' ? 1 : (a.isMainBase ? 3 : 2));
        const pb = b.kind === 'general' ? 0 : (b.kind === 'beast' ? 1 : (b.isMainBase ? 3 : 2));
        return pa - pb || Math.abs(a.x - relic.x) - Math.abs(b.x - relic.x);
      });
      const hitList = sorted.slice(0, 4);
      if (!hitList.length && nearTowers[0]) hitList.push(nearTowers[0]);

      const casterRef = gens[0] || allies[0];
      const qBase = relic.quality === 'gold' ? 0.90 : (relic.quality === 'purple' ? 0.74 : 0.60);
      const dmgScale = qBase * (1 + (relic.lv - 1) * 0.03);

      addFloatText(battle, relic.x, relic.y - 36, `✦${relic.name}·神威✦`, relic.color, true);
      spawnSparks(battle, relic.x, relic.y, relic.subColor, 14);

      hitList.forEach((t, idx) => {
        battle.projectiles.push({
          kind: 'relic_beam',
          x1: relic.x,
          y1: relic.y,
          x2: t.x,
          y2: t.y - (t.kind === 'beast' ? 36 : 22),
          color: relic.color,
          coreColor: relic.subColor,
          isPrimary: idx === 0,
          life: 0.42,
          maxLife: 0.42,
        });
        if (casterRef) {
          dealDamage(battle, casterRef, t, dmgScale * (idx === 0 ? 1.0 : 0.72), {
            fromSkill: true,
            sparkColor: relic.color,
          });
        }
      });

      // 若该法宝带有吸血/续航流派特技，神威脉动同步为前线受损将领润脉回血
      if ((relic.cfg.activeLifesteal || 0) > 0 && gens.length) {
        gens.forEach((g) => {
          if (g.hp < g.maxHp) {
            const heal = Math.max(8, Math.round(g.maxHp * (0.03 + (relic.lv - 1) * 0.0015)));
            g.hp = Math.min(g.maxHp, g.hp + heal);
            addFloatText(battle, g.x, g.y - 56, `灵宝+${heal}`, '#4ade80');
          }
        });
      }
      checkBattleEnd(battle);
    }
  }

  function updateBattle(battle, rawDt) {
    const isPaused = syncPaused(battle);
    const clampedRaw = Math.min(0.05, rawDt);
    const activeRaw = isPaused ? 0 : clampedRaw;
    if (!isPaused) {
      battle.animTime = (battle.animTime || 0) + clampedRaw;
    }
    if (battle.introTimer > 0) {
      battle.introTimer = Math.max(0, battle.introTimer - activeRaw);
    }
    const aimSlow = battle.aimingUnit ? 0.2 : 1.0;
    const dt = activeRaw * (battle.speedMult * aimSlow);
    const fxDt = battle.status === 'fighting' ? dt : activeRaw;

    if (battle.shakeTimer > 0) battle.shakeTimer = Math.max(0, battle.shakeTimer - fxDt);
    if (battle.banner) {
      battle.banner.timer -= fxDt;
      if (battle.banner.timer <= 0) battle.banner = null;
    }

    for (let i = battle.floatTexts.length - 1; i >= 0; i--) {
      const f = battle.floatTexts[i];
      f.life -= fxDt;
      f.y -= 28 * fxDt;
      if (f.vx) f.x += f.vx * fxDt;
      if (f.life <= 0) battle.floatTexts.splice(i, 1);
    }
    // ★ 更新近战刀芒/枪影与真实抛物线弹道飞行物（羽箭/罡风法刃沿抛物线切线飞行，命中瞬间爆发伤害与冲击环！）
    for (let i = battle.projectiles.length - 1; i >= 0; i--) {
      const p = battle.projectiles[i];
      if (p.ballistic) {
        if (dt <= 0) continue;
        p.t += dt / (p.duration || 0.28);
        if (p.target && p.target.alive && p.t < 0.80) {
          p.x2 = p.target.x;
          p.y2 = p.target.y - (p.target.kind === 'beast' ? 46 : (p.target.isMounted ? 36 : 24));
        }
        const tt = Math.min(1, p.t);
        const cx = p.x1 + (p.x2 - p.x1) * tt;
        const cy = p.y1 + (p.y2 - p.y1) * tt - 4 * (p.arcH || 20) * tt * (1 - tt);
        const dx = p.x2 - p.x1;
        const dy = (p.y2 - p.y1) - 4 * (p.arcH || 20) * (1 - 2 * tt);
        p.cx = cx;
        p.cy = cy;
        p.ang = Math.atan2(dy, dx);
        if (!p.trail) p.trail = [];
        p.trail.push({ x: cx, y: cy });
        if (p.trail.length > 8) p.trail.shift();

        if (p.t >= 1) {
          if (battle.status === 'fighting' && p.target && p.target.alive && p.attacker) {
            const isFan = p.kind === 'fan_wave' || p.kind === 'gen_fan';
            dealDamage(battle, p.attacker, p.target, p.dmgMult || 1.0, {
              fromProjectile: true,
              sparkColor: p.atkVfx ? p.color : (isFan ? p.color : '#fef08a'),
            });
            battle.projectiles.push({
              kind: 'impact_ring',
              x2: p.x2,
              y2: p.y2,
              color: p.color,
              isFan: isFan || !!p.atkVfx,
              life: 0.24,
              maxLife: 0.24,
            });
            if (p.atkVfx && p.atkVfx !== 'none') {
              battle.projectiles.push({
                kind: 'weapon_burst',
                atkVfx: p.atkVfx,
                vfxTier: p.vfxTier || 2,
                vfxTex1: p.vfxTex1,
                vfxTex2: p.vfxTex2,
                color: p.color,
                coreColor: p.coreColor || '#ffffff',
                x2: p.x2,
                y2: p.y2,
                dir: p.x2 >= p.x1 ? 1 : -1,
                scale: 0.96 * (p.vfxScale || 1.12),
                life: 0.28,
                maxLife: 0.28,
              });
            }
            checkBattleEnd(battle);
          }
          battle.projectiles.splice(i, 1);
        }
      } else {
        p.life -= fxDt;
        if (p.life <= 0) battle.projectiles.splice(i, 1);
      }
    }
    for (let i = battle.skillEffects.length - 1; i >= 0; i--) {
      battle.skillEffects[i].life -= fxDt;
      if (battle.skillEffects[i].life <= 0) battle.skillEffects.splice(i, 1);
    }
    for (let i = battle.dyingUnits.length - 1; i >= 0; i--) {
      battle.dyingUnits[i].dieTimer -= fxDt;
      if (battle.dyingUnits[i].dieTimer <= 0) battle.dyingUnits.splice(i, 1);
    }
    for (let i = battle.dustParticles.length - 1; i >= 0; i--) {
      const d = battle.dustParticles[i];
      d.life -= fxDt; d.x += d.vx * fxDt; d.y += d.vy * fxDt;
      if (d.life <= 0) battle.dustParticles.splice(i, 1);
    }
    for (let i = battle.sparks.length - 1; i >= 0; i--) {
      const s = battle.sparks[i];
      s.life -= fxDt; s.x += s.vx * fxDt; s.y += s.vy * fxDt; s.vy += 180 * fxDt;
      if (s.life <= 0) battle.sparks.splice(i, 1);
    }
    for (let i = battle.aoeZones.length - 1; i >= 0; i--) {
      const z = battle.aoeZones[i];
      z.timer -= dt;
      if (z.timer <= 0) {
        if (z.onDetonate) z.onDetonate();
        battle.aoeZones.splice(i, 1);
      }
    }

    if (battle.status !== 'fighting' || dt <= 0) {
      if (battle.playerArtifact) updateSingleBattleArtifact(battle, battle.playerArtifact, 0, activeRaw);
      if (battle.enemyArtifact) updateSingleBattleArtifact(battle, battle.enemyArtifact, 0, activeRaw);
      return;
    }

    if (battle.playerArtifact) updateSingleBattleArtifact(battle, battle.playerArtifact, dt, activeRaw);
    if (battle.enemyArtifact && battle.status === 'fighting') updateSingleBattleArtifact(battle, battle.enemyArtifact, dt, activeRaw);
    if (battle.status !== 'fighting') return;

    if (!battle.noTroops) {
      if (battle.centerNode) {
        const pNearNode = battle.units.some((u) => u.alive && u.side === 'player' && !u.isProp && u.x > battle.centerNode.x - 60);
        const eNearNode = battle.units.some((u) => u.alive && u.side === 'enemy' && !u.isProp && u.x < battle.centerNode.x + 60);
        if (pNearNode && !eNearNode && battle.centerNode.owner !== 'player') {
          battle.centerNode.owner = 'player';
          if (App.UI) App.UI.showToast('已占领中军辎重矿！木材粮草产出翻倍！', '#4ade80');
        } else if (eNearNode && !pNearNode && battle.centerNode.owner === 'player') {
          battle.centerNode.owner = 'enemy';
        }
      }

      battle.resTimer += dt;
      if (battle.resTimer >= 2.0) {
        battle.resTimer -= 2.0;
        const wt = battle.woodTick || 10;
        const ft = battle.foodTick || 10;
        battle.wood = Math.min(999, battle.wood + wt);
        battle.food = Math.min(999, battle.food + ft);
        addFloatText(battle, 56, 118, `+${wt} 木材`, '#fde047');
        addFloatText(battle, 56, 286, `+${ft} 粮草`, '#86efac');
        if (battle.centerNode && battle.centerNode.owner === 'player') {
          battle.wood = Math.min(999, battle.wood + 12);
          battle.food = Math.min(999, battle.food + 12);
          addFloatText(battle, battle.centerNode.x, battle.centerNode.y - 42, '+12木 +12粮', '#4ade80', true);
        }
      }

      // ★ 已开启自动出兵的兵种持续轮流派兵（支持单兵种连发或多兵种协同出营；统将战死后自动停派）
      if (battle.autoTroops) {
        const activeIdxs = [];
        for (let i = 0; i < TROOP_CARDS.length; i++) {
          if (!battle.autoTroops[i]) continue;
          const cmd = getTroopCommandState(battle, TROOP_CARDS[i].id);
          if (!cmd.deployed || cmd.aliveCount <= 0) {
            battle.autoTroops[i] = false;
            continue;
          }
          activeIdxs.push(i);
        }
        if (activeIdxs.length > 0) {
          battle.autoTroopTimer = (battle.autoTroopTimer || 0) - dt;
          if (battle.autoTroopTimer <= 0) {
            let spawned = false;
            const n = activeIdxs.length;
            const startCur = (battle.autoTroopCursor || 0) % n;
            for (let step = 0; step < n; step++) {
              const pickPos = (startCur + step) % n;
              const cIdx = activeIdxs[pickPos];
              if (dispatchOneTroop(battle, cIdx, true)) {
                battle.autoTroopCursor = (pickPos + 1) % n;
                spawned = true;
                break;
              }
            }
            battle.autoTroopTimer = spawned ? (battle.autoTroopInterval || 1.15) : 0.25;
          }
        }
      }
    }

    // ★ 随机自然灾害系统（并非每关都有：仅当本局随机命中 hasDisaster 时才会触发，且同一时刻严格最多1种天象！）
    if (battle.hasDisaster && battle.mode !== 'arena' && battle.introTimer <= 0) {
      if (battle.activeDisaster) {
        battle.disasterRemain -= dt;
        const dis = battle.activeDisaster;

        // 冰雹周期砸击己方将领、神兽与小兵
        if (dis.hailStrike) {
          battle.hailTickTimer -= dt;
          if (battle.hailTickTimer <= 0) {
            battle.hailTickTimer = 1.55;
            const pUnits = battle.units.filter((u) => u.alive && u.side === 'player');
            for (let h = 0; h < Math.min(3, pUnits.length); h++) {
              const victim = pUnits[Math.floor(Math.random() * pUnits.length)];
              if (victim && victim.hp > victim.maxHp * 0.10) {
                const hdmg = Math.max(10, Math.round(victim.maxHp * 0.036));
                victim.hp = Math.max(Math.ceil(victim.maxHp * 0.08), victim.hp - hdmg);
                victim.hitFlash = 0.14;
                spawnSparks(battle, victim.x, victim.y - 34, '#bae6fd', 7);
                addFloatText(battle, victim.x, victim.y - 62, `冰雹 -${hdmg}`, '#7dd3fc');
              }
            }
          }
        }

        // 瘟疫毒瘴周期侵蚀己方将领、神兽与小兵生命
        if (dis.plagueDrain) {
          battle.plagueTickTimer -= dt;
          if (battle.plagueTickTimer <= 0) {
            battle.plagueTickTimer = 1.35;
            battle.units.forEach((u) => {
              if (u.alive && u.side === 'player' && u.hp > u.maxHp * 0.10) {
                const pdmg = Math.max(6, Math.round(u.hp * dis.plagueDrain));
                u.hp = Math.max(Math.ceil(u.maxHp * 0.08), u.hp - pdmg);
                if (u.kind !== 'soldier' || Math.random() < 0.35) {
                  addFloatText(battle, u.x, u.y - 56, `瘟疫 -${pdmg}`, '#a3e635');
                }
              }
            });
          }
        }

        if (battle.disasterRemain <= 0) {
          battle.activeDisaster = null;
          battle.nextDisasterTimer = 18.0 + Math.random() * 6.0;
        }
      } else if ((battle.disasterCount || 0) < (battle.maxDisasters || 1)) {
        battle.nextDisasterTimer -= dt;
        if (battle.nextDisasterTimer <= 0 && App.Config.DISASTERS && App.Config.DISASTERS.length) {
          const pool = App.Config.DISASTERS;
          const forced = (battle.level && battle.level.forceDisasterId)
            ? pool.find((d) => d.id === battle.level.forceDisasterId)
            : null;
          const lastId = battle.lastDisasterId || null;
          const candidates = pool.length > 1 ? pool.filter((d) => d.id !== lastId) : pool;
          const pick = forced || candidates[Math.floor(Math.random() * candidates.length)];
          battle.activeDisaster = pick;
          battle.lastDisasterId = pick.id;
          battle.disasterCount = (battle.disasterCount || 0) + 1;
          battle.disasterRemain = 8.0;
          battle.hailTickTimer = 0.8;
          battle.plagueTickTimer = 0.9;
          if (App.Audio) App.Audio.playSfx('disaster');
        }
      }
    }

    // 敌军波次派兵（前期关卡间隔舒缓，随关卡深入逐步加快！）
    battle.enemyWaveTimer -= dt;
    const stageOrd = (battle.level && battle.level.order) || 10;
    const maxEnemyCap = stageOrd <= 5 ? 9 : 16;
    updateSpecial(battle, dt);
    if (battle.level && battle.level.raid && battle.status === 'fighting' && battle.introTimer <= 0) {
      battle.raidTimeLeft -= dt;
      if (battle.raidTimeLeft <= 0) { battle.raidTimeLeft = 0; battle.forceEnd = 'win'; checkBattleEnd(battle); }
    }

    // 本轮机动敌军全灭 → 倒计时后下一轮（玩家可点「嘲讽」或推进至敌方箭垒前线立即触发下一轮）
    if (battle.status === 'fighting' && battle.round < battle.totalRounds && battle.introTimer <= 0) {
      const hasMobileEnemy = battle.units.some((u) => u.alive && u.side === 'enemy' && !u.isMainBase);
      const vanguardAtGate = !hasMobileEnemy && battle.units.some((u) => u.alive && u.side === 'player' && !u.isProp && u.x > 1100);
      if (vanguardAtGate) {
        nextRound(battle);
      } else if (battle.roundWaiting) {
        battle.roundCountdown -= dt;
        if (battle.roundCountdown <= 0) nextRound(battle);
      } else if (!hasMobileEnemy) {
        battle.roundWaiting = true;
        battle.roundCountdown = (App.Config.WAVES && App.Config.WAVES.countdownSeconds) || 8;
      }
    }
    const canSpawnCampWave = !(battle.level && battle.level.raid) && !battle.noTroops && (battle.totalRounds <= 1 || (battle.round >= battle.totalRounds && ((battle.enemyBase && battle.enemyBase.alive) || battle.mode === 'beast')));
    if (canSpawnCampWave && !(battle.special && battle.special.noAutoWave) && battle.enemyWaveTimer <= 0 && battle.units.filter((u) => u.alive && u.side === 'enemy' && !u.isMainBase).length < maxEnemyCap) {
      battle.enemyWaveTimer = battle.mode === 'beast'
        ? 5.4
        : Math.max(4.8, 8.8 - stageOrd * 0.12);
      const dCfgW = App.Config.DIFFICULTY || {};
      const baseLv = battle.arenaMatch ? battle.arenaMatch.lv : (battle.level ? (battle.level.recommendedLv || 1) : 1);
      const lv = (battle.mode === 'city' && stageOrd > 3) ? Math.max(1, Math.round(baseLv * (dCfgW.stageLvScale || 1.12))) : baseLv;
      const waveCnt = stageOrd <= 3 ? 2 : 3;
      const wDiff = App.Config.getModeDifficulty(battle.mode, battle.level);
      const sMultW = battle.mode === 'city' ? (dCfgW.stageSoldierMult || 1.22) : 1;
      const wMult = battle.mode === 'arena'
        ? { hpMult: wDiff.hpMult / 1.15, atkMult: wDiff.atkMult / 1.12, defMult: 1 }
        : { hpMult: wDiff.hpMult * sMultW, atkMult: wDiff.atkMult * sMultW, defMult: wDiff.defMult };
      for (let i = 0; i < waveCnt; i++) {
        const c = TROOP_CARDS[Math.floor(Math.random() * Math.min(5, TROOP_CARDS.length))];
        battle.units.push(makeSoldier(battle.uidCounter++, 'enemy', c, getEnemyCampFrontX(battle) - 10, LANE_MIN_Y + Math.random() * 165, lv, wMult));
      }
    }

    // 双方上下双箭垒自动索敌齐射（优先攻击射程内小兵；无小兵时再攻击敌将/神兽）
    battle.towers.forEach((t) => {
      if (!t.alive) return;
      if (t.hitFlash > 0) t.hitFlash -= dt;
      t.atkTimer -= dt;
      if (t.atkTimer <= 0) {
        const bestT = findTowerTarget(battle, t);
        if (bestT) {
          t.atkTimer = 1.38;
          launchBallisticProjectile(battle, t, bestT, 1.0, 'tower_arrow');
        } else {
          t.atkTimer = 0.15;
        }
      }
    });

    battle.units.forEach((u) => {
      if (!u.alive) return;
      if (u.hitFlash > 0) u.hitFlash -= dt;
      if (u.hitRecoil > 0) u.hitRecoil = Math.max(0, u.hitRecoil - dt * 5.8);
      if (u.isProp && !u.isRam) return; // 宝箱车、帅帐、粮车不行动
      if (u.knockX) {
        u.knockX *= Math.max(0, 1 - dt * 14);
        if (Math.abs(u.knockX) < 0.1) u.knockX = 0;
      }
      if (u.attackAnim > 0) u.attackAnim = Math.max(0, u.attackAnim - dt * 2.3);
      if (u.castAnim > 0) u.castAnim = Math.max(0, u.castAnim - dt * 1.4);

      // 名将专属增益/减益状态计时器与灼烧/流血/中毒/回春持续跳字结算
      if (u.shieldTimer > 0) {
        u.shieldTimer -= dt;
        if (u.shieldTimer <= 0) { u.shieldTimer = 0; u.shieldHp = 0; }
      }
      if (u.immuneCtrlTimer > 0) u.immuneCtrlTimer = Math.max(0, u.immuneCtrlTimer - dt);
      if (u.atkBuffTimer > 0) u.atkBuffTimer = Math.max(0, u.atkBuffTimer - dt);
      if (u.defBuffTimer > 0) u.defBuffTimer = Math.max(0, u.defBuffTimer - dt);
      if (u.spdBuffTimer > 0) u.spdBuffTimer = Math.max(0, u.spdBuffTimer - dt);
      if (u.dmgRedBuffTimer > 0) u.dmgRedBuffTimer = Math.max(0, u.dmgRedBuffTimer - dt);
      if (u.critBuffTimer > 0) u.critBuffTimer = Math.max(0, u.critBuffTimer - dt);
      if (u.skillBuffTimer > 0) u.skillBuffTimer = Math.max(0, u.skillBuffTimer - dt);
      if (u.lifestealBuffTimer > 0) u.lifestealBuffTimer = Math.max(0, u.lifestealBuffTimer - dt);
      if (u.thornsTimer > 0) u.thornsTimer = Math.max(0, u.thornsTimer - dt);
      if (u.armorBreakTimer > 0) u.armorBreakTimer = Math.max(0, u.armorBreakTimer - dt);
      if (u.weakenTimer > 0) u.weakenTimer = Math.max(0, u.weakenTimer - dt);
      if (u.slowTimer > 0) u.slowTimer = Math.max(0, u.slowTimer - dt);
      if (u.vulnTimer > 0) u.vulnTimer = Math.max(0, u.vulnTimer - dt);
      if (u.chainLinkTimer > 0) u.chainLinkTimer = Math.max(0, u.chainLinkTimer - dt);

      if (battle.status === 'fighting' && (u.hotTimer > 0 || u.burnTimer > 0 || u.bleedTimer > 0 || u.poisonTimer > 0)) {
        if (u.hotTimer > 0) u.hotTimer = Math.max(0, u.hotTimer - dt);
        if (u.burnTimer > 0) u.burnTimer = Math.max(0, u.burnTimer - dt);
        if (u.bleedTimer > 0) u.bleedTimer = Math.max(0, u.bleedTimer - dt);
        if (u.poisonTimer > 0) u.poisonTimer = Math.max(0, u.poisonTimer - dt);
        u._dotAcc = (u._dotAcc || 0) + dt;
        if (u._dotAcc >= 0.80) {
          u._dotAcc -= 0.80;
          // 1. 逐渐持续治疗（回春跳字 + 中毒重伤减疗联动）
          if (u.hotTimer > 0 && u.hotDps > 0 && u.hp < u.maxHp) {
            const poisonCut = u.poisonTimer > 0 ? (1 - (u.healCutPct || 0.45)) : 1;
            const hAmt = Math.max(1, Math.round(u.hotDps * 0.80 * poisonCut));
            u.hp = Math.min(u.maxHp, u.hp + hAmt);
            if (u.kind === 'general' || u.kind === 'beast' || Math.random() < 0.30) {
              addFloatText(battle, u.x, u.y - 54, `回春+${hAmt}`, '#86efac');
            }
          }
          // 2. 剧毒 / 灼烧 / 撕裂流血（移动加剧流血 +35%，毒亡触发毒瘴传染！）
          const poisonTick = u.poisonTimer > 0 ? (u.poisonDps || 0) : 0;
          const burnTick = u.burnTimer > 0 ? (u.burnDps || 0) : 0;
          const bleedTick = u.bleedTimer > 0 ? Math.round((u.bleedDps || 0) * (u.moving ? 1.35 : 1.0)) : 0;
          const dotRaw = poisonTick + burnTick + bleedTick;
          if (dotRaw > 0 && u.alive && !u.isProp) {
            const dotDmg = Math.max(5, Math.round(dotRaw * 0.80));
            u.hp = Math.max(0, u.hp - dotDmg);
            if (u.kind === 'general' || Math.random() < 0.36) {
              let tag = '';
              let dCol = '#f87171';
              if (poisonTick >= burnTick && poisonTick >= bleedTick && poisonTick > 0) {
                tag = '☠毒 '; dCol = '#a3e635';
              } else if (burnTick >= bleedTick && burnTick > 0) {
                tag = '🔥灼 '; dCol = '#fb923c';
              } else {
                tag = '🩸血 '; dCol = '#fb7185';
              }
              addFloatText(battle, u.x, u.y - 50, `${tag}-${dotDmg}`, dCol);
            }
            if (u.hp <= 0) {
              u.alive = false;
              spreadVenomOnDeath(battle, u);
              if (u.kind) battle.dyingUnits.push(Object.assign({}, u, { dieTimer: 0.55, maxDie: 0.55 }));
              checkBattleEnd(battle);
              return;
            }
          }
        }
      }

      // ★ 我方出战神兽灵气积满（>=100）时自动主动释放四象神威技能！
      if (
        u.side === 'player'
        && u.kind === 'beast'
        && (u.rage || 0) >= 100
        && battle.status === 'fighting'
        && battle.introTimer <= 0
        && (u.stunTimer || 0) <= 0
        && (u.petrifyTimer || 0) <= 0
      ) {
        const hasEnemy = battle.units.some((e) => e.alive && e.side === 'enemy')
          || battle.towers.some((tw) => tw.alive && tw.side === 'enemy');
        if (hasEnemy) {
          castBeastUltimate(battle, u);
          if (battle.status !== 'fighting') return;
        }
      }

      // 步态平滑过渡因子（停步进入攻击时战马四蹄立即稳扎地面，绝不在出招时继续空蹬！）
      const targetMb = (u.moving && !(u.isMounted && u.atkProg > 0)) ? 1 : 0;
      u.moveBlend = targetMb === 0 && u.isMounted
        ? 0
        : ((u.moveBlend || 0) + (targetMb - (u.moveBlend || 0)) * Math.min(1, dt * 14));
      if (!u.moving && !u.isMounted && u.moveBlend > 0.02) {
        u.runPhase += dt * 5.2 * u.moveBlend;
      }

      // ★ 推进三段式协调攻击动作（蓄势引腰 -> 疾鞭劈刺爆发+顿帧发力 -> 柔顺收势回架）
      if (u.atkProg > 0) {
        u.atkProg += dt / (u.atkDur || 0.50);
        const relPt = u.atkStyle === 'bow' ? 0.44 : (u.atkStyle === 'fan' ? 0.37 : (u.atkStyle === 'sword' ? 0.28 : (u.atkStyle === 'thrust' ? 0.30 : 0.32)));
        if (!u.atkReleased && u.atkProg >= relPt) {
          u.atkReleased = true;
          let actTarget = u.atkTarget;
          if (!actTarget || !actTarget.alive) {
            actTarget = findNearestEnemy(battle, u).target;
          }
          if (actTarget && actTarget.alive) {
            if (u.range <= 100) {
              // 近战突进蹬地扬起前扑烟尘
              battle.dustParticles.push({
                x: u.x + u.facing * 8,
                y: u.y + 4,
                vx: -u.facing * 24,
                vy: -8,
                size: u.kind === 'general' ? 5.5 : 3.8,
                life: 0.28,
                maxLife: 0.28,
              });
            }
            if (u.side === 'enemy' && u.kind === 'general' && u.rage >= 100) {
              const isEnemyPureHeal = u.cfg && u.cfg.skillPower === 0;
              const enemyTeamWounded = !isEnemyPureHeal || battle.units.some((ea) => ea.alive && ea.side === 'enemy' && !ea.isProp && ea.hp < ea.maxHp * 0.86);
              if (enemyTeamWounded) {
                executeGeneralSkillAt(battle, u, actTarget.x, actTarget.y);
              } else if (u.range > 100) {
                launchBallisticProjectile(battle, u, actTarget, 1.0);
              } else {
                dealDamage(battle, u, actTarget, 1.0);
              }
            } else if (u.range > 100) {
              launchBallisticProjectile(battle, u, actTarget, 1.0);
            } else {
              dealDamage(battle, u, actTarget, 1.0);
            }
            checkBattleEnd(battle);
          }
        }
        if (u.atkProg >= 1) {
          u.atkProg = 0;
          u.atkReleased = false;
          u.atkTarget = null;
        }
      }

      if ((u.petrifyTimer || 0) > 0 || (u.stunTimer || 0) > 0) {
        if (u.petrifyTimer > 0) {
          u.petrifyTimer = Math.max(0, u.petrifyTimer - dt);
          u.moveBlend = 0;
        }
        if (u.stunTimer > 0) {
          u.stunTimer = Math.max(0, u.stunTimer - dt);
        }
        u.moving = false;
        u.inCombat = false;
        u.atkProg = 0;
        return;
      }

      if (u.isWildBeast) {
        u.beastSkillTimer -= dt;
        if (u.beastSkillTimer <= 0) {
          u.beastSkillTimer = 6.0;
          const pAllies = battle.units.filter((p) => p.alive && p.side === 'player');
          if (pAllies.length) {
            const centerTarget = pAllies[Math.floor(Math.random() * pAllies.length)];
            const zx = centerTarget.x, zy = centerTarget.y;
            if (App.UI) App.UI.showToast(`高危！${u.name} 蓄力【${u.beastCfg.skillName}】，速点撤退躲红圈！`, '#f87171');
            battle.aoeZones.push({
              x: zx, y: zy, radius: 155, timer: 1.30, maxTimer: 1.30,
              color: '#ef4444', fill: 'rgba(239, 68, 68, 0.26)',
              label: `⚠ ${u.beastCfg.skillName} 预警!`,
              onDetonate: () => {
                if (!u.alive) return;
                u.attackAnim = 1.0;
                const elemMap = { qinglong: 'thunder', zhuque: 'fire', baihu: 'slash_crimson', xuanwu: 'ice' };
                battle.skillEffects.push({
                  beastId: u.spriteId || u.id,
                  casterName: u.name,
                  x: zx,
                  y: zy,
                  casterX: u.x,
                  casterY: u.y,
                  facing: -1,
                  skillName: u.beastCfg.skillName,
                  isFullscreen: false,
                  element: elemMap[u.id] || 'thunder',
                  life: 1.55,
                  maxLife: 1.55,
                });
                showBanner(battle, `${u.name} · ${u.beastCfg.skillName}`, '毁天灭地四象神威爆发！', u.beastCfg.glow, null, u.id);
                spawnSparks(battle, zx, zy - 20, u.beastCfg.glow, 26);
                battle.units.filter((p) => p.alive && p.side === 'player').forEach((p) => {
                  if (Math.hypot(p.x - zx, (p.y - zy) * 1.2) <= 165) {
                    dealDamage(battle, u, p, 2.25, { fromSkill: true });
                    if (p.alive) p.stunTimer = Math.max(p.stunTimer, 1.5);
                  }
                });
                checkBattleEnd(battle);
              },
            });
          }
        }
      }

      if (u.side === 'player' && (u.kind === 'general' || u.kind === 'beast')) {
        if (battle.order === 'hold') {
          u.x = clampUnitX(battle, u, u.x);
          u.moving = false; u.facing = 1; return;
        }
        if (battle.order === 'retreat') {
          // ★ 撤退驻防区严格落在【主营正前方、双箭垒后方】（约 x=346..442），依托箭垒火力掩护御敌，绝不退到主营背后！
          const campFrontX = getPlayerCampFrontX(battle);
          const pTower = battle.towers && battle.towers.find((tw) => tw.alive && tw.side === 'player');
          const behindTowerX = pTower ? (pTower.x - 76) : (campFrontX + 96);
          const slotOff = u.kind === 'beast' ? 44 : (((u.uid || 0) % 4) * 22);
          const rallyX = Math.max(campFrontX + 22, Math.min(behindTowerX, campFrontX + 26 + slotOff));

          if (u.x > rallyX + 5) {
            u.x = Math.max(rallyX, u.x - u.spd * 1.35 * dt);
            u.facing = -1;
            u.moving = true;
            u.runPhase += dt * (u.isMounted ? 14.2 : 13.5);
          } else if (u.x < rallyX - 5) {
            u.x = Math.min(rallyX, u.x + u.spd * 1.15 * dt);
            u.facing = 1;
            u.moving = true;
            u.runPhase += dt * (u.isMounted ? 12.8 : 12.0);
          } else {
            u.moving = false;
            u.facing = 1;
          }
          return;
        }
      }

      const { target, dist } = findNearestEnemy(battle, u);
      if (!target) { u.moving = false; u.inCombat = false; return; }

      // 计算当前自然灾害、名将技能攻速增益与敌军冰缓/铁索减速对移速/射程/攻速的影响
      const pDis = (u.side === 'player' && battle.activeDisaster) ? battle.activeDisaster : null;
      const skillSpdBuff = (u.spdBuffTimer > 0 && u.spdBuffPct) ? u.spdBuffPct : 0;
      const slowFactor = (u.slowTimer > 0 && u.slowPct) ? Math.max(0.35, 1 - u.slowPct) : 1.0;
      const spdBoost = Math.max(0.42, (1 + (u.spdPct || 0) + skillSpdBuff) * slowFactor);
      const effSpd = u.spd * Math.max(0.40, (1 + ((u.spdPct || 0) + skillSpdBuff) * 0.65) * slowFactor) * (pDis ? (pDis.spdMult || 1) : 1);
      const baseRange = u.range > 90 ? u.range * (pDis ? (pDis.rangeMult || 1) : 1) : (u.range + (u.rangeJitter || 0));
      const effRange = Math.max(38, baseRange);
      const effAtkSpd = (pDis ? (pDis.atkSpdMult || 1) : 1) * spdBoost;

      if (dist > effRange && u.atkProg === 0) {
        u.inCombat = dist < effRange + 65;
        const aimY = u.range <= 90
          ? Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, target.y + (u.engageSlotY || 0)))
          : target.y;
        const dx = target.x - u.x;
        const dy = aimY - u.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const headwind = (pDis && pDis.pushBack) ? -pDis.pushBack : 0;
        const vx = (dx / len) * effSpd + headwind;
        u.x = clampUnitX(battle, u, u.x + vx * dt);
        u.y = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, u.y + (dy / len) * effSpd * 0.76 * dt));
        if (Math.abs(vx) > 1) u.facing = vx >= 0 ? 1 : -1;
        u.moving = true;
        const prevPhase = u.runPhase;
        const cadence = u.kind === 'beast'
          ? (u.id === 'baihu' ? 11.2 : (u.id === 'xuanwu' ? 6.8 : 9.6))
          : (u.isMounted
            ? Math.max(11.0, Math.min(16.2, effSpd * (u.kind === 'soldier' ? 0.132 : 0.106)))
            : Math.max(10.5, Math.min(16.0, effSpd * 0.182)));
        u.runPhase += dt * cadence * (pDis ? (pDis.spdMult || 1) : 1);

        // 战马四蹄、神兽踏步与步卒急行节拍同步扬起沙尘
        if (Math.floor(prevPhase / (Math.PI * 0.85)) !== Math.floor(u.runPhase / (Math.PI * 0.85))) {
          const isFlyBeast = u.kind === 'beast' && (u.id === 'qinglong' || u.id === 'zhuque');
          if (!isFlyBeast) {
            const hoofCount = u.isMounted || u.kind === 'beast' ? 2 : 1;
            for (let hc = 0; hc < hoofCount; hc++) {
              if (battle.dustParticles.length >= 48) battle.dustParticles.shift();
              battle.dustParticles.push({
                x: u.x - u.facing * (8 + hc * 14) + (Math.random() - 0.5) * 6,
                y: u.y + 4 + (Math.random() - 0.5) * 3,
                vx: -u.facing * (24 + Math.random() * 20),
                vy: -7 - Math.random() * 9,
                size: u.kind === 'beast' ? 7.8 : (u.isMounted ? 5.2 : 3.6),
                life: 0.32,
                maxLife: 0.32,
              });
            }
          }
        }
      } else {
        u.moving = false;
        u.inCombat = true;
        u.facing = target.x >= u.x ? 1 : -1;
        u.atkTimer -= dt * effAtkSpd;
        if (u.atkTimer <= 0 && u.atkProg === 0) {
          // 错落有致的交锋节奏 + 三连式招式循环（彻底告别机械重复单动作！）
          u.atkTimer = (u.kind === 'soldier' ? 1.06 : 0.92) + (((u.uid || 1) % 4) * 0.045);
          u.comboStep = ((u.comboStep || 0) + 1) % 3;
          u.attackAnim = 1.0;
          u.atkProg = 0.001;
          u.atkReleased = false;
          u.atkTarget = target;
          if (u.kind === 'general' || u.kind === 'beast') {
            u.rage = Math.min(100, (u.rage || 0) + (u.side === 'player' ? 13.5 : 11.5));
          }
        }
      }
    });

    // ★ 定期就地清理已阵亡小兵引用（倒地残影已独立拷入 dyingUnits），彻底消除长波次守城战 O(U^2) 膨胀！
    if (battle.units.length > 44) {
      let writeIdx = 0;
      for (let i = 0; i < battle.units.length; i++) {
        const u = battle.units[i];
        if (u.alive || u.kind !== 'soldier') {
          battle.units[writeIdx++] = u;
        }
      }
      battle.units.length = writeIdx;
    }

    // ★ 友军阵型柔和防叠站排斥（让交战单位自然呈弧形展开对垒，彻底告别5名武将叠成纸片人！）
    const activeUnits = battle.units;
    for (let i = 0; i < activeUnits.length; i++) {
      const a = activeUnits[i];
      if (!a.alive || a.isProp) continue;
      for (let j = i + 1; j < activeUnits.length; j++) {
        const b = activeUnits[j];
        if (!b.alive || b.isProp || a.side !== b.side) continue;
        const minX = (a.kind === 'general' && b.kind === 'general') ? 38 : 26;
        const minY = (a.kind === 'general' && b.kind === 'general') ? 26 : 18;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
          const pushY = (minY - Math.abs(dy)) * 1.35 * dt;
          const dirY = dy === 0 ? ((a.uid < b.uid) ? -1 : 1) : (dy > 0 ? 1 : -1);
          a.y = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, a.y - dirY * pushY));
          b.y = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, b.y + dirY * pushY));
          if (Math.abs(dx) < minX * 0.55) {
            const pushX = (minX * 0.55 - Math.abs(dx)) * 0.7 * dt;
            const dirX = dx >= 0 ? 1 : -1;
            a.x = clampUnitX(battle, a, a.x - dirX * pushX);
            b.x = clampUnitX(battle, b, b.x + dirX * pushX);
          }
        }
      }
    }

    if (battle.status === 'fighting' && areAllPlayerGeneralsDead(battle)) {
      checkBattleEnd(battle);
    }

    if (battle.autoCam && !battle.aimingUnit) {
      const pGens = battle.units.filter((u) => u.alive && u.side === 'player' && u.kind === 'general');
      const pTrack = pGens.length ? pGens : battle.units.filter((u) => u.alive && u.side === 'player' && !u.isProp);
      if (pTrack.length) {
        const frontX = Math.max(...pTrack.map((g) => g.x));
        const targetCam = Math.max(0, Math.min(WORLD_W - App.Platform.LOGICAL_W, frontX - 300));
        battle.cameraX += (targetCam - battle.cameraX) * Math.min(1, rawDt * 4);
      }
    }
  }

  App.BattleEngine = {
    WORLD_W,
    TROOP_CARDS,
    createBattle,
    syncPaused,
    getTroopCommandState,
    getDeployedTroopEntries,
    spawnPlayerTroop,
    toggleAutoTroop,
    updateBattle,
    triggerPlayerGeneralSkill,
    executeGeneralSkillAt,
    castBeastUltimate,
    postVictoryRecruit,
    postVictoryCatchBeast,
    nextRound,
    specialScore,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
