(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const WORLD_W = 1560;
  const LANE_MIN_Y = 205;
  const LANE_MAX_Y = 382;

  // 兵种卡由后端配置下发
  const TROOP_CARDS = App.Config.TROOP_CARDS;

  const MANUAL_AIM_SKILLS = new Set([
    'fire_aoe', 'freeze_aoe', 'thunder_aoe', 'wushuang_aoe',
    'pierce_column', 'precision_mercy', 'heavy_cleave',
  ]);

  function pickGeneralSpriteKey(gid) {
    const g = App.Config.GENERALS[gid];
    if (!g) return 'unit_gen_silver';
    if (g.gender === 'female') return 'unit_gen_female';
    if (['lvbu', 'zhangfei', 'huaxiong', 'xuchu', 'huanggai', 'guanyu', 'xiahoudun', 'dianwei', 'dongzhuo', 'ganning', 'caocao', 'sunquan', 'huangzhong'].includes(gid)) {
      return 'unit_gen_heavy';
    }
    if (g.type === 'archer') {
      return g.skillType === 'precision_mercy' ? 'unit_gen_silver' : 'unit_gen_mage';
    }
    return 'unit_gen_silver';
  }

  // 根据兵种、武将造型与绝技属性自动匹配专属战斗动作姿态（弯弓射箭 / 羽扇施法 / 破空枪刺 / 蓄力重劈）
  function inferAttackStyle(u) {
    if (!u) return 'cleave';
    if (u.kind === 'beast') return 'beast';
    if (u.kind === 'soldier') {
      if (u.id === 'archer') return 'bow';
      if (u.id === 'mage' || u.isMagic) return 'fan';
      if (u.id === 'pike' || u.id === 'cavalry') return 'thrust';
      return 'cleave';
    }
    const cfg = u.cfg || App.Config.GENERALS[u.id] || {};
    if (u.unitType === 'archer') {
      if (u.spriteKey === 'unit_gen_female' || ['huangzhong', 'sunshangxiang', 'taishici'].includes(u.id) || cfg.skillType === 'precision_mercy') {
        return 'bow';
      }
      return 'fan';
    }
    if (['zhaoyun', 'machao', 'zhangliao', 'lvbu', 'taishici'].includes(u.id) || cfg.skillType === 'pierce_column') {
      return 'thrust';
    }
    return 'cleave';
  }

  function isSpriteMounted(spriteKey) {
    return spriteKey === 'unit_gen_silver' || spriteKey === 'unit_gen_heavy' || spriteKey === 'unit_gen_mage' || spriteKey === 'unit_gen_female';
  }

  function createBattle(opts) {
    const mode = opts.mode || 'city';
    const level = opts.level;
    const arenaMatch = opts.arenaMatch || null;
    const st = App.State.get();
    const fac = App.Config.FACTIONS[st.factionId];

    let uidCounter = 1;
    const units = [];
    const towers = [];

    // 1. 我方最多 5 名出战将领
    st.deployIds.slice(0, 5).forEach((gid, idx) => {
      const cfg = App.Config.GENERALS[gid];
      const stats = App.State.getGeneralStats(gid);
      if (!cfg || !stats) return;
      units.push({
        uid: uidCounter++,
        side: 'player',
        facing: 1,
        kind: 'general',
        id: gid,
        spriteKey: pickGeneralSpriteKey(gid),
        name: cfg.name,
        unitType: cfg.type,
        equips: App.State.getEquippedMap(gid),
        needsManualAim: !cfg.isFullscreenSkill && MANUAL_AIM_SKILLS.has(cfg.skillType),
        x: 155 + (idx % 2) * 44,
        y: 222 + idx * 36,
        maxHp: stats.hp,
        hp: stats.hp,
        atk: Math.round(stats.atk * (fac.atkMult || 1)),
        def: stats.def,
        crit: stats.crit,
        spd: 74 + (cfg.type === 'cavalry' ? 22 : 0),
        range: cfg.type === 'archer' ? 200 : 54,
        rage: 25, // ★ 开局自带25点蓄势怒气，约7~8秒实战交锋即可痛快释放一次绝技！
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
      playerBeastUnit = {
        uid: uidCounter++,
        side: 'player',
        facing: 1,
        kind: 'beast',
        id: bCfg.id,
        lv: bStats.lv,
        star: bStats.star,
        equips: bEquips,
        spriteKey: 'beast_sprite_' + bCfg.id,
        name: bCfg.name,
        unitType: 'cavalry',
        x: 225,
        y: 298,
        maxHp: Math.round(bStats.hp * 1.15),
        hp: Math.round(bStats.hp * 1.15),
        atk: Math.round(bStats.atk * 1.22),
        def: bStats.def,
        crit: bStats.crit,
        spd: 82,
        range: 74,
        rage: 25, // 神兽初始25点灵气，与将领节奏匹配流畅释放神威
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

    for (let i = 0; i < 4; i++) {
      units.push(makeSoldier(uidCounter++, 'player', TROOP_CARDS[i % 3], 265 + i * 24, 220 + (i % 4) * 42, Math.max(1, st.lordLevel)));
    }

    let bossGeneralId = null;
    let targetBeastId = null;

    if (mode === 'arena' && arenaMatch) {
      arenaMatch.generals.slice(0, 5).forEach((gid, idx) => {
        const cfg = App.Config.GENERALS[gid];
        const stats = App.State.getGeneralStats(gid, arenaMatch.lv);
        if (!cfg || !stats) return;
        if (!bossGeneralId) bossGeneralId = gid;
        units.push({
          uid: uidCounter++,
          side: 'enemy',
          facing: -1,
          kind: 'general',
          id: gid,
          spriteKey: pickGeneralSpriteKey(gid),
          name: cfg.name,
          unitType: cfg.type,
          x: WORLD_W - 190 - (idx % 2) * 45,
          y: 220 + idx * 36,
          maxHp: Math.round(stats.hp * 1.15),
          hp: Math.round(stats.hp * 1.15),
          atk: Math.round(stats.atk * 1.12),
          def: stats.def,
          crit: 0.15,
          spd: 74,
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
          x: WORLD_W - 260, y: 295,
          maxHp: Math.round(bCfg.hp * sc), hp: Math.round(bCfg.hp * sc),
          atk: Math.round(bCfg.atk * sc), def: Math.round(bCfg.def * sc),
          crit: 0.18, spd: 74, range: 72, rage: 30, atkTimer: 0.7,
          attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true, beastCfg: bCfg,
        });
      }
      for (let i = 0; i < 7; i++) {
        units.push(makeSoldier(uidCounter++, 'enemy', TROOP_CARDS[i % 4], WORLD_W - 340 - i * 22, 215 + (i % 4) * 40, arenaMatch.lv));
      }
    } else {
      // 平滑渐进难度曲线：前几关轻松爽快可过，随章节推进逐步升温！
      const stageOrder = level.order || 1;
      const stageLv = level.recommendedLv || 1;
      const tCount = level.towers || 1;
      const isEarly = mode === 'city' && stageOrder <= 6;
      const towerHp = isEarly ? (290 + stageOrder * 48) : (520 + stageLv * 135);
      const towerAtk = isEarly ? (18 + stageOrder * 3) : (36 + stageLv * 7);

      for (let i = 0; i < tCount; i++) {
        towers.push({
          uid: uidCounter++,
          side: 'enemy',
          x: 840 + i * 210,
          y: i % 2 === 0 ? 250 : 348,
          maxHp: towerHp,
          hp: towerHp,
          atk: towerAtk,
          atkTimer: 1.2,
          hitFlash: 0,
          alive: true,
        });
      }

      if (mode === 'beast' && level.beastId) {
        targetBeastId = level.beastId;
        const bCfg = App.Config.BEASTS[level.beastId];
        const mult = level.beastScale || 3.4;
        units.push({
          uid: uidCounter++, side: 'enemy', facing: -1, kind: 'beast',
          id: bCfg.id, spriteKey: 'beast_sprite_' + bCfg.id, name: bCfg.name, unitType: 'spear',
          isWildBeast: true,
          x: WORLD_W - 250, y: 298,
          maxHp: Math.round(bCfg.hp * mult),
          hp: Math.round(bCfg.hp * mult),
          atk: Math.round(bCfg.atk * (mult * 0.58)),
          def: Math.round(bCfg.def * 1.35),
          crit: 0.22, spd: 68, range: 78, rage: 45,
          beastSkillTimer: 5.2,
          atkTimer: 0.75, attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true,
          beastCfg: bCfg,
        });
      }

      // Boss与副将数值倍率随关卡平滑增长（第1~5关温和亲民，中后期强悍耐战）
      const bossHpMult = mode === 'city' ? Math.min(1.48, 0.84 + stageOrder * 0.022) : 1.35;
      const bossAtkMult = mode === 'city' ? Math.min(1.20, 0.82 + stageOrder * 0.015) : 1.12;

      // 分轮作战：副将在中间几轮登场，守将（BOSS）只在最后一轮出现。副将不足时取前几关的守将补位
      const plan = getRoundPlan(mode, level);
      // 前期章节（副将数为 0）不出副将，只保留守将
      const egList = (level.enemyGenerals || []).filter((e) => e.isBoss || mode !== 'city' || plan.subGenerals > 0);
      for (let k = 1; mode === 'city' && egList.filter((e) => !e.isBoss).length < plan.subGenerals && k <= 12; k++) {
        const prev = App.Config.STAGES[stageOrder - k];
        if (prev && prev.bossId && !egList.some((e) => e.id === prev.bossId)) egList.push({ id: prev.bossId, lv: Math.max(1, stageLv - 1), isBoss: false });
      }
      egList.forEach((eg, idx) => {
        const cfg = App.Config.GENERALS[eg.id];
        const stats = App.State.getGeneralStats(eg.id, eg.lv || stageLv);
        if (!cfg || !stats) return;
        if (eg.isBoss || (!bossGeneralId && mode === 'city')) bossGeneralId = eg.id;
        units.push({
          uid: uidCounter++, side: 'enemy', facing: -1, kind: 'general',
          id: eg.id, spriteKey: pickGeneralSpriteKey(eg.id), name: cfg.name, unitType: cfg.type,
          isBoss: !!eg.isBoss,
          x: WORLD_W - 210 - idx * 68, y: 252 + idx * 54,
          maxHp: Math.round(stats.hp * (eg.isBoss ? bossHpMult : bossHpMult * 0.85)),
          hp: Math.round(stats.hp * (eg.isBoss ? bossHpMult : bossHpMult * 0.85)),
          atk: Math.round(stats.atk * (eg.isBoss ? bossAtkMult : bossAtkMult * 0.88)),
          def: Math.round(stats.def * (isEarly ? 0.85 : 1.08)),
          crit: 0.12, spd: 66,
          range: cfg.type === 'archer' ? 195 : 54,
          rage: 0, atkTimer: 0.85, attackAnim: 0, runPhase: Math.random() * 6,
          stunTimer: 0, hitFlash: 0, moving: false, alive: true, cfg,
        });
      });

      const guardCount = mode === 'beast' ? 7 : Math.min(8, 2 + Math.floor(stageOrder / 2));
      for (let i = 0; i < guardCount; i++) {
        const tCard = TROOP_CARDS[i % 4];
        units.push(makeSoldier(uidCounter++, 'enemy', tCard, 800 + (i % 4) * 120, 215 + (i % 4) * 42, stageLv));
      }
    }

    // 魔将：体型巨大、血量与攻击按后台配置的倍率放大
    if (mode === 'demon' && level.demon) {
      units.filter((u) => u.side === 'enemy' && u.kind === 'general' && u.isBoss).forEach((u) => {
        u.maxHp = Math.round(u.maxHp * (level.demon.hpMult || 6));
        u.hp = u.maxHp;
        u.atk = Math.round(u.atk * (level.demon.atkMult || 1.8));
        u.scale = level.demon.scale || 1.9;
        u.range = Math.round(u.range * 1.4);
        u.name = level.demon.name || u.name;
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
        const lv = (level && level.recommendedLv) || 1;
        const subStart = Math.max(2, Math.ceil(totalRounds / 2));
        for (let r = 1; r <= totalRounds; r++) {
          const list = [];
          const n = Math.max(2, Math.min(8, Math.round(guards.length * (0.6 + 0.15 * r))));
          for (let i = 0; i < n; i++) list.push(makeSoldier(uidCounter++, 'enemy', TROOP_CARDS[i % Math.min(4, TROOP_CARDS.length)], 0, 215 + (i % 4) * 42, lv));
          if (r === totalRounds) bosses.forEach((b) => list.push(b));
          else if (r >= subStart && subs.length) list.push(subs.shift());
          list.forEach((u, i) => { u.x = (r === 1 ? 800 : WORLD_W - 90) + (i % 4) * (r === 1 ? 120 : -34); });
          roundQueue.push(list);
        }
        subs.forEach((u) => roundQueue[totalRounds - 1].push(u)); // 轮数不够放的副将随守将一起出场
        roundQueue.shift().forEach((u) => units.push(u));
      }
    }

    // 特殊副本：清掉常规敌军，按副本规则布置（宝箱车、帅帐、粮车、凶兽、连闯五关等）
    const special = (level && level.special) ? buildSpecial(mode, level, units, towers, roundQueue, () => uidCounter++) : null;
    if (special && special.totalRounds) totalRounds = special.totalRounds;

    const chapterNum = (level && level.chapter) || 1;
    const chapterTheme = (level && level.mapTheme) || (App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(chapterNum) : null);
    // ★ 自然灾害并非每关必出：仅在关卡/神兽战中以约 40% 概率随机降临（第1关与演武场保持晴朗），每次进入关卡天象未知！
    const stageOrdForDis = (level && level.order) || 1;
    const forcedDisaster = level && level.forceDisasterId;
    const enableRandomDisaster = forcedDisaster ? true : !(level && level.noDisaster) && mode !== 'arena' && !(mode === 'city' && stageOrdForDis <= 1) && Math.random() < 0.40;

    function finalizeUnits(list) {
      list.forEach((u) => {
        u.atkStyle = u.atkStyle || inferAttackStyle(u);
        u.isMounted = isSpriteMounted(u.spriteKey);
        u.atkProg = 0;
        u.atkDur = u.atkStyle === 'bow' ? 0.58 : (u.atkStyle === 'fan' ? 0.56 : 0.48);
        u.atkReleased = false;
        u.atkTarget = null;
        u.knockX = 0;
      });
      return list;
    }

    if (App.Audio) App.Audio.playSfx('battle_start');

    return {
      mode, level, arenaMatch,
      chapter: chapterNum,
      chapterTheme,
      biome: (level && level.biome) || 'plains',
      worldW: WORLD_W,
      cameraX: 0,
      autoCam: true,
      order: (level && level.special && (mode === 'defend' || mode === 'escort')) ? 'hold' : 'attack',
      wood: 120,
      food: 120,
      adSupplyUsed: false,
      resTimer: 0,
      centerNode: { x: 700, y: 185, owner: null },
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
      speedMult: 1,
      paused: false,
      status: 'fighting',
      captiveGeneralId: mode === 'city' ? bossGeneralId : null,
      recruitState: 'pending',
      recruitDuplicate: false,
      captiveBeastId: mode === 'beast' ? targetBeastId : null,
      catchState: 'pending',
      droppedEquip: null,
      // 服务端战斗会话：奖励数值、结算、招降与捕获都由服务端决定
      serverId: opts.serverBattle ? opts.serverBattle.id : null,
      settled: false,
      expGain: opts.serverBattle ? opts.serverBattle.exp : 0,
      levelUpInfo: null,
      rewardClaimed: false,
      doubleAdUsed: false,
      goldReward: opts.serverBattle ? opts.serverBattle.gold : 0,
      soulReward: opts.serverBattle ? opts.serverBattle.soul : 0,
    };
  }

  function makeEnemyGeneral(uid, gid, lv, x, y, hpMult, atkMult, isBoss) {
    const cfg = App.Config.GENERALS[gid];
    const stats = App.State.getGeneralStats(gid, lv);
    if (!cfg || !stats) return null;
    return {
      uid, side: 'enemy', facing: -1, kind: 'general', id: gid, spriteKey: pickGeneralSpriteKey(gid), name: cfg.name, unitType: cfg.type, isBoss: !!isBoss,
      x, y, maxHp: Math.round(stats.hp * hpMult), hp: Math.round(stats.hp * hpMult), atk: Math.round(stats.atk * atkMult), def: stats.def,
      crit: 0.12, spd: 66, range: cfg.type === 'archer' ? 195 : 54, rage: 0, atkTimer: 0.85, attackAnim: 0, runPhase: Math.random() * 6,
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
    for (let i = units.length - 1; i >= 0; i--) if (units[i].side === 'enemy') units.splice(i, 1);
    towers.length = 0;
    const cards = TROOP_CARDS, nCard = Math.max(1, Math.min(4, cards.length));
    const soldiers = (n, x, lvl, namePrefix) => Array.from({ length: n }, (_, i) => {
      const u = makeSoldier(nextUid(), 'enemy', cards[i % nCard], x + (i % 4) * 30, 215 + (i % 4) * 42, lvl);
      if (namePrefix) u.name = namePrefix;
      return u;
    });
    const out = { type: mode, cfg };
    if (mode === 'tomb') {
      const total = (cfg.chests || 7) + (cfg.mines || 5);
      for (let i = 0; i < total; i++) {
        const mine = i < (cfg.mines || 5);
        units.push(makeProp(nextUid(), 'enemy', mine ? '黄金矿洞' : '宝箱车', '', 520 + i * 86, 226 + (i % 3) * 64, Math.round((mine ? 520 : 380) * (1 + lv * 0.12)), {
          isLoot: true,
          propSprite: mine ? 'building_goldmine' : 'prop_treasure_cart',
        }));
      }
      soldiers(6, 620, lv).forEach((u) => units.push(u));
      out.duration = cfg.duration || 60;
      out.lootTotal = total;
    } else if (mode === 'defend') {
      units.push(makeProp(nextUid(), 'player', '帅帐大营', '', 104, 302, cfg.baseHp || 9000, { isBase: true, def: 40, propSprite: 'prop_command_tent' }));
      const waves = cfg.waves || 15, names = cfg.waveNames || [];
      for (let w = 1; w <= waves; w++) {
        const list = soldiers(Math.min(8, 3 + Math.floor(w / 2)), WORLD_W - 120, lv + Math.floor(w / 3), names[(w - 1) % Math.max(1, names.length)]);
        if (w % 5 === 0) list.push(makeProp(nextUid(), 'enemy', '精英冲车', '', WORLD_W - 60, 300, Math.round(900 * (1 + lv * 0.15)), { isRam: true, propSprite: 'prop_siege_ram', spd: 46, atk: Math.round(60 + lv * 9), range: 60, atkTimer: 1 }));
        roundQueue.push(list);
      }
      roundQueue.shift().forEach((u) => units.push(u));
      out.totalRounds = waves;
      out.duration = cfg.duration || 90;
      out.waveEvery = out.duration / waves;
    } else if (mode === 'pass') {
      const passes = cfg.passes || [];
      passes.forEach((p, i) => {
        const list = soldiers(4 + Math.floor(i / 2), i === 0 ? 760 : WORLD_W - 150, lv + i);
        const g = makeEnemyGeneral(nextUid(), p.generalId, lv + i * 2, i === 0 ? 980 : WORLD_W - 90, 280, 1.5 + i * 0.25, 1.1 + i * 0.08, true);
        if (g) { g.name = p.name + '·' + g.name; list.push(g); }
        roundQueue.push(list);
      });
      (roundQueue.shift() || []).forEach((u) => units.push(u));
      out.totalRounds = Math.max(1, passes.length);
    } else if (mode === 'escort') {
      units.push(makeProp(nextUid(), 'player', '木牛流马', '', 150, 302, cfg.cartHp || 6000, { isCart: true, def: 30, propSprite: 'prop_wooden_ox' }));
      soldiers(4, 640, lv, '山贼').forEach((u) => units.push(u));
      out.manualEnd = true;
      out.noAutoWave = true;
    } else if (mode === 'chaos') {
      const boss = sp.boss || {}, bCfg = App.Config.BEASTS[boss.sprite];
      if (bCfg) {
        const m = boss.hpMult || 9;
        units.push({
          uid: nextUid(), side: 'enemy', facing: -1, kind: 'beast', id: bCfg.id, spriteKey: 'beast_sprite_' + bCfg.id, name: '太古凶兽·' + boss.name, unitType: 'spear',
          isWildBeast: true, shieldCounter: boss.counter, shieldReduce: cfg.shieldReduce || 0.9,
          x: WORLD_W - 250, y: 298, maxHp: Math.round(bCfg.hp * m * (1 + lv * 0.1)), hp: Math.round(bCfg.hp * m * (1 + lv * 0.1)),
          atk: Math.round(bCfg.atk * (boss.atkMult || 2) * (1 + lv * 0.05)), def: Math.round(bCfg.def * 1.6), crit: 0.22, spd: 68, range: 78, rage: 45,
          beastSkillTimer: 5.2, atkTimer: 0.75, attackAnim: 0, runPhase: 0, stunTimer: 0, hitFlash: 0, moving: false, alive: true, beastCfg: bCfg,
        });
      }
      soldiers(6, 900, lv).forEach((u) => units.push(u));
    }
    return out;
  }

  /** 特殊副本的本场表现分（服务端按上限封顶后据此发奖） */
  function specialScore(battle) {
    const sp = battle.special;
    if (!sp) return 0;
    if (sp.type === 'tomb') return sp.lootTotal - battle.units.filter((u) => u.isLoot && u.alive).length;
    if (sp.type === 'defend') return battle.status === 'victory' && battle.baseAlive !== false ? battle.totalRounds : Math.max(0, battle.round - 1);
    if (sp.type === 'pass') return battle.passCleared || 0;
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
      if (battle.timeLeft <= 0) { battle.timeLeft = 0; return end(sp.type !== 'tomb' || specialScore(battle) > 0); }
    }
    if (sp.type === 'tomb' && !battle.units.some((u) => u.isLoot && u.alive)) return end(true);
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
      if (battle.specialTimer >= (sp.cfg.ambushEvery || 7)) {
        battle.specialTimer = 0;
        const lv = sp.cfg.enemyLv || 10, front = Math.random() < 0.7;
        for (let i = 0; i < 3; i++) {
          const u = makeSoldier(battle.uidCounter++, 'enemy', TROOP_CARDS[Math.floor(Math.random() * Math.min(4, TROOP_CARDS.length))],
            Math.max(40, Math.min(WORLD_W - 40, cart.x + (front ? 300 + i * 26 : -240 - i * 26))), LANE_MIN_Y + Math.random() * 165, lv);
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
    if (mode === 'beast') return { rounds: w.dungeonRounds || 6, subGenerals: 2 };
    if (mode === 'demon') return { rounds: w.demonRounds || 4, subGenerals: 0 };
    if (mode === 'tower') return { rounds: (level.enemyGenerals || []).length ? 4 : 3, subGenerals: 4 };
    const ch = (level && level.chapter) || 1;
    const tier = (w.tiers || []).find((t) => ch <= t.maxChapter) || { rounds: 3, subGenerals: 0 };
    return { rounds: Math.max(1, tier.rounds || 3), subGenerals: tier.subGenerals || 0 };
  }

  /** 进入下一轮（倒计时结束或玩家点「嘲讽」） */
  function nextRound(battle) {
    if (battle.status !== 'fighting' || battle.round >= battle.totalRounds) return false;
    battle.round += 1;
    if (battle.special && battle.special.type === 'pass') {
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

  function makeSoldier(uid, side, card, x, y, lv) {
    // 我方小兵额外享受「兵种演武营」的等级加成
    const campLv = side === 'player' ? ((App.State.get().troopLevels || {})[card.id] || 0) : 0;
    const sc = (1 + (lv - 1) * 0.14) * (1 + campLv * ((App.Config.TROOP_CAMP || {}).statPerLevel || 0));
    const u = {
      uid, side, facing: side === 'player' ? 1 : -1,
      kind: 'soldier', id: card.id, spriteKey: card.spriteKey,
      name: card.name, unitType: card.unitType || card.id, isMagic: !!card.isMagic,
      x, y,
      maxHp: Math.round(card.hp * sc), hp: Math.round(card.hp * sc),
      atk: Math.round(card.atk * sc), def: Math.round(card.def * sc),
      crit: 0.07, spd: card.spd, range: card.range, rage: 0,
      atkTimer: 0.45 + Math.random() * 0.35, attackAnim: 0, runPhase: Math.random() * 6,
      stunTimer: 0, hitFlash: 0, moving: false, alive: true,
    };
    u.atkStyle = inferAttackStyle(u);
    u.isMounted = isSpriteMounted(u.spriteKey);
    u.atkProg = 0;
    u.atkDur = u.atkStyle === 'bow' ? 0.58 : (u.atkStyle === 'fan' ? 0.56 : 0.48);
    u.atkReleased = false;
    u.atkTarget = null;
    u.knockX = 0;
    return u;
  }

  function spawnPlayerTroop(battle, cardIdx) {
    const card = TROOP_CARDS[cardIdx];
    if (!card || battle.status !== 'fighting') return false;
    if (battle.wood < card.wood || battle.food < card.food) {
      if (App.UI) App.UI.showToast('木材或粮草不足！（可点上方【广告空投粮草】救急）', '#fbbf24');
      return false;
    }
    battle.wood -= card.wood;
    battle.food -= card.food;
    const avgLv = App.State.getAverageTeamLv();
    const y = LANE_MIN_Y + Math.random() * (LANE_MAX_Y - LANE_MIN_Y);
    battle.units.push(makeSoldier(battle.uidCounter++, 'player', card, 108, y, avgLv));
    return true;
  }

  function addFloatText(battle, x, y, text, color, big) {
    battle.floatTexts.push({ x, y, text, color: color || '#fff', big: !!big, life: 1.05, maxLife: 1.05 });
  }

  function spawnSparks(battle, x, y, color, count) {
    for (let i = 0; i < (count || 6); i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 115;
      battle.sparks.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 35,
        color: color || '#fde047', size: 2.4 + Math.random() * 2.8, life: 0.38 + Math.random() * 0.2,
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
      const d = Math.hypot(e.x - u.x, (e.y - u.y) * 1.15);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (u.side === 'player') {
      for (const t of battle.towers) {
        if (!t.alive) continue;
        const d = Math.hypot(t.x - u.x, (t.y - u.y) * 1.15);
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    return { target: best, dist: bestD };
  }

  function dealDamage(battle, attacker, target, mult, opts) {
    if (!target || !target.alive) return 0;
    const o = opts || {};
    const disDmgMult = (attacker.side === 'player' && battle.activeDisaster && battle.activeDisaster.dmgMult)
      ? battle.activeDisaster.dmgMult
      : 1.0;
    let dmg = Math.max(15, attacker.atk * mult * disDmgMult - (target.def || 15) * 0.42);
    const isCrit = Math.random() < (attacker.crit || 0.1);
    if (isCrit) dmg *= 1.5;
    if (target.shieldCounter && attacker.side === 'player' && App.State.get().activeBeastId !== target.shieldCounter) {
      dmg *= 1 - (target.shieldReduce || 0.9); // 没带克制神兽：凶兽护盾抵消大部分伤害
      if (Math.random() < 0.15) addFloatText(battle, target.x, target.y - 110, '护盾未破', '#93c5fd');
    }
    dmg = Math.round(dmg);

    target.hp = Math.max(0, target.hp - dmg);
    target.hitFlash = 0.16;
    const hitDir = target.x >= attacker.x ? 1 : -1;
    if (target.knockX !== undefined) {
      target.knockX = hitDir * (isCrit ? 6.5 : 3.8);
    }
    // 受击适度积攒怒气 (+3.8)，配合普攻约7.5秒集满绝技
    if (target.rage !== undefined) target.rage = Math.min(100, target.rage + 3.8);

    if (!o.fromProjectile && (!attacker.range || attacker.range <= 100)) {
      const style = attacker.atkStyle || 'cleave';
      if (App.Audio) App.Audio.playSfx(style === 'thrust' ? 'spear_thrust' : 'sword_hit');
      const wEq = attacker.equips && attacker.equips.weapon ? App.Config.EQUIP_TEMPLATES[attacker.equips.weapon.tplId] : null;
      const baseCol = isCrit ? '#facc15' : (wEq ? (wEq.glowColor || '#38bdf8') : (attacker.side === 'player' ? '#fef08a' : '#fca5a5'));
      battle.projectiles.push({
        kind: style === 'thrust' ? 'thrust' : 'slash',
        x1: attacker.x + hitDir * 14,
        y1: attacker.y - (attacker.isMounted ? 36 : 24),
        x2: target.x,
        y2: target.y - (target.isMounted ? 34 : 24),
        dir: hitDir,
        isCrit,
        scale: attacker.kind === 'general' ? 1.28 : (attacker.kind === 'beast' ? 1.55 : 0.92),
        color: baseCol,
        life: 0.26,
        maxLife: 0.26,
      });
      spawnSparks(battle, (attacker.x + target.x) / 2, target.y - 28, isCrit ? '#fde047' : '#fed7aa', isCrit ? 11 : 6);
    } else {
      spawnSparks(battle, target.x, target.y - 28, o.sparkColor || (isCrit ? '#fde047' : '#bae6fd'), isCrit ? 9 : 5);
    }

    addFloatText(battle, target.x, target.y - 54, (isCrit ? '暴击 ' : '') + '-' + dmg, isCrit ? '#fde047' : '#ffffff', isCrit);

    if (target.hp <= 0) {
      target.alive = false;
      if (attacker.rage !== undefined) attacker.rage = Math.min(100, attacker.rage + 6);
      if (target.kind) {
        battle.dyingUnits.push(Object.assign({}, target, { dieTimer: 0.55, maxDie: 0.55 }));
      }
      if (target.side === 'enemy') {
        const gain = target.kind ? 8 : 45;
        battle.wood = Math.min(999, battle.wood + gain);
        battle.food = Math.min(999, battle.food + gain);
        addFloatText(battle, target.x, target.y - 72, `缴获+${gain}木粮`, '#86efac', !target.kind);
      }

      if (target.isWildBeast && battle.mode === 'beast') {
        addFloatText(battle, target.x, target.y - 94, '神兽已被镇伏！大获全胜！', '#fde047', true);
        battle.units.forEach((u) => { if (u.side === 'enemy') u.alive = false; });
        battle.towers.forEach((t) => { t.alive = false; });
        checkBattleEnd(battle);
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
      else if (style === 'fan') pKind = isGen ? 'gen_fan' : 'fan_wave';
      else pKind = isGen ? 'gen_arrow' : 'arrow';
    }

    const startX = isTower ? attacker.x - 10 : attacker.x + facing * (attacker.isMounted ? 22 : 15);
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
    const mainColor = isFan
      ? (elColorMap[cfgEl] || (attacker.isMagic ? '#c084fc' : '#2dd4bf'))
      : (pKind === 'tower_arrow' ? '#fb923c' : (attacker.side === 'player' ? '#fde047' : '#fca5a5'));

    if (App.Audio && !isTower) {
      App.Audio.playSfx(isFan ? 'fan_cast' : 'bow_shoot');
    }

    battle.projectiles.push({
      kind: pKind,
      ballistic: true,
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
    // ★ 全屏大招直接点击即全屏轰击，无需选点！
    if (caster.cfg && caster.cfg.isFullscreenSkill) {
      return executeGeneralSkillAt(battle, caster, battle.cameraX + App.Platform.LOGICAL_W / 2, 285);
    }
    if (caster.needsManualAim) {
      battle.aimingUnit = battle.aimingUnit === caster ? null : caster;
      if (battle.aimingUnit && App.UI) {
        App.UI.showToast(`请点击战场目标位置释放【${caster.cfg.skillName}】！`, '#fde047');
      }
      return true;
    }
    return executeGeneralSkillAt(battle, caster, caster.x + caster.facing * 180, caster.y);
  }

  function executeGeneralSkillAt(battle, caster, worldX, worldY) {
    if (!caster || !caster.alive) return false;
    caster.rage = 0;
    caster.attackAnim = 1.0;
    battle.aimingUnit = null;

    const cfg = caster.cfg;
    const isFull = !!(cfg.isFullscreenSkill || (cfg.vfxSpec && cfg.vfxSpec.isFullscreen));
    const enemySide = caster.side === 'player' ? 'enemy' : 'player';
    const enemies = battle.units.filter((e) => e.alive && e.side === enemySide);

    // 触发带名将立绘切入的技能特写横幅 + 震屏 + 10大形态/全屏炫光大招动画！
    if (App.Audio) App.Audio.playSfx('ultimate');
    showBanner(
      battle,
      `${caster.name} · ${cfg.skillName}${isFull ? '【全屏】' : ''}`,
      cfg.skillDesc,
      caster.side === 'player' ? '#fde047' : '#f87171',
      caster.id,
      null
    );
    battle.shakeTimer = Math.max(battle.shakeTimer || 0, isFull ? 0.45 : 0.32);

    battle.skillEffects.push({
      generalId: caster.id,
      casterName: caster.name,
      x: worldX,
      y: worldY,
      casterX: caster.x,
      casterY: caster.y,
      facing: caster.facing || (caster.side === 'player' ? 1 : -1),
      skillName: cfg.skillName,
      isFullscreen: isFull,
      element: cfg.skillElement || 'thunder',
      vfxSpec: cfg.vfxSpec || null,
      life: isFull ? 1.85 : 1.60,
      maxLife: isFull ? 1.85 : 1.60,
    });
    spawnSparks(battle, worldX, worldY - 28, '#fde047', isFull ? 40 : 28);

    const hitRadius = isFull
      ? 620 // 全屏技能覆盖视野及前方整片敌军！
      : ((cfg.vfxSpec && (cfg.vfxSpec.form === 'cavalry_stampede' || cfg.vfxSpec.form === 'dragon_lance_beam')) ? 340 : 215);
    const dmgScale = isFull ? (cfg.skillPower || 2.0) * 0.85 : (cfg.skillPower || 2.0);

    enemies.forEach((e) => {
      if (isFull ? (Math.abs(e.x - worldX) <= hitRadius) : (Math.hypot(e.x - worldX, (e.y - worldY) * 1.2) <= hitRadius)) {
        dealDamage(battle, caster, e, dmgScale);
        if (e.alive && (cfg.skillType.includes('stun') || cfg.skillType.includes('freeze') || cfg.skillType.includes('charm'))) {
          e.stunTimer = Math.max(e.stunTimer, isFull ? 2.0 : 2.6);
          addFloatText(battle, e.x, e.y - 76, '★控制!', '#fde047', true);
        }
      }
    });

    if (caster.side === 'player') {
      battle.towers.forEach((t) => {
        if (t.alive && (isFull ? Math.abs(t.x - worldX) <= hitRadius : Math.hypot(t.x - worldX, t.y - worldY) <= 195)) {
          dealDamage(battle, caster, t, dmgScale * 0.82);
        }
      });
    }

    if (cfg.skillType === 'heal_burn' || cfg.skillType === 'lifesteal_cleave') {
      const plagueMult = (caster.side === 'player' && battle.activeDisaster && battle.activeDisaster.id === 'plague') ? 0.65 : 1.0;
      battle.units.filter((a) => a.alive && a.side === caster.side).forEach((a) => {
        const heal = Math.round(a.maxHp * (cfg.skillType === 'heal_burn' ? 0.25 : 0.15) * plagueMult);
        a.hp = Math.min(a.maxHp, a.hp + heal);
        addFloatText(battle, a.x, a.y - 54, '+' + heal, '#4ade80');
      });
    }
    checkBattleEnd(battle);
    return true;
  }

  function castBeastUltimate(battle, beastUnit) {
    if (!beastUnit || !beastUnit.alive) return false;
    beastUnit.rage = 0;
    beastUnit.attackAnim = 1.0;
    const bCfg = beastUnit.beastCfg || App.Config.BEASTS[beastUnit.id];
    const enemySide = beastUnit.side === 'player' ? 'enemy' : 'player';
    const targets = battle.units.filter((u) => u.alive && u.side === enemySide);
    if (!targets.length) return false;

    if (App.Audio) App.Audio.playSfx('ultimate');
    showBanner(battle, `四象降临 · ${bCfg.name}【${bCfg.skillName}】`, bCfg.skillDesc, bCfg.glow, null, beastUnit.id);
    battle.shakeTimer = Math.max(battle.shakeTimer || 0, 0.42);
    const elemMap = { qinglong: 'thunder', zhuque: 'fire', baihu: 'slash_crimson', xuanwu: 'ice' };

    battle.skillEffects.push({
      beastId: beastUnit.id,
      casterName: bCfg.name,
      x: battle.cameraX + App.Platform.LOGICAL_W / 2,
      y: 285,
      casterX: beastUnit.x,
      casterY: beastUnit.y,
      facing: beastUnit.facing || 1,
      skillName: bCfg.skillName,
      isFullscreen: true,
      element: elemMap[beastUnit.id] || 'thunder',
      life: 1.85,
      maxLife: 1.85,
    });

    targets.slice(0, 6).forEach((t) => {
      dealDamage(battle, beastUnit, t, beastUnit.id === 'baihu' ? 2.15 : 1.65);
      if (t.alive && (beastUnit.id === 'qinglong' || beastUnit.id === 'xuanwu')) {
        t.stunTimer = Math.max(t.stunTimer, 2.1);
      }
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

  // 招降 / 捕获：成功与否由服务端掷骰，这里只更新界面状态
  function postVictoryRecruit(battle, isAdDouble) {
    if (!battle.captiveGeneralId || battle.recruitState === 'success') return Promise.resolve({ ok: false });
    return App.State.recruit(battle.serverId, isAdDouble).then((res) => {
      if (!res.ok) return res;
      battle.recruitState = res.success ? 'success' : 'failed';
      battle.recruitDuplicate = !!res.duplicate;
      if (res.success && App.Audio) App.Audio.playSfx('recruit');
      return res;
    });
  }

  function postVictoryCatchBeast(battle, useGoldRope) {
    if (!battle.captiveBeastId || battle.catchState === 'success') return Promise.resolve({ ok: false });
    return App.State.catchBeast(battle.serverId, useGoldRope).then((res) => {
      if (!res.ok) return res;
      battle.catchState = res.success ? 'success' : 'failed';
      if (res.success && App.Audio) App.Audio.playSfx('recruit');
      return res;
    });
  }

  function checkBattleEnd(battle) {
    if (battle.status !== 'fighting') return;
    const pAlive = battle.units.filter((u) => u.alive && u.side === 'player');
    const eAlive = battle.units.filter((u) => u.alive && u.side === 'enemy');
    const tAlive = battle.towers.filter((t) => t.alive);
    const beastCleared = battle.mode === 'beast' && !battle.units.some((u) => u.alive && u.isWildBeast);

    const finalRound = battle.round >= battle.totalRounds;
    const sp = battle.special;
    const normalWin = !(sp && sp.manualEnd) && finalRound && (beastCleared || (eAlive.length === 0 && tAlive.length === 0));
    // 我方只剩帅帐 / 粮车也算全军覆没；过关斩将全灭时按已过关数结算
    const wiped = pAlive.filter((u) => !u.isProp).length === 0 && !(sp && (sp.type === 'defend' || sp.type === 'escort'));
    if (sp && sp.type === 'pass' && normalWin) battle.passCleared = battle.totalRounds;
    if (sp && sp.type === 'pass' && wiped && (battle.passCleared || 0) >= 1 && !battle.forceEnd) battle.forceEnd = 'win';
    if (battle.forceEnd === 'win' || (battle.forceEnd !== 'lose' && normalWin)) {
      battle.status = 'victory';
      battle.aimingUnit = null;
      if (App.Audio) App.Audio.playSfx('victory');
      if (!battle.rewardClaimed) {
        battle.rewardClaimed = true;
        // 胜负上报服务端，由服务端发放铜钱、将魂、装备、经验并标记通关
        battle.status = 'victory';
        App.State.finishBattle(battle.serverId, true, specialScore(battle)).then((res) => {
          battle.settled = true;
          if (!res.ok) return;
          if (res.battle) { battle.goldReward = res.battle.gold || 0; battle.soulReward = res.battle.soul || 0; battle.expGain = res.battle.exp || 0; }
          if (res.loot && res.loot.length) { battle.lootText = '战利品：' + res.loot.join(' · '); App.UI.showToast(battle.lootText, '#fde047'); }
          battle.droppedEquip = res.droppedEquip || null;
          battle.levelUpInfo = res.lvInfo || null;
        });
      }
    } else if (battle.forceEnd === 'lose' || wiped) {
      battle.status = 'defeat';
      battle.aimingUnit = null;
      if (App.Audio) App.Audio.playSfx('defeat');
      App.State.finishBattle(battle.serverId, false).then(() => { battle.settled = true; });
    }
  }

  function updateBattle(battle, rawDt) {
    if (battle.introTimer > 0) {
      battle.introTimer = Math.max(0, battle.introTimer - rawDt);
    }
    const aimSlow = battle.aimingUnit ? 0.2 : 1.0;
    const dt = Math.min(0.05, rawDt) * (battle.paused ? 0 : battle.speedMult * aimSlow);

    if (battle.shakeTimer > 0) battle.shakeTimer = Math.max(0, battle.shakeTimer - rawDt);
    if (battle.banner) {
      battle.banner.timer -= rawDt;
      if (battle.banner.timer <= 0) battle.banner = null;
    }

    for (let i = battle.floatTexts.length - 1; i >= 0; i--) {
      battle.floatTexts[i].life -= rawDt;
      battle.floatTexts[i].y -= 26 * rawDt;
      if (battle.floatTexts[i].life <= 0) battle.floatTexts.splice(i, 1);
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
              sparkColor: isFan ? p.color : '#fef08a',
            });
            battle.projectiles.push({
              kind: 'impact_ring',
              x2: p.x2,
              y2: p.y2,
              color: p.color,
              isFan,
              life: 0.22,
              maxLife: 0.22,
            });
            checkBattleEnd(battle);
          }
          battle.projectiles.splice(i, 1);
        }
      } else {
        p.life -= rawDt;
        if (p.life <= 0) battle.projectiles.splice(i, 1);
      }
    }
    for (let i = battle.skillEffects.length - 1; i >= 0; i--) {
      battle.skillEffects[i].life -= rawDt;
      if (battle.skillEffects[i].life <= 0) battle.skillEffects.splice(i, 1);
    }
    for (let i = battle.dyingUnits.length - 1; i >= 0; i--) {
      battle.dyingUnits[i].dieTimer -= rawDt;
      if (battle.dyingUnits[i].dieTimer <= 0) battle.dyingUnits.splice(i, 1);
    }
    for (let i = battle.dustParticles.length - 1; i >= 0; i--) {
      const d = battle.dustParticles[i];
      d.life -= rawDt; d.x += d.vx * rawDt; d.y += d.vy * rawDt;
      if (d.life <= 0) battle.dustParticles.splice(i, 1);
    }
    for (let i = battle.sparks.length - 1; i >= 0; i--) {
      const s = battle.sparks[i];
      s.life -= rawDt; s.x += s.vx * rawDt; s.y += s.vy * rawDt; s.vy += 180 * rawDt;
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

    if (battle.status !== 'fighting' || dt <= 0) return;

    const pNearNode = battle.units.some((u) => u.alive && u.side === 'player' && u.x > 640);
    const eNearNode = battle.units.some((u) => u.alive && u.side === 'enemy' && u.x < 760);
    if (pNearNode && !eNearNode && battle.centerNode.owner !== 'player') {
      battle.centerNode.owner = 'player';
      if (App.UI) App.UI.showToast('已占领中军辎重矿！木材粮草产出翻倍！', '#4ade80');
    } else if (eNearNode && !pNearNode && battle.centerNode.owner === 'player') {
      battle.centerNode.owner = 'enemy';
    }

    battle.resTimer += dt;
    if (battle.resTimer >= 2.0) {
      battle.resTimer -= 2.0;
      battle.wood = Math.min(999, battle.wood + 10);
      battle.food = Math.min(999, battle.food + 10);
      addFloatText(battle, 68, 152, '+10 木材', '#fde047');
      addFloatText(battle, 68, 308, '+10 粮草', '#86efac');
      if (battle.centerNode.owner === 'player') {
        battle.wood = Math.min(999, battle.wood + 12);
        battle.food = Math.min(999, battle.food + 12);
        addFloatText(battle, battle.centerNode.x, battle.centerNode.y - 42, '+12木 +12粮', '#4ade80', true);
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
          const lastId = battle.lastDisasterId || null;
          const candidates = pool.length > 1 ? pool.filter((d) => d.id !== lastId) : pool;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
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

    // 本轮敌军全灭 → 倒计时后下一轮（玩家可点「嘲讽」立即开始）
    if (battle.status === 'fighting' && battle.round < battle.totalRounds && battle.introTimer <= 0) {
      if (battle.roundWaiting) {
        battle.roundCountdown -= dt;
        if (battle.roundCountdown <= 0) nextRound(battle);
      } else if (!battle.units.some((u) => u.alive && u.side === 'enemy')) {
        battle.roundWaiting = true;
        battle.roundCountdown = (App.Config.WAVES && App.Config.WAVES.countdownSeconds) || 8;
      }
    }
    if (battle.totalRounds <= 1 && !(battle.special && battle.special.noAutoWave) && battle.enemyWaveTimer <= 0 && battle.units.filter((u) => u.alive && u.side === 'enemy').length < maxEnemyCap) {
      battle.enemyWaveTimer = battle.mode === 'beast'
        ? 5.6
        : Math.max(5.2, 9.6 - stageOrd * 0.14);
      const lv = battle.arenaMatch ? battle.arenaMatch.lv : (battle.level ? battle.level.recommendedLv : 1);
      const waveCnt = stageOrd <= 4 ? 2 : 3;
      for (let i = 0; i < waveCnt; i++) {
        const c = TROOP_CARDS[Math.floor(Math.random() * 4)];
        battle.units.push(makeSoldier(battle.uidCounter++, 'enemy', c, WORLD_W - 85, LANE_MIN_Y + Math.random() * 165, lv));
      }
    }

    battle.towers.forEach((t) => {
      if (!t.alive) return;
      if (t.hitFlash > 0) t.hitFlash -= dt;
      t.atkTimer -= dt;
      if (t.atkTimer <= 0) {
        t.atkTimer = 1.45;
        const pTargets = battle.units.filter((u) => u.alive && u.side === 'player' && Math.hypot(u.x - t.x, u.y - t.y) < 275);
        if (pTargets[0]) {
          launchBallisticProjectile(battle, t, pTargets[0], 1.0, 'tower_arrow');
        }
      }
    });

    battle.units.forEach((u) => {
      if (!u.alive) return;
      if (u.hitFlash > 0) u.hitFlash -= dt;
      if (u.isProp && !u.isRam) return; // 宝箱车、帅帐、粮车不行动
      if (u.knockX) {
        u.knockX *= Math.max(0, 1 - dt * 15);
        if (Math.abs(u.knockX) < 0.1) u.knockX = 0;
      }
      if (u.attackAnim > 0) u.attackAnim = Math.max(0, u.attackAnim - dt * 2.3);

      // ★ 推进三段式协调攻击动作（蓄力拉弓/扬扇/回枪 -> 满弦激射/挥扇/劈刺爆发 -> 缓冲收势）
      if (u.atkProg > 0) {
        u.atkProg += dt / (u.atkDur || 0.50);
        const relPt = u.atkStyle === 'bow' ? 0.45 : (u.atkStyle === 'fan' ? 0.40 : (u.atkStyle === 'thrust' ? 0.32 : 0.35));
        if (!u.atkReleased && u.atkProg >= relPt) {
          u.atkReleased = true;
          let actTarget = u.atkTarget;
          if (!actTarget || !actTarget.alive) {
            actTarget = findNearestEnemy(battle, u).target;
          }
          if (actTarget && actTarget.alive) {
            if (u.side === 'enemy' && u.kind === 'general' && u.rage >= 100) {
              executeGeneralSkillAt(battle, u, actTarget.x, actTarget.y);
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

      if (u.stunTimer > 0) {
        u.stunTimer -= dt;
        u.moving = false;
        u.atkProg = 0;
        return;
      }

      if (u.isWildBeast) {
        u.beastSkillTimer -= dt;
        if (u.beastSkillTimer <= 0) {
          u.beastSkillTimer = 6.8;
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
                battle.skillEffects.push({ x: zx, y: zy, element: elemMap[u.id] || 'thunder', life: 0.8, maxLife: 0.8 });
                showBanner(battle, `${u.name} · ${u.beastCfg.skillName}`, '毁天灭地四象神威爆发！', u.beastCfg.glow, null, u.id);
                spawnSparks(battle, zx, zy - 20, u.beastCfg.glow, 26);
                battle.units.filter((p) => p.alive && p.side === 'player').forEach((p) => {
                  if (Math.hypot(p.x - zx, (p.y - zy) * 1.2) <= 165) {
                    dealDamage(battle, u, p, 2.25);
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
          u.moving = false; u.facing = 1; return;
        }
        if (battle.order === 'retreat') {
          if (u.x > 115) {
            u.x -= u.spd * 1.3 * dt;
            u.facing = -1;
            u.moving = true;
            u.runPhase += dt * 11;
          } else {
            u.moving = false; u.facing = 1;
          }
          return;
        }
      }

      const { target, dist } = findNearestEnemy(battle, u);
      if (!target) { u.moving = false; return; }

      // 计算当前自然灾害对己方将领、神兽与小兵的移速/射程/攻速影响
      const pDis = (u.side === 'player' && battle.activeDisaster) ? battle.activeDisaster : null;
      const effSpd = u.spd * (pDis ? (pDis.spdMult || 1) : 1);
      const effRange = u.range > 90 ? u.range * (pDis ? (pDis.rangeMult || 1) : 1) : u.range;
      const effAtkSpd = pDis ? (pDis.atkSpdMult || 1) : 1;

      if (dist > effRange && u.atkProg === 0) {
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const headwind = (pDis && pDis.pushBack) ? -pDis.pushBack : 0;
        const vx = (dx / len) * effSpd + headwind;
        u.x = Math.max(55, Math.min(WORLD_W - 55, u.x + vx * dt));
        u.y = Math.max(LANE_MIN_Y, Math.min(LANE_MAX_Y, u.y + (dy / len) * effSpd * 0.72 * dt));
        if (Math.abs(vx) > 1) u.facing = vx >= 0 ? 1 : -1;
        u.moving = true;
        const prevPhase = u.runPhase;
        const cadence = u.isMounted ? 9.6 : (u.kind === 'beast' ? 8.8 : 11.2);
        u.runPhase += dt * cadence * (pDis ? (pDis.spdMult || 1) : 1);

        // 战马铁蹄与步卒踏地节拍同步扬起沙尘（告别随机乱冒气泡！）
        if (Math.floor(prevPhase / Math.PI) !== Math.floor(u.runPhase / Math.PI)) {
          const hoofCount = u.isMounted || u.kind === 'beast' ? 2 : 1;
          for (let hc = 0; hc < hoofCount; hc++) {
            battle.dustParticles.push({
              x: u.x - u.facing * (10 + hc * 12) + (Math.random() - 0.5) * 6,
              y: u.y + 4 + (Math.random() - 0.5) * 3,
              vx: -u.facing * (18 + Math.random() * 16),
              vy: -6 - Math.random() * 8,
              size: u.kind === 'beast' ? 7.5 : (u.isMounted ? 5.2 : 3.5),
              life: 0.32,
              maxLife: 0.32,
            });
          }
        }
      } else {
        u.moving = false;
        u.facing = target.x >= u.x ? 1 : -1;
        u.atkTimer -= dt * effAtkSpd;
        if (u.atkTimer <= 0 && u.atkProg === 0) {
          u.atkTimer = u.kind === 'soldier' ? 1.15 : 1.0;
          u.attackAnim = 1.0;
          u.atkProg = 0.001;
          u.atkReleased = false;
          u.atkTarget = target;
          if (u.kind === 'general' || u.kind === 'beast') {
            // 每次普攻积攒 +13.5 怒气（开场接敌后约 5~6 秒、总计约 8.5 秒即可痛快放大招！）
            u.rage = Math.min(100, (u.rage || 0) + (u.side === 'player' ? 13.5 : 9.5));
          }
        }
      }
    });

    if (battle.autoCam && !battle.aimingUnit) {
      const pGens = battle.units.filter((u) => u.alive && u.side === 'player' && u.kind === 'general');
      if (pGens.length) {
        const frontX = Math.max(...pGens.map((g) => g.x));
        const targetCam = Math.max(0, Math.min(WORLD_W - App.Platform.LOGICAL_W, frontX - 300));
        battle.cameraX += (targetCam - battle.cameraX) * Math.min(1, rawDt * 4);
      }
    }
  }

  App.BattleEngine = {
    WORLD_W,
    TROOP_CARDS,
    createBattle,
    spawnPlayerTroop,
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
