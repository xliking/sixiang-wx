(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let currentScene = 'faction';
  let lastTime = 0;
  let elapsed = 0;
  let dirtyUntil = 0;
  let lastRenderAt = 0;

  const AMBIENT_SCENES = { map: 1, wheel: 1, worldBoss: 1, demon: 1, beastDungeon: 1, hire: 1 };

  function markDirty(holdMs) {
    const until = Date.now() + (holdMs != null ? holdMs : 180);
    if (until > dirtyUntil) dirtyUntil = until;
  }

  // 场景 → 对应的功能开启项（后台「功能开启」配置）；未达到等级时不进入并提示
  const SCENE_FEATURE = { arena: 'arena', shop: 'shop', ingotShop: 'ingotShop', wheel: 'wheel', camp: 'camp', forge: 'forge', market: 'market', hire: 'hire', tower: 'tower',
    challenge: 'challenge', demon: 'demon', rank: 'rank', guild: 'guild', worldBoss: 'worldBoss' };

  function goScene(name, params) {
    if (currentScene === 'wheel' && name !== 'wheel' && App.Scenes.wheel && App.Scenes.wheel.isSpinning && App.Scenes.wheel.isSpinning()) {
      App.UI.showToast('轮盘旋转开奖中，请稍候…', '#fde047');
      return;
    }
    if (SCENE_FEATURE[name] && !App.State.checkFeature(SCENE_FEATURE[name])) return;
    if (App.UI && App.UI.closeExchangeModal) App.UI.closeExchangeModal();
    const prevSc = App.Scenes[currentScene];
    if (prevSc && prevSc.leave && currentScene !== name) {
      try { prevSc.leave(); } catch (e) {}
    }
    currentScene = name;
    markDirty(400);
    if (App.Audio) App.Audio.setSceneBGM(name, params);
    const sc = App.Scenes[name];
    if (sc && sc.enter) sc.enter(params);
    if (name === 'map') tryBindInviter();
  }

  // 从好友分享卡片进入的新玩家：建号后自动绑定邀请人（只尝试一次）
  const KEY_INVITER = 'sixiang_pending_inviter';
  function tryBindInviter() {
    const code = App.Platform.loadStorage(KEY_INVITER);
    if (!code || !App.State.get().factionId) return;
    App.Platform.clearStorage(KEY_INVITER);
    App.State.bindInviter(code, true);
  }

  let battleTransit = null;

  const BATTLE_TIPS = [
    '军师锦囊：点击下方兵种卡源源不断派兵推进，步盾在前、弓法在后可大幅降低战损',
    '军师锦囊：占领战场中央【辎重矿】可额外获得每秒木材与粮草补给，形成兵海压制',
    '军师锦囊：名将怒气蓄满后点击左下头像即可施放绝技，关键时刻一锤定音',
    '军师锦囊：前往【演武营】操练升级中军主营、守御箭垒与五军兵种，全军战力飙升',
    '军师锦囊：击败关卡守将后可帐前礼贤招降，即使暂未归顺也会累积保底赏识度',
  ];

  function resolveBattlePreview(mode, target, params) {
    const p = params || {};
    const lv = p.level || {};
    const st = App.State.get();
    const leadGenId = (st.deployIds && st.deployIds[0]) || Object.keys(st.ownedGenerals || {})[0] || 'zhaoyun';
    const leadGen = (App.Config.GENERALS && App.Config.GENERALS[leadGenId]) || null;

    let title = '三军拔营 · 奔赴沙场';
    let subTitle = '点兵聚将 · 阵图推演中';
    let enemyKind = 'general';
    let enemyId = null;
    let enemyName = '敌军守将';

    if (mode === 'city') {
      const ord = lv.order || Number(target) || 1;
      title = `第 ${ord} 关 · ${lv.name || '雄关要隘'}`;
      subTitle = `推荐战力 ${lv.power || (ord * 650)} · 攻破敌营生擒守将`;
      enemyId = lv.bossId || (lv.enemyGenerals && lv.enemyGenerals[0] && lv.enemyGenerals[0].id);
    } else if (mode === 'beast') {
      const bid = lv.beastId || lv.id || String(target);
      const bCfg = App.Config.BEASTS && App.Config.BEASTS[bid];
      title = `四象秘境 · ${(bCfg && bCfg.dungeon) || lv.name || '圣兽古域'}`;
      subTitle = '镇伏上古圣兽 · 祭起缚兽索缔结契约';
      enemyKind = 'beast';
      enemyId = bid;
      enemyName = (bCfg && bCfg.name) || '四象圣兽';
    } else if (mode === 'arena') {
      const m = p.arenaMatch || {};
      title = `${m.spar ? '演武切磋' : '演武校场'} · 对阵 ${m.playerName || m.name || '群雄豪杰'}`;
      subTitle = m.spar ? '好友试阵 · 免挑战令、不计天梯名次' : '校场争锋 · 冲击演武风云榜';
      enemyId = (m.generals && m.generals[0]) || 'lvbu';
      enemyName = m.playerName || m.name || '演武劲敌';
    } else if (mode === 'tower') {
      title = `铜雀天梯 · 第 ${target} 层`;
      subTitle = '层层破阵 · 赢取神兵玄铁与挂机厚赏';
      enemyId = lv.bossId || (lv.enemyGenerals && lv.enemyGenerals[0] && lv.enemyGenerals[0].id);
    } else if (mode === 'demon') {
      title = `魔将讨伐 · ${(lv.demon && lv.demon.name) || lv.name || '魔神降临'}`;
      subTitle = '全军集火 · 斩获讨伐积分兑换秘宝';
      enemyId = lv.bossId || (lv.enemyGenerals && lv.enemyGenerals[0] && lv.enemyGenerals[0].id);
    } else if (mode === 'xian') {
      title = lv.name || '成神副本 · 九天封神台';
      subTitle = '连破三重神门 · 夺取九转封神丹与太初神灵髓';
      const passes = (lv.special && lv.special.cfg && lv.special.cfg.passes) || [];
      enemyId = (passes[passes.length - 1] && passes[passes.length - 1].generalId) || 'guanyu';
    } else if (mode === 'mo') {
      title = lv.name || '成魔副本 · 幽冥魔渊';
      subTitle = '踏破三重魔坛 · 炼化九幽化魔丹与炼狱魔煞晶';
      const passes = (lv.special && lv.special.cfg && lv.special.cfg.passes) || [];
      enemyId = (passes[passes.length - 1] && passes[passes.length - 1].generalId) || 'lvbu';
    } else {
      title = lv.name || '征战秘境 · 奇兵破敌';
      subTitle = '整饬兵甲 · 迎战强敌';
      enemyId = lv.bossId || (lv.enemyGenerals && lv.enemyGenerals[0] && lv.enemyGenerals[0].id);
    }

    if (enemyKind === 'general' && enemyId && App.Config.GENERALS && App.Config.GENERALS[enemyId]) {
      enemyName = App.Config.GENERALS[enemyId].name;
    }

    // 提前并行预热本场战斗核心贴图（沙场背景、主营箭垒、兵种、双方主将立绘），进入战场即刻丝滑呈现
    const ch = lv.chapter || 1;
    const chTheme = lv.mapTheme || (App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(ch) : null);
    const resolvedBgKey = App.Config.resolveBattleBgKey
      ? App.Config.resolveBattleBgKey({ mode, level: lv, chapter: ch, chapterTheme: chTheme, biome: lv.biome })
      : ((chTheme && chTheme.battleKey) || 'bg_battle');
    const isNoTroopsPreview = mode === 'arena' || !!(lv && lv.raid);
    const preloadKeys = [
      resolvedBgKey,
      'bg_battle',
      'prop_command_tent',
      'city_fortress',
      'tower_sprite',
      ...(isNoTroopsPreview ? [] : [
        'building_lumber',
        'building_granary',
        'building_goldmine',
        'unit_infantry',
        'unit_pikeman',
        'unit_archer',
      ]),
      'unit_gen_silver',
      'unit_gen_heavy',
      'unit_gen_mage',
      'unit_gen_female',
    ];
    const pushPortraitKey = (gid) => {
      if (!gid || !App.Config.GENERALS) return;
      const g = App.Config.GENERALS[gid];
      if (!g) return;
      if (g.portraitSpec && g.portraitSpec.baseId) {
        preloadKeys.push('general_' + g.portraitSpec.baseId);
        if (g.portraitSpec.vfxBg) preloadKeys.push(g.portraitSpec.vfxBg);
      } else {
        preloadKeys.push('general_' + gid);
      }
    };
    if (leadGenId) pushPortraitKey(leadGenId);
    (st.deployIds || []).slice(0, 5).forEach((gid) => pushPortraitKey(gid));
    if (st.activeBeastId) {
      preloadKeys.push('beast_' + st.activeBeastId, 'beast_sprite_' + st.activeBeastId);
    }
    if (enemyKind === 'beast' && enemyId) {
      preloadKeys.push('beast_' + enemyId, 'beast_sprite_' + enemyId);
    } else if (enemyId) {
      pushPortraitKey(enemyId);
    }
    if (App.Assets && App.Assets.get) {
      preloadKeys.forEach((k) => App.Assets.get(k));
    }

    const tipPool = isNoTroopsPreview ? BATTLE_TIPS.slice(2) : BATTLE_TIPS;
    return {
      title,
      subTitle,
      leadGenId,
      leadName: (leadGen && leadGen.name) || '麾下主将',
      enemyKind,
      enemyId,
      enemyName,
      preloadKeys,
      tip: tipPool[Math.floor(Math.random() * tipPool.length)],
    };
  }

  /** 开战：点击即刻切入国风战鼓点兵加载页动画，同步请求服务端与预热战场资源，彻底告别干等！ */
  function startBattle(mode, target, params) {
    if (battleTransit && battleTransit.promise) return battleTransit.promise;

    const prevScene = currentScene === 'battleLoading' ? (battleTransit ? battleTransit.prevScene : 'map') : currentScene;
    const preview = resolveBattlePreview(mode, target, params);
    const startedAt = Date.now();
    const MIN_ANIM_MS = 480;
    const MAX_ASSET_WAIT_MS = 780;

    const stateObj = {
      prevScene,
      mode,
      target,
      params,
      preview,
      startedAt,
      progress: 0.08,
      apiDone: false,
      apiRes: null,
      finishing: false,
      promise: null,
    };
    battleTransit = stateObj;
    currentScene = 'battleLoading';
    if (App.Audio) App.Audio.playSfx('click');

    stateObj.promise = new Promise((resolve) => {
      stateObj.resolve = resolve;
      App.State.startBattle(mode, target).then((res) => {
        stateObj.apiDone = true;
        stateObj.apiRes = res || { ok: false };
        if (!stateObj.apiRes.ok) {
          // 服务端校验未通过（如粮草/次数不足）：立即退回原界面并保留提示
          battleTransit = null;
          currentScene = prevScene;
          resolve(stateObj.apiRes);
        }
      });
    });

    return stateObj.promise;
  }

  let connecting = false;
  const MIN_SPLASH_MS = 1100;
  function connect() {
    if (connecting) return;
    if (App.Compliance && !App.Compliance.hasAgreed()) return;
    connecting = true;
    const splashStart = Date.now();
    const inviter = App.Platform.getLaunchQuery().inviter;
    if (inviter && /^\d{6,12}$/.test(String(inviter))) App.Platform.saveStorage(KEY_INVITER, String(inviter));
    App.API.boot().then((ok) => {
      const waitMs = ok ? Math.max(0, MIN_SPLASH_MS - (Date.now() - splashStart)) : 0;
      setTimeout(() => {
        connecting = false;
        if (App.Compliance && !App.Compliance.hasAgreed()) return;
        if (ok) {
          App.Platform.setupShareMenu(() => {
            const titles = (App.Config.INVITE && App.Config.INVITE.shareTitles) || [];
            return { title: titles[0] || '群英志', query: 'inviter=' + (App.State.getProfile().playerId || '') };
          });
          // 没起过名号的玩家（包括老玩家）必须先起名
          goScene(!App.State.getProfile().named ? 'name' : (App.State.get().factionId ? 'map' : 'faction'));
        }
        markDirty(400);
      }, waitMs);
    });
  }

  // 首页连接服务器 & 九州资源卷轴加载动画页（告别单调小圆圈，呈现水墨重峦 + 四象星盘大阵！）
  App.Scenes = App.Scenes || {};
  App.Scenes.loading = {
    render(ctx, time) {
      const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
      const t = time || 0;

      // 1. 玄金苍墨天幕渐变
      const skyG = ctx.createLinearGradient(0, 0, 0, H);
      skyG.addColorStop(0, '#120904');
      skyG.addColorStop(0.55, '#241208');
      skyG.addColorStop(1, '#140a05');
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, W, H);

      const mapBg = (App.Assets && App.Assets.get) ? App.Assets.get('bg_map') : null;
      if (mapBg) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(mapBg, 0, 0, W, H);
        ctx.restore();
      }

      ctx.save();
      const glow = ctx.createRadialGradient(W / 2, H / 2 - 22, 16, W / 2, H / 2 - 22, 360);
      glow.addColorStop(0, 'rgba(217, 119, 6, 0.32)');
      glow.addColorStop(0.6, 'rgba(120, 53, 15, 0.12)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // 2. 远黛水墨群山剪影（纯矢量即时绘制，首帧零等待即具古风画卷意境）
      const drawRidge = (baseY, amp, freq, phase, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 24) {
          const y = baseY - Math.sin(x * freq + phase) * amp - Math.cos(x * freq * 2.1 - phase) * (amp * 0.42);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      };
      drawRidge(438, 38, 0.0065, 0.8, 'rgba(46, 24, 12, 0.55)');
      drawRidge(472, 26, 0.0085, 2.3, 'rgba(22, 11, 5, 0.82)');

      // 飘升孔明灯/金辉流萤粒子
      for (let i = 0; i < 20; i++) {
        const px = ((i * 103 + Math.sin(t * 1.1 + i) * 24) % W + W) % W;
        const py = H - (((t * (36 + (i % 4) * 12) + i * 71) % (H + 30)));
        const a = Math.max(0, Math.min(0.7, Math.sin((py / H) * Math.PI) * 0.7));
        ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${a})` : `rgba(245, 158, 11, ${a})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 外层古典双金边框与四角回纹护角
      App.UI.roundRect(ctx, 18, 16, W - 36, H - 32, 14);
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.52)';
      ctx.lineWidth = 2;
      ctx.stroke();
      App.UI.roundRect(ctx, 24, 22, W - 48, H - 44, 10);
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. 顶部恢弘主标题牌
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 42px "STKaiti", "KaiTi", "PingFang SC", serif';
      ctx.fillText('群英志', W / 2, 86);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#d6b88a';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText('——  九 州 烽 火 · 四 象 圣 兽 助 阵  ——', W / 2, 122);

      const err = App.API.getLoginError();
      const notAgreed = App.Compliance && !App.Compliance.hasAgreed();
      if (connecting || (!err && !notAgreed)) {
        // 4. 中央【四象圣兽原画星盘大阵】（青龙·朱雀·白虎·玄武圆形神兽原画环绕流转！）
        const cx = W / 2, cy = 246;
        const orbitR = 80;
        const rot1 = (t * 0.95) % (Math.PI * 2);
        const rot2 = (-t * 1.65) % (Math.PI * 2);

        const drawMiniBeastTotem = (id, col) => {
          ctx.strokeStyle = col;
          ctx.fillStyle = col;
          ctx.lineWidth = 2;
          if (id === 'qinglong') {
            ctx.beginPath();
            ctx.arc(0, 0, 10, -Math.PI * 0.75, Math.PI * 0.75);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(-3, -2, 2, 0, Math.PI * 2); ctx.arc(3, -2, 2, 0, Math.PI * 2); ctx.fill();
          } else if (id === 'zhuque') {
            ctx.beginPath();
            ctx.moveTo(0, -12); ctx.quadraticCurveTo(14, -4, 10, 10); ctx.lineTo(0, 3);
            ctx.lineTo(-10, 10); ctx.quadraticCurveTo(-14, -4, 0, -12);
            ctx.fill();
          } else if (id === 'baihu') {
            ctx.beginPath(); ctx.arc(0, 1, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-5, -4); ctx.lineTo(5, -4);
            ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
            ctx.moveTo(0, -5); ctx.lineTo(0, 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = (Math.PI / 3) * i - Math.PI / 6;
              if (i === 0) ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
              else ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
            }
            ctx.closePath();
            ctx.stroke();
          }
        };

        ctx.save();
        ctx.translate(cx, cy);

        // 外层罗盘暗金底环
        ctx.strokeStyle = 'rgba(212, 163, 75, 0.28)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, orbitR, 0, Math.PI * 2);
        ctx.stroke();

        // 旋转流光金弧 + 四象圣兽圆形原画勋章
        ctx.save();
        ctx.rotate(rot1);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const a0 = k * (Math.PI / 2) + 0.30;
          ctx.beginPath();
          ctx.arc(0, 0, orbitR, a0, a0 + Math.PI * 0.20);
          ctx.stroke();
        }

        const beasts = [
          { id: 'qinglong', col: '#4ade80', bg: '#064e3b', ang: 0 },
          { id: 'zhuque', col: '#f87171', bg: '#7f1d1d', ang: Math.PI / 2 },
          { id: 'baihu', col: '#fde047', bg: '#78350f', ang: Math.PI },
          { id: 'xuanwu', col: '#38bdf8', bg: '#0c4a6e', ang: Math.PI * 1.5 },
        ];
        const medR = 24;
        beasts.forEach((b) => {
          const bx = Math.cos(b.ang) * orbitR;
          const by = Math.sin(b.ang) * orbitR;
          const bImg = App.Assets && App.Assets.get
            ? (App.Assets.get('beast_' + b.id) || App.Assets.get('beast_sprite_' + b.id))
            : null;

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(-rot1); // 神兽头像始终保持正立不倒转！

          // 外圈神兽本命元素柔光晕
          const bGlow = ctx.createRadialGradient(0, 0, medR * 0.5, 0, 0, medR + 7);
          bGlow.addColorStop(0, b.col + '55');
          bGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = bGlow;
          ctx.beginPath();
          ctx.arc(0, 0, medR + 7, 0, Math.PI * 2);
          ctx.fill();

          // 圆形裁切绘制神兽高清原画
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, medR, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = b.bg;
          ctx.fillRect(-medR, -medR, medR * 2, medR * 2);
          if (bImg) {
            ctx.drawImage(bImg, -medR, -medR, medR * 2, medR * 2);
          } else {
            drawMiniBeastTotem(b.id, b.col);
          }
          ctx.restore();

          // 双层鎏金+本命色勋章框
          ctx.strokeStyle = b.col;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(0, 0, medR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, medR - 2.5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        });
        ctx.restore();

        // 内层反向旋转八卦刻度赤金环
        ctx.save();
        ctx.rotate(rot2);
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.78)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 中心呼吸朱印玉玺
        const pulse = 1 + Math.sin(t * 4.8) * 0.045;
        ctx.save();
        ctx.scale(pulse, pulse);
        const coreG = ctx.createRadialGradient(0, -5, 3, 0, 0, 34);
        coreG.addColorStop(0, '#b45309');
        coreG.addColorStop(1, '#451a03');
        ctx.fillStyle = coreG;
        ctx.beginPath();
        ctx.arc(0, 0, 33, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 17px "STKaiti", "KaiTi", "PingFang SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('九州', 0, 1);
        ctx.restore();

        ctx.restore();

        // 5. 底部流金卷轴进度条与实时阶段文案
        const rawProg = App.Assets && App.Assets.getProgress ? App.Assets.getProgress() : 0.5;
        const animFloor = Math.min(0.88, 0.18 + (1 - Math.exp(-t * 1.4)) * 0.52);
        const showProg = Math.max(animFloor, Math.min(1, rawProg));
        const pct = Math.round(showProg * 100);
        const stepMsg = showProg < 0.55
          ? '正在叩关验符，同步主公云端军机档'
          : '正在绘染九州城池与百将神兵图志';
        const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));

        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
        ctx.fillText(`${stepMsg}${dots}  ${pct}%`, W / 2, 378);

        const barW = 420, barH = 13;
        const barX = (W - barW) / 2, barY = 395;
        App.UI.roundRect(ctx, barX, barY, barW, barH, 6.5);
        ctx.fillStyle = 'rgba(38, 19, 9, 0.92)';
        ctx.fill();
        ctx.strokeStyle = '#b48238';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const fillW = Math.max(14, (barW - 4) * showProg);
        App.UI.roundRect(ctx, barX + 2, barY + 2, fillW, barH - 4, 5);
        const pGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
        pGrad.addColorStop(0, '#d97706');
        pGrad.addColorStop(0.65, '#f59e0b');
        pGrad.addColorStop(1, '#fef08a');
        ctx.fillStyle = pGrad;
        ctx.fill();
      } else if (notAgreed) {
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 15px "PingFang SC", sans-serif';
        ctx.fillText('请先阅读并同意《用户服务协议》与《隐私保护指引》后进入九州', W / 2, H / 2 - 22);
      } else {
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 15px "PingFang SC", sans-serif';
        ctx.fillText(err, W / 2, H / 2 - 18);
      }
      ctx.restore();

      // 底部完整 48 字《健康游戏忠告》+ 协议快捷查阅链接
      if (App.Compliance && App.Compliance.drawHealthAdvice) {
        App.Compliance.drawHealthAdvice(ctx, W / 2, 444, { boxW: 590, showLinks: true });
      }

      if (notAgreed && App.Compliance && !App.Compliance.isOpen()) {
        App.UI.drawButton(ctx, W / 2 - 116, H / 2 + 8, 232, 44, '阅读协议并进入游戏', {
          r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 15,
        }, () => App.Compliance.openGate());
        if (App.Platform.isWechat) {
          App.UI.drawButton(ctx, W / 2 - 68, H / 2 + 60, 136, 32, '退出小游戏', {
            r: 8, bg: '#57534e', border: '#cbd5e1', fontSize: 12,
          }, () => App.Platform.exitMiniProgram());
        }
      } else if (!connecting && err && !notAgreed) {
        App.UI.drawButton(ctx, W / 2 - 84, H / 2 + 12, 168, 44, '重新连接九州', {
          r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 15,
        }, connect);
      }
    },
  };

  // ★ 国风点兵出征过场加载动画页（点击【击鼓应战】零延迟切入，动态展示对阵将领、八卦战鼓流光环与行军进度）
  App.Scenes.battleLoading = {
    update(dt) {
      if (!battleTransit) return;
      const elapsedMs = Date.now() - battleTransit.startedAt;
      let readyCount = 0;
      const keys = battleTransit.preview.preloadKeys || [];
      if (App.Assets && keys.length > 0) {
        for (let i = 0; i < keys.length; i++) {
          const loading = App.Assets.isLoading ? App.Assets.isLoading(keys[i]) : false;
          if (!loading) readyCount++;
        }
      }
      const assetRatio = keys.length > 0 ? readyCount / keys.length : 1;
      const timeRatio = Math.min(1, elapsedMs / 480);
      const targetProg = battleTransit.apiDone
        ? Math.min(1, 0.45 + assetRatio * 0.30 + timeRatio * 0.25)
        : Math.min(0.86, 0.14 + assetRatio * 0.38 + (1 - Math.exp(-elapsedMs / 650)) * 0.34);

      battleTransit.progress += (targetProg - battleTransit.progress) * Math.min(1, dt * 11);

      const assetsReady = assetRatio >= 0.88 || elapsedMs >= 780;
      if (battleTransit.apiDone && battleTransit.apiRes && battleTransit.apiRes.ok && elapsedMs >= 460 && assetsReady && !battleTransit.finishing) {
        battleTransit.finishing = true;
        battleTransit.progress = 1;
        const doneTransit = battleTransit;
        battleTransit = null;
        goScene('battle', Object.assign({ mode: doneTransit.mode, serverBattle: doneTransit.apiRes.battle }, doneTransit.params));
        if (doneTransit.resolve) doneTransit.resolve(doneTransit.apiRes);
      }
    },

    render(ctx, time) {
      const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
      const tr = battleTransit;
      const pv = tr ? tr.preview : { title: '大军开拔', subTitle: '正在进入战场', leadName: '我军主将', enemyName: '敌军守将', tip: BATTLE_TIPS[0] };
      const prog = tr ? Math.max(0.06, Math.min(1, tr.progress)) : 0.9;

      // 1. 九州古卷暗金玄墨底图 + 烽火流萤粒子
      ctx.fillStyle = '#140a05';
      ctx.fillRect(0, 0, W, H);
      const mapBg = (App.Assets && App.Assets.get) ? App.Assets.get('bg_map') : null;
      if (mapBg) {
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.drawImage(mapBg, 0, 0, W, H);
        ctx.restore();
      }

      ctx.save();
      const radG = ctx.createRadialGradient(W / 2, H / 2 - 16, 24, W / 2, H / 2 - 16, 460);
      radG.addColorStop(0, 'rgba(180, 83, 9, 0.30)');
      radG.addColorStop(0.55, 'rgba(42, 18, 8, 0.72)');
      radG.addColorStop(1, 'rgba(12, 6, 3, 0.95)');
      ctx.fillStyle = radG;
      ctx.fillRect(0, 0, W, H);

      // 飘升战火金星粒子
      for (let i = 0; i < 22; i++) {
        const px = ((i * 97 + Math.sin(time * 1.4 + i) * 28) % W + W) % W;
        const py = H - (((time * (48 + (i % 5) * 14) + i * 67) % (H + 40)));
        const alpha = Math.max(0, Math.min(0.75, Math.sin((py / H) * Math.PI) * 0.75));
        ctx.fillStyle = i % 3 === 0 ? `rgba(254, 240, 138, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.4 + (i % 3) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // 外围古典双金框
      App.UI.roundRect(ctx, 18, 16, W - 36, H - 32, 14);
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      App.UI.roundRect(ctx, 24, 22, W - 48, H - 44, 10);
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. 顶部出征关卡牌匾
      const pw = 396, ph = 48;
      const px = (W - pw) / 2, py = 46;
      const headG = ctx.createLinearGradient(px, py, px, py + ph);
      headG.addColorStop(0, '#5c2210');
      headG.addColorStop(1, '#2b0e06');
      App.UI.roundRect(ctx, px, py, pw, ph, 24);
      ctx.fillStyle = headG;
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 20px "PingFang SC", "STKaiti", serif';
      ctx.fillText(`⚔ ${pv.title} ⚔`, W / 2, py + ph / 2 + 1, pw - 32);

      ctx.fillStyle = '#e7cfa8';
      ctx.font = '12.5px "PingFang SC", sans-serif';
      ctx.fillText(pv.subTitle, W / 2, py + ph + 22);

      // 3. 中央对阵双将勋章 + 八卦战鼓双环流光动画
      const centerY = 252;
      const leftX = W / 2 - 196;
      const rightX = W / 2 + 196;

      // 战意对冲光束线
      const beamG = ctx.createLinearGradient(leftX + 54, centerY, rightX - 54, centerY);
      beamG.addColorStop(0, 'rgba(74, 222, 128, 0.55)');
      beamG.addColorStop(0.5, 'rgba(250, 204, 21, 0.85)');
      beamG.addColorStop(1, 'rgba(248, 113, 113, 0.55)');
      ctx.strokeStyle = beamG;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(leftX + 58, centerY);
      ctx.lineTo(W / 2 - 66, centerY);
      ctx.moveTo(W / 2 + 66, centerY);
      ctx.lineTo(rightX - 58, centerY);
      ctx.stroke();

      // 左侧：我军主将框
      App.UI.drawPanel(ctx, leftX - 56, centerY - 62, 112, 134, {
        r: 12, bg: 'rgba(20, 42, 26, 0.86)', border: '#4ade80', lineWidth: 2.2,
      });
      if (pv.leadGenId && App.Portraits && App.Portraits.drawGeneralPortrait) {
        App.Portraits.drawGeneralPortrait(ctx, pv.leadGenId, leftX - 44, centerY - 50, 88, { radius: 10, lineWidth: 2 });
      }
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`我军 · ${pv.leadName}`, leftX, centerY + 54, 102);

      // 右侧：敌军守将 / 四象圣兽框
      App.UI.drawPanel(ctx, rightX - 56, centerY - 62, 112, 134, {
        r: 12, bg: 'rgba(54, 18, 16, 0.88)', border: '#f87171', lineWidth: 2.2,
      });
      if (pv.enemyKind === 'beast' && pv.enemyId && App.Portraits && App.Portraits.drawBeastPortrait) {
        App.Portraits.drawBeastPortrait(ctx, pv.enemyId, rightX - 44, centerY - 50, 88, { radius: 10, lineWidth: 2 });
      } else if (pv.enemyId && App.Portraits && App.Portraits.drawGeneralPortrait) {
        App.Portraits.drawGeneralPortrait(ctx, pv.enemyId, rightX - 44, centerY - 50, 88, { radius: 10, lineWidth: 2 });
      } else {
        App.UI.drawSpinner(ctx, rightX, centerY - 6, 18, '#fca5a5');
      }
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`${pv.enemyKind === 'beast' ? '圣兽' : '守将'} · ${pv.enemyName}`, rightX, centerY + 54, 102);

      // 正中：双层反向旋转八卦战鼓阵 + 脉冲「战」字金印
      const pulse = 1 + Math.sin(time * 6.5) * 0.05;
      ctx.save();
      ctx.translate(W / 2, centerY);

      // 外圈鎏金刻度流光环
      ctx.save();
      ctx.rotate(time * 2.1);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.30)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 0.78);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 56, Math.PI, Math.PI * 1.78);
      ctx.stroke();
      ctx.restore();

      // 内圈反向赤金战环
      ctx.save();
      ctx.rotate(-time * 3.0);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0.3, 0.3 + Math.PI * 0.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 44, Math.PI + 0.3, Math.PI + 0.3 + Math.PI * 0.65);
      ctx.stroke();
      ctx.restore();

      // 中心朱红战鼓印章
      ctx.scale(pulse, pulse);
      const sealG = ctx.createRadialGradient(0, -6, 4, 0, 0, 35);
      sealG.addColorStop(0, '#dc2626');
      sealG.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = sealG;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 28px "STKaiti", "KaiTi", "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('战', 0, 2);
      ctx.restore();

      // 4. 底部流金行军加载进度条 + 锦囊妙计提示
      const barW = 500, barH = 14;
      const barX = (W - barW) / 2, barY = 398;
      const pct = Math.round(prog * 100);
      const stageTxt = prog < 0.45
        ? '正在击鼓点兵，校阅三军鞍马衣甲'
        : (prog < 0.88 ? '正在押运粮草，推演关隘攻防阵图' : '三军集结完毕，擂鼓进军');
      const dots = '.'.repeat(1 + (Math.floor(time * 3.5) % 3));

      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      ctx.fillText(`${stageTxt}${dots}  ${pct}%`, W / 2, barY - 16);

      App.UI.roundRect(ctx, barX, barY, barW, barH, 7);
      ctx.fillStyle = 'rgba(38, 19, 9, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#b48238';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const fillW = Math.max(14, (barW - 4) * prog);
      ctx.save();
      App.UI.roundRect(ctx, barX + 2, barY + 2, fillW, barH - 4, 5);
      const pGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      pGrad.addColorStop(0, '#d97706');
      pGrad.addColorStop(0.65, '#f59e0b');
      pGrad.addColorStop(1, '#fef08a');
      ctx.fillStyle = pGrad;
      ctx.fill();

      // 进度条前锋亮斑
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(barX + 2 + fillW - 4, barY + barH / 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 底部军师锦囊
      ctx.fillStyle = '#b8a287';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(pv.tip, W / 2, barY + 42, W - 100);
      ctx.restore();
    },
  };

  function start() {
    App.Platform.initCanvas();
    if (App.Assets && App.Assets.primeBootVisuals) App.Assets.primeBootVisuals();
    // 存档在服务端：确认隐私保护指引授权后再发起微信登录与服务器同步
    currentScene = 'loading';
    if (App.Compliance && App.Compliance.init) {
      App.Compliance.init(() => connect());
    } else {
      connect();
    }

    let lastX = 0;
    let lastY = 0;
    let movedDist = 0;
    let pointerDown = false;

    App.Platform.bindPointerEvents({
      onDown: (x, y) => {
        lastX = x;
        lastY = y;
        movedDist = 0;
        pointerDown = true;
        markDirty(400);
      },
      onMove: (x, y) => {
        markDirty(300);
        if (App.Platform.adOverlay.active) return;
        const dx = x - lastX;
        const dy = y - lastY;
        lastX = x;
        lastY = y;
        movedDist += Math.hypot(dx, dy);
        if (movedDist > 6 && App.Compliance && App.Compliance.isOpen()) {
          App.Compliance.onDrag(dx, dy);
        } else if (movedDist > 6 && y < 380) {
          const sc = App.Scenes[currentScene];
          if (sc && sc.onDrag) sc.onDrag(dx, dy);
        }
      },
      onUp: (x, y) => {
        pointerDown = false;
        markDirty(450);
        if (App.Audio) App.Audio.unlock();
        if (App.Platform.adOverlay.active) return;
        if (movedDist < 10) {
          const sc = App.Scenes[currentScene];
          // 优先响应战场手动选点释放将领大招！（合规/全局弹窗打开时不穿透至战场）
          if (!(App.Compliance && App.Compliance.isOpen()) && sc && sc.onBattleClick && sc.onBattleClick(x, y)) return;
          App.UI.dispatchClick(x, y);
        }
      },
    });

    function needsFullFps(now) {
      if (pointerDown || now < dirtyUntil) return true;
      if (currentScene === 'battle' || currentScene === 'battleLoading' || currentScene === 'loading') return true;
      if (App.Platform.adOverlay.active || (App.Platform.inputOverlay && App.Platform.inputOverlay.active)) return true;
      if (App.UI.hasActiveOverlay && App.UI.hasActiveOverlay()) return true;
      if (currentScene === 'wheel' && App.Scenes.wheel && App.Scenes.wheel.isSpinning && App.Scenes.wheel.isSpinning()) return true;
      if (currentScene === 'roster' && App.Scenes.roster && App.Scenes.roster.hasActiveVfx && App.Scenes.roster.hasActiveVfx()) return true;
      return false;
    }

    lastTime = Date.now();
    const loop = () => {
      try {
        if (App.Platform.isHidden && App.Platform.isHidden()) {
          lastTime = Date.now();
          setTimeout(loop, 250);
          return;
        }
        const now = Date.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        elapsed += dt;

        App.Platform.updateAdOverlay(dt);
        App.UI.updateToasts(dt);
        if (App.Audio) App.Audio.update();

        const sc = App.Scenes[currentScene];
        if (sc && sc.update) sc.update(dt);

        const fullFps = needsFullFps(now);
        const minRenderGap = fullFps ? 0 : (AMBIENT_SCENES[currentScene] ? 48 : 240);
        if (now - lastRenderAt >= minRenderGap) {
          lastRenderAt = now;
          const ctx = App.Platform.getCtx();
          App.Platform.beginFrame();
          try {
            App.UI.clearHits();
            if (sc && sc.render) sc.render(ctx, elapsed);
            if (App.UI.drawExchangeModal) App.UI.drawExchangeModal(ctx);
            if (App.Compliance && App.Compliance.renderOverlay) App.Compliance.renderOverlay(ctx);
            if (currentScene !== 'battleLoading' && App.UI.drawLoadingOverlay) App.UI.drawLoadingOverlay(ctx);
            App.UI.drawToasts(ctx);
            App.UI.drawAdOverlay(ctx);
            if (App.UI.drawInputOverlay) App.UI.drawInputOverlay(ctx);
          } finally {
            App.Platform.endFrame();
          }
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) console.error('[MainLoop]', err);
        // 若过场页遇到任何极端异常，自动兜底切入战场或退回原场景，绝不卡死黑屏
        if (currentScene === 'battleLoading' && battleTransit) {
          const fallback = battleTransit;
          battleTransit = null;
          if (fallback.apiDone && fallback.apiRes && fallback.apiRes.ok) {
            goScene('battle', Object.assign({ mode: fallback.mode, serverBattle: fallback.apiRes.battle }, fallback.params));
          } else {
            currentScene = fallback.prevScene || 'map';
          }
        }
      }
      App.Platform.requestFrame(loop);
    };
    App.Platform.requestFrame(loop);
  }

  App.Main = { start, goScene, startBattle, markDirty, getScene: () => currentScene };
})(typeof globalThis !== 'undefined' ? globalThis : window);
