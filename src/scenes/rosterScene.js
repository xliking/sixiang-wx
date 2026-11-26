(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let selectedGid = null;
  let selectedEqUid = null;
  let confirmExileGid = null;
  let showAscendModal = false;
  let showDetailModal = false;
  let showAll800 = true;
  let rosterFaction = 'all';
  let rosterKeyword = '';
  let listPage = 0;
  let bagPage = 0;
  let previewFx = null;
  let previewCooldown = 0;
  let previewTime = 0;
  let cachedRosterKey = '';
  let cachedSorted = [];
  let cachedBagRev = -1;
  let cachedUnequipped = [];

  function enter(params) {
    previewFx = null;
    confirmExileGid = null;
    showAscendModal = false;
    showDetailModal = false;
    const p = params || {};
    const st = App.State.get();
    if (p.gid && App.Config.GENERALS[p.gid]) {
      selectedGid = p.gid;
    } else if (p.openAscend) {
      const ownedKeys = Object.keys(st.ownedGenerals || {}).filter((k) => App.Config.GENERALS[k]);
      if (ownedKeys.length) {
        ownedKeys.sort((a, b) => (st.ownedGenerals[b].lv || 1) - (st.ownedGenerals[a].lv || 1));
        selectedGid = ownedKeys[0];
      }
    }
    if (p.openAscend && selectedGid && st.ownedGenerals && st.ownedGenerals[selectedGid]) {
      showAscendModal = true;
    }
  }

  function resolvePreviewSpriteInfo(g, eqWeapon) {
    if (App.Config && App.Config.resolveGeneralCombatProfile) {
      return App.Config.resolveGeneralCombatProfile(g, eqWeapon);
    }
    if (!g) return { spriteKey: 'unit_gen_silver', atkStyle: 'thrust', weaponKind: 'spear', isMagic: false };
    if (g.gender === 'female') return { spriteKey: 'unit_gen_female', atkStyle: 'bow', weaponKind: 'bow', isMagic: false };
    if (g.troopId === 'mage') return { spriteKey: 'unit_gen_mage', atkStyle: 'fan', weaponKind: 'fan', isMagic: true };
    return { spriteKey: 'unit_gen_silver', atkStyle: 'thrust', weaponKind: 'spear', isMagic: false };
  }

  function launchSkillPreview(gid) {
    const g = App.Config.GENERALS[gid];
    if (!g) return;
    const isFull = !!(g.isFullscreenSkill || (g.vfxSpec && g.vfxSpec.isFullscreen));
    const isPureSupport = g.skillPower === 0;
    const dur = gid === 'lvbu' ? 2.35 : ((g.skillRole === 'gradual_hot' || g.skillRole === 'poison_dot') ? 2.25 : (isFull ? 2.05 : 1.85));
    if (App.Audio) App.Audio.playSfx('ultimate');
    previewFx = {
      mode: 'skill',
      generalId: gid,
      casterName: g.name,
      x: isPureSupport ? 345 : (isFull ? 500 : 575),
      y: 326,
      casterX: 292,
      casterY: 326,
      facing: 1,
      skillRole: g.skillRole || '',
      skillName: g.skillName,
      isFullscreen: isFull,
      element: g.skillElement || 'thunder',
      vfxSpec: g.vfxSpec || null,
      suppressCalligraphy: true,
      life: dur,
      maxLife: dur,
    };
    previewCooldown = 0.65;
  }

  function launchWeaponPreview(gid) {
    const g = App.Config.GENERALS[gid];
    if (!g) return;
    if (App.Audio) App.Audio.playSfx('sword_hit');
    previewFx = {
      mode: 'weapon',
      generalId: gid,
      casterName: g.name,
      x: 562,
      y: 326,
      casterX: 332,
      casterY: 326,
      facing: 1,
      skillName: g.skillName,
      life: 2.25,
      maxLife: 2.25,
    };
    previewCooldown = 0.45;
  }

  function update(dt) {
    if (!previewFx) return;
    previewTime += dt;
    if (previewFx.life > 0) {
      previewFx.life = Math.max(0, previewFx.life - dt);
    } else {
      previewCooldown -= dt;
      if (previewCooldown <= 0 && selectedGid) {
        if (previewFx.mode === 'weapon') launchWeaponPreview(selectedGid);
        else launchSkillPreview(selectedGid);
      }
    }
  }

  function render(ctx, time) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    const coreIds = App.Config.CORE_GENERAL_IDS || App.Config.GENERAL_IDS;
    const fullIds = App.Config.ALL_GENERAL_IDS || Object.keys(App.Config.GENERALS);
    const curRev = App.State.getRevision ? App.State.getRevision() : 0;
    const hostedMap = st.hostedGenerals || {};
    const deployableIds = App.State.getDeployableGeneralIds ? App.State.getDeployableGeneralIds() : Object.keys(st.ownedGenerals || {});
    const rosterKey = `${curRev}|${showAll800 ? 1 : 0}|${rosterFaction}|${rosterKeyword}|${fullIds.length}`;
    if (rosterKey !== cachedRosterKey) {
      cachedRosterKey = rosterKey;
      const coreSet = new Set(coreIds);
      const deploySet = new Set(st.deployIds || []);
      const usableSet = new Set(deployableIds);
      const rawPool = showAll800
        ? fullIds
        : Array.from(new Set([...deployableIds, ...Object.keys(hostedMap), ...coreIds])).filter((id) => App.Config.GENERALS[id]);
      const kw = rosterKeyword.toLowerCase();
      const basePool = rawPool.filter((id) => {
        const gg = App.Config.GENERALS[id];
        if (!gg) return false;
        if (rosterFaction !== 'all' && gg.faction !== rosterFaction) return false;
        if (kw && String(gg.name || '').toLowerCase().indexOf(kw) < 0 && String(gg.title || '').toLowerCase().indexOf(kw) < 0 && String(gg.skillName || '').toLowerCase().indexOf(kw) < 0) {
          return false;
        }
        return true;
      });
      cachedSorted = [...basePool].sort((a, b) => {
        // ★ 已编入出战阵容的将领始终排在最上方，其次已拥有/已租用佣将，再其次佣馆托管将领！
        const da = deploySet.has(a) ? 1 : 0;
        const db = deploySet.has(b) ? 1 : 0;
        if (da !== db) return db - da;
        const ua = usableSet.has(a) ? 1 : 0;
        const ub = usableSet.has(b) ? 1 : 0;
        if (ua !== ub) return ub - ua;
        if (ua === 1) return App.State.getGeneralPower(b) - App.State.getGeneralPower(a);
        const ha = hostedMap[a] ? 1 : 0;
        const hb = hostedMap[b] ? 1 : 0;
        if (ha !== hb) return hb - ha;
        const ca = coreSet.has(a) ? 1 : 0;
        const cb = coreSet.has(b) ? 1 : 0;
        if (ca !== cb) return cb - ca;
        return (App.Config.GENERALS[a].stageOrder || 999) - (App.Config.GENERALS[b].stageOrder || 999);
      });
    }
    const sorted = cachedSorted;
    if ((!selectedGid || !App.Config.GENERALS[selectedGid]) && sorted.length) selectedGid = sorted[0];
    else if (sorted.length && sorted.indexOf(selectedGid) < 0) selectedGid = sorted[0];
    if (!selectedGid || !App.Config.GENERALS[selectedGid]) selectedGid = coreIds[0] || fullIds[0];

    // 左侧：名将分页列表（全量收录 800 位独立立绘名将与守将！支持阵营筛选 + 搜将）
    App.UI.drawPanel(ctx, 14, 58, 220, 474, { r: 12, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    const totalOwnedCnt = Object.keys(st.ownedGenerals || {}).length + Object.keys(hostedMap).length;
    ctx.fillText(`聚义 ${totalOwnedCnt}/${fullIds.length}将 · 阵${st.deployIds.length}/5`, 22, 79);
    ctx.restore();
    App.UI.drawButton(ctx, 174, 64, 52, 20, showAll800 ? '全图鉴' : '仅核心', {
      r: 5, bg: showAll800 ? '#15803d' : '#78350f', border: '#fef08a', fontSize: 9.5,
    }, () => { showAll800 = !showAll800; listPage = 0; });

    // 阵营快筛胶囊 + 搜将按钮
    [
      { id: 'all', t: '全' },
      { id: 'wei', t: '魏' },
      { id: 'shu', t: '蜀' },
      { id: 'wu', t: '吴' },
      { id: 'qun', t: '群' },
    ].forEach((fc, fi) => {
      const on = rosterFaction === fc.id;
      App.UI.drawButton(ctx, 20 + fi * 30, 88, 28, 19, fc.t, {
        r: 5,
        bg: on ? '#9a3412' : '#d6be8f',
        border: on ? '#fde047' : '#854d0e',
        color: on ? '#fef08a' : '#451a03',
        fontSize: 9.5,
      }, () => { rosterFaction = fc.id; listPage = 0; });
    });
    App.UI.drawButton(ctx, 172, 88, 54, 19, rosterKeyword ? '✕清除' : '搜名将', {
      r: 5,
      bg: rosterKeyword ? '#dc2626' : '#0369a1',
      border: '#fef08a',
      fontSize: 9.5,
    }, () => {
      if (rosterKeyword) {
        rosterKeyword = '';
        listPage = 0;
        return;
      }
      App.Platform.promptText('输入名将姓名、称号或绝技名关键字：', (txt) => {
        rosterKeyword = String(txt || '').trim().slice(0, 10);
        listPage = 0;
      }, { maxLength: 10, defaultValue: '' });
    });

    const perPage = 8;
    const maxPage = Math.max(0, Math.ceil(sorted.length / perPage) - 1);
    listPage = Math.min(listPage, maxPage);
    const slice = sorted.slice(listPage * perPage, listPage * perPage + perPage);

    if (!slice.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText('未找到匹配名将', 124, 268);
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText('点击右上【✕清除】或切换阵营', 124, 290);
      ctx.restore();
    }

    slice.forEach((gid, idx) => {
      const g = App.Config.GENERALS[gid];
      const owned = st.ownedGenerals[gid];
      const rented = !owned && App.State.getActiveRented ? App.State.getActiveRented(gid) : null;
      const hosted = !owned && !rented ? hostedMap[gid] : null;
      const effNode = owned || rented || hosted;
      const ascTag = effNode && effNode.ascend === 'xian' ? '[神]' : (effNode && effNode.ascend === 'mo' ? '[魔]' : '');
      const deployed = st.deployIds.includes(gid);
      const isSel = gid === selectedGid;
      const y = 113 + idx * 45;

      App.UI.drawButton(ctx, 22, y, 204, 36, '', {
        r: 16,
        bg: isSel ? '#9a3412' : (deployed ? '#854d0e' : (rented ? '#0f766e' : (owned ? '#c27c44' : (hosted ? '#78350f' : '#a8a29e')))),
        border: isSel ? '#fde047' : (deployed ? '#4ade80' : (rented ? '#5eead4' : '#5c2c16')),
        lineWidth: isSel ? 2.2 : (deployed ? 1.8 : 1.2),
      }, () => {
        selectedGid = gid;
        selectedEqUid = null;
        confirmExileGid = null;
      });

      const tMeta = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(gid) : { short: '兵', name: '步兵', color: '#fde047', bg: '#78350f' };
      ctx.save();
      const facCol = g.faction === 'wei' ? '#2563eb' : (g.faction === 'shu' ? '#16a34a' : (g.faction === 'wu' ? '#dc2626' : '#7e22ce'));
      const facTxt = g.faction === 'wei' ? '魏' : (g.faction === 'shu' ? '蜀' : (g.faction === 'wu' ? '吴' : '群'));
      ctx.fillStyle = facCol;
      ctx.beginPath(); ctx.arc(38, y + 18, 11.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "PingFang SC", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(facTxt, 38, y + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#fef08a' : '#fffbeb';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      const leftLabel = owned
        ? `Lv.${owned.lv} ${ascTag}${g.name}`
        : (rented ? `[佣]Lv.${rented.lv} ${ascTag}${g.name}` : (hosted ? `[托管]Lv.${hosted.lv} ${g.name}` : `未降·${g.name}`));
      ctx.fillText(leftLabel, 54, y + 18, 98);

      ctx.textAlign = 'right';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      if (owned || rented) {
        ctx.fillStyle = deployed ? '#86efac' : (rented ? '#99f6e4' : '#e2e8f0');
        ctx.fillText(`${deployed ? '★出战·' : ''}${tMeta.short} ${App.State.getGeneralPower(gid)}`, 218, y + 18);
      } else if (hosted) {
        ctx.fillStyle = '#fde68a';
        ctx.fillText('佣馆出租中', 218, y + 18);
      } else {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(`${tMeta.short}·${g.rarity}`, 218, y + 18);
      }
      ctx.restore();
    });

    App.UI.drawButton(ctx, 20, 488, 56, 30, '◀ 上页', {
      r: 7, bg: '#5c2c16', border: '#d4a34b', fontSize: 10.5, disabled: listPage <= 0,
    }, () => { listPage = Math.max(0, listPage - 1); });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`${listPage + 1} / ${maxPage + 1}`, 124, 503);
    ctx.restore();
    App.UI.drawButton(ctx, 172, 488, 56, 30, '下页 ▶', {
      r: 7, bg: '#5c2c16', border: '#d4a34b', fontSize: 10.5, disabled: listPage >= maxPage,
    }, () => { listPage = Math.min(maxPage, listPage + 1); });

    // 右侧：英雄详情 + 单人英雄战力 + 【仙魔飞升 / 挂牌出租 / 流放武将】 + 6格穿戴装备
    const g = App.Config.GENERALS[selectedGid];
    const owned = st.ownedGenerals[selectedGid];
    const rented = !owned && App.State.getActiveRented ? App.State.getActiveRented(selectedGid) : null;
    const hosted = !owned && !rented ? hostedMap[selectedGid] : null;
    const stats = hosted && !owned && !rented
      ? App.State.getGeneralStats(selectedGid, hosted.lv || 1)
      : App.State.getGeneralStats(selectedGid);
    const hostedAscInfo = hosted && App.Config.getAscendInfo ? App.Config.getAscendInfo(hosted) : null;
    const effAscInfo = (stats && stats.ascendInfo) || hostedAscInfo;
    const eqMap = App.State.getEquippedMap(selectedGid);

    const selTroopMeta = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(selectedGid) : { name: App.Config.UNIT_TYPES[g.type].name, color: '#fde047', bg: '#78350f' };
    const eqListWorn = Object.values(eqMap);
    const equipSetVfx = App.Config.resolveSetVfx ? App.Config.resolveSetVfx(eqListWorn) : null;
    const activeSetVfx = equipSetVfx || (effAscInfo ? effAscInfo.auraVfx : null);
    const activeWeaponVfx = App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(eqMap.weapon) : null;

    App.UI.drawPanel(ctx, 242, 58, W - 256, 474, { r: 12, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    if (activeSetVfx && App.Sprites.drawUiSetAura) {
      App.Sprites.drawUiSetAura(ctx, 300, 120, 52, activeSetVfx, time);
    }
    App.Portraits.drawGeneralPortrait(ctx, selectedGid, 254, 74, 92, {
      radius: 10,
      lineWidth: activeSetVfx && activeSetVfx.vfxTier >= 2 ? 2.8 : 2.2,
      border: activeSetVfx ? activeSetVfx.auraColor : undefined,
      ascend: effAscInfo ? effAscInfo.path : undefined,
    });

    ctx.save();
    App.UI.roundRect(ctx, 258, 147, 84, 17, 5);
    ctx.fillStyle = 'rgba(20, 10, 5, 0.86)';
    ctx.fill();
    ctx.strokeStyle = selTroopMeta.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = selTroopMeta.color;
    ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`统兵·${selTroopMeta.name}`, 300, 159);

    const selRarLabel = App.Config.getRarityLabel
      ? App.Config.getRarityLabel(selectedGid, owned || rented || hosted)
      : g.rarity;
    ctx.fillStyle = effAscInfo ? (effAscInfo.path === 'xian' ? '#0c4a6e' : '#581c87') : '#451a03';
    ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${selRarLabel}] ${g.name}`, 300, 180, 98);
    ctx.fillStyle = effAscInfo ? (effAscInfo.path === 'xian' ? '#0369a1' : '#9333ea') : '#b91c1c';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(effAscInfo ? `✦${effAscInfo.title}·战${stats.power}` : `英雄战力 ${stats.power}`, 300, 196, 98);
    ctx.restore();

    const lordCapLv = App.State.getGeneralMaxLv ? App.State.getGeneralMaxLv() : 12;
    const absMaxLv = (App.Config.PARAMS && App.Config.PARAMS.generalMaxLevel) || 150;
    const ascReqLv = (App.Config.ASCENSION && App.Config.ASCENSION.reqLevel) || absMaxLv;
    if (owned) {
      const deployed = st.deployIds.includes(selectedGid);
      App.UI.drawButton(ctx, 254, 203, 92, 23, deployed ? '撤下阵位' : '编入出战', {
        r: 6, grad: deployed ? ['#57534e', '#44403c'] : ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 10.5,
      }, () => {
        App.State.toggleDeploy(selectedGid);
      });

      const atAbsMax = owned.lv >= absMaxLv;
      const atLordCap = owned.lv >= lordCapLv;
      const gCost = App.State.getCost('generalUp', owned.lv);
      App.UI.drawButton(ctx, 254, 229, 92, 23, atAbsMax ? `已满${absMaxLv}级` : (atLordCap ? `上限Lv.${lordCapLv}` : `升级(${gCost})`), {
        r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10, disabled: atLordCap,
      }, () => {
        App.State.upgradeGeneral(selectedGid, 1);
      });

      App.UI.drawButton(ctx, 254, 255, 92, 23, atAbsMax ? '满级可封神' : (atLordCap ? '升主公破限' : '⚡ 连升 10 级'), {
        r: 6, grad: ['#ea580c', '#9a3412'], border: '#fef08a', fontSize: 10, disabled: atLordCap,
      }, () => {
        App.State.upgradeGeneral(selectedGid, 10);
      });

      const sCost = App.State.getCost('generalStar', owned.star);
      App.UI.drawButton(ctx, 254, 281, 92, 23, owned.star >= 5 ? '已满星(5★)' : `升星(${sCost}魂)`, {
        r: 6, grad: ['#7e22ce', '#581c87'], border: '#e9d5ff', fontSize: 10, disabled: owned.star >= 5,
      }, () => {
        App.State.starUpGeneral(selectedGid);
      });

      // ★ 150级【神魔飞升】按钮（未满150级也可点击查看渡劫条件与直达成神/成魔副本！）
      const ascBtnLabel = owned.ascend === 'xian'
        ? `✦ 神·${owned.ascendTier || 1}重突破`
        : (owned.ascend === 'mo' ? `🔥 魔·${owned.ascendTier || 1}重突破` : '✦ 神魔飞升');
      const ascGrad = owned.ascend === 'xian'
        ? ['#0284c7', '#0c4a6e']
        : (owned.ascend === 'mo' ? ['#a21caf', '#581c87'] : (owned.lv >= ascReqLv ? ['#0891b2', '#6d28d9'] : ['#475569', '#334155']));
      App.UI.drawButton(ctx, 254, 307, 92, 24, ascBtnLabel, {
        r: 6, grad: ascGrad, border: owned.lv >= ascReqLv ? '#67e8f9' : '#cbd5e1', fontSize: 10,
      }, () => {
        showAscendModal = true;
      });

      // ★ 【挂牌出租】快捷跳转聚贤佣馆
      App.UI.drawButton(ctx, 254, 334, 92, 23, '挂牌出租', {
        r: 6, grad: ['#0f766e', '#115e59'], border: '#99f6e4', fontSize: 10,
      }, () => {
        App.Main.goScene('hire', { publishGid: selectedGid });
      });

      // ★ 【流放武将】按钮（点击一次确认，再点流放返还将魂与铜钱，装备自动归库！）
      const isConfirm = confirmExileGid === selectedGid;
      App.UI.drawButton(ctx, 254, 360, 92, 23, isConfirm ? '确认流放?' : '流放武将', {
        r: 6, grad: isConfirm ? ['#dc2626', '#7f1d1d'] : ['#78350f', '#451a03'],
        border: isConfirm ? '#fef08a' : '#fca5a5',
        fontSize: 10,
      }, () => {
        if (!isConfirm) {
          confirmExileGid = selectedGid;
          App.UI.showToast(`再次点击【确认流放】将舍弃 ${g.name} 并返还大量铜钱将魂！`, '#fbbf24');
          return;
        }
        confirmExileGid = null;
        App.State.exileGeneral(selectedGid).then((res) => { if (res.ok) selectedGid = Object.keys(st.ownedGenerals)[0]; });
      });
    } else if (rented) {
      const deployed = st.deployIds.includes(selectedGid);
      App.UI.drawButton(ctx, 254, 206, 92, 26, deployed ? '撤下阵位' : '编入出战', {
        r: 7, grad: deployed ? ['#57534e', '#44403c'] : ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 11,
      }, () => App.State.toggleDeploy(selectedGid));
      App.UI.drawButton(ctx, 254, 238, 92, 26, '去佣馆续租', {
        r: 7, grad: ['#0f766e', '#115e59'], border: '#99f6e4', fontSize: 10.5,
      }, () => App.Main.goScene('hire', { tab: 'rented' }));
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      const remMins = Math.max(1, Math.ceil(((rented.expireAt || 0) - App.API.now()) / 60000));
      ctx.fillText(`租用助战中`, 300, 282);
      ctx.fillText(remMins >= 60 ? `剩余${Math.floor(remMins / 60)}h${remMins % 60}m` : `剩余${remMins}分钟`, 300, 297);
      ctx.restore();
    } else if (hosted) {
      App.UI.drawButton(ctx, 254, 210, 92, 28, '去佣馆管理', {
        r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
      }, () => App.Main.goScene('hire', { tab: 'mine' }));
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText('正在聚贤佣馆', 300, 258);
      ctx.fillText('托管出租中', 300, 273);
      ctx.restore();
    }

    // 英雄属性与专属技能栏 + 右上角 ✕ 关闭圆章按钮
    App.UI.drawPanel(ctx, 356, 68, 536, 82, { r: 8, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });
    App.UI.drawCloseButton(ctx, W - 56, 70, 32, () => App.Main.goScene('map'));
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`${g.title} · 【${selTroopMeta.name}】  绝技【${g.skillName}】：${g.skillDesc}`, 368, 86, 514);

    const drawStatPill = (label, baseVal, bonusVal, x, y) => {
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(label, x, y);
      ctx.fillStyle = '#3b2614';
      App.UI.roundRect(ctx, x + 34, y - 12, 118, 17, 5);
      ctx.fill();
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${baseVal}`, x + 41, y);
      if (bonusVal > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`+${bonusVal}`, x + 90, y);
      }
    };
    drawStatPill('气血', stats.baseHp, stats.bonusHp, 368, 112);
    drawStatPill('武力', stats.baseAtk, stats.bonusAtk, 534, 112);
    drawStatPill('防御', stats.baseDef, stats.bonusDef, 700, 112);
    drawStatPill('暴击', `${Math.round(stats.crit * 100)}%`, 0, 368, 138);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    const lvDesc = owned
      ? `Lv.${owned.lv}/${absMaxLv}·${owned.star}★${effAscInfo ? '·' + effAscInfo.shortTag : ''}`
      : (rented ? `佣·Lv.${rented.lv}·${rented.star}★` : (hosted ? `托管·Lv.${hosted.lv}·${hosted.star}★` : '未招降'));
    ctx.fillText(`战力：${stats.power} (${lvDesc})`, 534, 138, 108);
    ctx.restore();

    const heroBonds = App.Config.getGeneralBonds ? App.Config.getGeneralBonds(selectedGid, st.deployIds) : [];
    const hasActiveHeroBond = heroBonds.some((b) => b.active);
    App.UI.drawButton(ctx, 648, 122, 76, 23, hasActiveHeroBond ? '★羁绊详情' : '属性·羁绊', {
      r: 6,
      grad: hasActiveHeroBond ? ['#0284c7', '#0c4a6e'] : ['#0f766e', '#115e59'],
      border: hasActiveHeroBond ? '#fde047' : '#99f6e4',
      fontSize: 9.5,
    }, () => {
      showDetailModal = true;
    });

    App.UI.drawButton(ctx, 728, 122, 76, 23, '⚔ 兵刃演示', {
      r: 6, grad: activeWeaponVfx ? ['#7e22ce', '#4c1d95'] : ['#57534e', '#292524'], border: activeWeaponVfx ? '#f5d0fe' : '#fde68a', fontSize: 9.5,
    }, () => {
      launchWeaponPreview(selectedGid);
    });

    App.UI.drawButton(ctx, 808, 122, 76, 23, '✦ 绝技演示', {
      r: 6, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 9.5,
    }, () => {
      launchSkillPreview(selectedGid);
    });

    // 6格穿戴装备栏（精巧 62×62 小图标 + 套装共鸣流光连线）
    App.UI.drawPanel(ctx, 356, 154, 578, 92, { r: 8, bg: '#8a6845', border: '#4a2c16', lineWidth: 1.5 });
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10.8px "PingFang SC", sans-serif';
    const topSet = stats.activeSets && stats.activeSets[0];
    const wfxHint = activeWeaponVfx ? `  |  ⚔局内攻效【${activeWeaponVfx.atkName}】` : '';
    const auraHint = equipSetVfx && equipSetVfx.vfxTier > 0
      ? ` · 异象【${equipSetVfx.auraName}】`
      : (effAscInfo ? ` · 道果法相【${effAscInfo.auraVfx.auraName}】` : '');
    const resHint = topSet && topSet.resonanceActive
      ? ` · ★${topSet.ascendAffinity === 'xian' ? '神道' : '魔道'}共鸣+${Math.round((topSet.resonancePct || 0.12) * 100)}%`
      : (topSet && topSet.ascendAffinity && topSet.count >= topSet.total
        ? `(${topSet.ascendAffinity === 'xian' ? '成神' : '成魔'}再享+12%共鸣)`
        : '');
    const setSummary = topSet
      ? `套装【${topSet.name}】(${topSet.count}/${topSet.total})${resHint}${auraHint}${wfxHint}`
      : (effAscInfo
        ? `已晋升【${selRarLabel}·${effAscInfo.realm}】全属性+${Math.round((effAscInfo.statMult - 1) * 100)}%${auraHint}${wfxHint}`
        : `穿戴 76 套神装/神魔套装或满 ${ascReqLv} 级成神/成魔激活法相异象${wfxHint}`);
    ctx.fillText(setSummary, 368, 170, 554);
    ctx.restore();

    const slotSz = 62;
    const slotStep = 91;
    const slotStartX = 381;
    const slotY = 177;

    if (topSet && topSet.count >= 2) {
      const matchedCenters = [];
      App.Config.EQUIP_SLOTS.forEach((slot, idx) => {
        const eq = eqMap[slot.id];
        const tpl = eq && App.Config.EQUIP_TEMPLATES[eq.tplId];
        if (tpl && tpl.setId === topSet.setId) matchedCenters.push(slotStartX + idx * slotStep + slotSz / 2);
      });
      if (matchedCenters.length >= 2) {
        const tAnim = time || (Date.now() % 100000) / 1000;
        ctx.save();
        ctx.strokeStyle = topSet.auraColor || '#fde047';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(tAnim * 4.5);
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -tAnim * 28;
        ctx.beginPath();
        ctx.moveTo(matchedCenters[0], slotY + slotSz / 2);
        ctx.lineTo(matchedCenters[matchedCenters.length - 1], slotY + slotSz / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    App.Config.EQUIP_SLOTS.forEach((slot, idx) => {
      const sx = slotStartX + idx * slotStep;
      const sy = slotY;
      const eq = eqMap[slot.id];
      const tpl = eq ? App.Config.EQUIP_TEMPLATES[eq.tplId] : null;
      const q = tpl ? App.Config.QUALITIES[tpl.quality] : null;
      const isSelEq = eq && selectedEqUid === eq.uid;

      if (tpl) {
        App.Sprites.drawEquipIcon(ctx, tpl.id, sx, sy, slotSz, {
          radius: 8, border: isSelEq ? '#ffffff' : q.color, lineWidth: isSelEq ? 2.8 : 2,
          enhance: eq.enhance, star: eq.star, advance: eq.advance, time,
        });
        ctx.save();
        if (slot.id === 'weapon' && activeWeaponVfx) {
          ctx.fillStyle = 'rgba(88, 28, 135, 0.86)';
          App.UI.roundRect(ctx, sx + 2, sy + 2, 44, 12, 3);
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 8px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(activeWeaponVfx.atkName.slice(0, 4), sx + 24, sy + 10.5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(sx + 2, sy + slotSz - 16, slotSz - 4, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, sx + slotSz / 2, sy + slotSz - 5.5, slotSz - 6);
        ctx.restore();
        App.UI.addHit(sx, sy, slotSz, slotSz, () => { selectedEqUid = eq.uid; });
      } else {
        App.UI.drawPanel(ctx, sx, sy, slotSz, slotSz, { r: 8, bg: '#573b22', border: '#a16207', lineWidth: 1.4 });
        ctx.save();
        ctx.fillStyle = '#d6b685';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(slot.name, sx + slotSz / 2, sy + 29);
        ctx.font = '9.5px "PingFang SC", sans-serif';
        ctx.fillText('空槽', sx + slotSz / 2, sy + 45);
        ctx.restore();
      }
    });

    if (selectedEqUid) {
      const eq = st.inventory.find((i) => i.uid === selectedEqUid);
      if (eq) {
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        App.UI.drawButton(ctx, 254, 390, 92, 23, '去锻器坊', {
          r: 6, grad: ['#ea580c', '#9a3412'], border: '#fef08a', fontSize: 10.5,
        }, () => App.Main.goScene('forge'));
        if (eq.equippedBy) {
          App.UI.drawButton(ctx, 254, 417, 92, 23, '卸下回仓库', {
            r: 6, bg: '#57534e', border: '#d6d3d1', fontSize: 10,
          }, () => {
            App.State.unequipItem(eq.uid).then((res) => { if (res.ok) { selectedEqUid = null; App.UI.showToast(`已卸下 ${tpl.name}`, '#e2e8f0'); } });
          });
        }
      }
    }

    // 底部快捷穿戴栏（纵深拓展至 y=522，消除底部留白）
    App.UI.drawPanel(ctx, 356, 250, 578, 272, { r: 8, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });
    if (curRev !== cachedBagRev) {
      cachedBagRev = curRev;
      cachedUnequipped = st.inventory.filter((i) => {
        const t = App.Config.EQUIP_TEMPLATES[i.tplId];
        return t && !t.isBeastEquip && !i.equippedBy;
      });
    }
    const unequipped = cachedUnequipped;
    const bagCols = 8;
    const bagPerPage = 16;
    const maxBagPage = Math.max(0, Math.ceil(unequipped.length / bagPerPage) - 1);
    bagPage = Math.min(bagPage, maxBagPage);

    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`快捷穿戴 (${unequipped.length}件闲置 · 点击穿戴)`, 368, 270, 312);
    ctx.restore();

    App.UI.drawButton(ctx, 688, 255, 84, 22, '⚡ 一键穿装', {
      r: 5, grad: ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 10,
      disabled: !owned || App.State.isBusy(),
    }, () => {
      if (!owned) return;
      App.State.autoEquipGeneral(selectedGid);
    });

    App.UI.drawButton(ctx, 776, 255, 58, 22, '全卸', {
      r: 5, bg: '#57534e', border: '#d6d3d1', fontSize: 10,
      disabled: !owned || !eqListWorn.length || App.State.isBusy(),
    }, () => {
      if (!owned) return;
      App.State.unequipAllGeneral(selectedGid).then((res) => { if (res.ok) selectedEqUid = null; });
    });

    App.UI.drawButton(ctx, 840, 255, 86, 22, '去军备仓库', {
      r: 5, grad: ['#b45309', '#78350f'], border: '#fde68a', fontSize: 10,
    }, () => App.Main.goScene('warehouse'));

    const bagIconSz = 56;
    if (!unequipped.length) {
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('当前暂无闲置装备，攻城掠地、扫荡关卡或开启宝箱可获得神装！', 645, 386);
      ctx.restore();
    } else {
      unequipped.slice(bagPage * bagPerPage, (bagPage + 1) * bagPerPage).forEach((eq, idx) => {
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        const q = App.Config.QUALITIES[tpl.quality];
        const col = idx % bagCols;
        const row = Math.floor(idx / bagCols);
        const ix = 368 + col * 70;
        const iy = 284 + row * 94;

        App.Sprites.drawEquipIcon(ctx, tpl.id, ix, iy, bagIconSz, {
          radius: 8, border: q.color, lineWidth: 1.8,
          enhance: eq.enhance, star: eq.star, advance: eq.advance, time,
        });
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.74)';
        ctx.fillRect(ix + 2, iy + bagIconSz - 15, bagIconSz - 4, 13);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, ix + bagIconSz / 2, iy + bagIconSz - 5.5, bagIconSz - 4);
        ctx.fillStyle = '#bbf7d0';
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.fillText('点击穿戴', ix + bagIconSz / 2, iy + bagIconSz + 13);
        ctx.restore();

        App.UI.addHit(ix, iy, bagIconSz, bagIconSz + 18, () => {
          if (!owned) { App.UI.showToast('请先招降该名将再穿戴装备！', '#f87171'); return; }
          App.State.equipItem(selectedGid, eq.uid).then((res) => { if (res.ok) { selectedEqUid = eq.uid; App.UI.showToast(`${g.name} 已穿戴 [${q.name}] ${tpl.name}！`, '#4ade80'); } });
        });
      });
    }

    if (maxBagPage > 0) {
      App.UI.drawPagination(ctx, 368, 482, 554, 28, bagPage, maxBagPage + 1, (p) => { bagPage = p; });
    }

    // ★ 800名将独门绝技实景沙场演武厅（真实武将骑乘出招 + 敌军受击反馈 + 原画级绝技特效 + 右上/底部/遮罩三重关闭）
    if (previewFx) {
      App.UI.clearHits();

      const sx = 46, sy = 30, sw = W - 92, sh = H - 60;
      const closePreview = () => { previewFx = null; };

      // 点击弹窗四周暗色遮罩区域可直接关闭
      App.UI.addHit(0, 0, W, sy, closePreview);
      App.UI.addHit(0, sy + sh, W, H - (sy + sh), closePreview);
      App.UI.addHit(0, sy, sx, sh, closePreview);
      App.UI.addHit(sx + sw, sy, W - (sx + sw), sh, closePreview);

      ctx.save();
      ctx.fillStyle = 'rgba(8, 5, 3, 0.86)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      App.UI.drawPanel(ctx, sx, sy, sw, sh, { r: 14, bg: '#1a0f08', border: '#facc15', lineWidth: 2.2 });

      // 实景沙场视窗区域
      const vx = sx + 8, vy = sy + 76, vw = sw - 16, vh = sh - 134;
      const isWeaponMode = previewFx.mode === 'weapon';
      const pProg = previewFx.maxLife > 0 ? Math.max(0, Math.min(1, 1 - previewFx.life / previewFx.maxLife)) : 1;
      const sprMeta = resolvePreviewSpriteInfo(g, eqMap && eqMap.weapon);
      const isMeleeHero = sprMeta.atkStyle !== 'bow' && sprMeta.atkStyle !== 'fan';
      const mech = g.skillMechanic || {};
      const sRole = g.skillRole || '';
      const hasOffensiveDmg = isWeaponMode || (g.skillPower === undefined ? true : g.skillPower > 0.05);
      const isMassHealPreview = !isWeaponMode && (sRole === 'mass_heal' || (mech.healPct || 0) > 0 || (mech.teamHealPct || 0) > 0);
      const isGradualHotPreview = !isWeaponMode && (sRole === 'gradual_hot' || (mech.teamHotPct || 0) > 0 || (mech.selfHotPct || 0) > 0);
      const isPoisonPreview = !isWeaponMode && (sRole === 'poison_dot' || (mech.poisonDpsPct || 0) > 0);
      const isPetrifyPreview = !isWeaponMode && (sRole === 'petrify_cc' || (mech.petrifySec || 0) > 0);
      const isStunPreview = !isWeaponMode && ((mech.stunSec || 0) > 0 || (mech.charmStrongestSec || 0) > 0);
      const isBurnPreview = !isWeaponMode && !isPoisonPreview && (mech.burnDpsPct || 0) > 0;
      const isBleedPreview = !isWeaponMode && !isPoisonPreview && !isBurnPreview && (mech.bleedDpsPct || 0) > 0;
      const isShieldPreview = !isWeaponMode && ((mech.teamShieldPct || 0) > 0 || (mech.selfShieldPct || 0) > 0 || mech.overhealShield);
      const isSummonPreview = !isWeaponMode && mech.summonTroop && (mech.summonCount || 0) > 0;

      // 兵刃演示：连环3式武道连招；绝技演示：冲阵一击或辅助驻阵施法
      const comboCycle = isWeaponMode ? ((pProg * 3) % 1) : pProg;
      const comboStepIdx = isWeaponMode ? (Math.floor(pProg * 3) % 3) : 0;
      const dashCurve = (isMeleeHero && hasOffensiveDmg)
        ? (isWeaponMode ? Math.min(1, pProg * 3.4) * 0.88 : Math.sin(Math.min(1, pProg * 1.45) * Math.PI))
        : 0;
      const heroX = (isWeaponMode && isMeleeHero ? 326 : 276) + dashCurve * (isWeaponMode ? 158 : 155);
      const heroY = 332;
      previewFx.casterX = heroX;
      previewFx.casterY = heroY;

      ctx.save();
      App.UI.roundRect(ctx, vx, vy, vw, vh, 10);
      ctx.clip();

      // 1. 绘制真实手绘古战场背景与远景城关
      if (App.Sprites && App.Sprites.drawBattlefieldTerrain) {
        App.Sprites.drawBattlefieldTerrain(ctx, { mapBiome: 'plains', worldW: 1920, props: [], towers: [] }, 180, W, previewTime);
      } else {
        const bgImg = App.Assets && App.Assets.get('bg_battle');
        if (bgImg) ctx.drawImage(bgImg, vx, vy, vw, vh);
      }

      const previewHud = [];
      // 1B. 先绘制绝技远景魔相与贴地符阵底衬（严格处于所有武将与小兵身后，绝不糊脸遮挡！）
      if (!isWeaponMode && App.SkillVFX && App.SkillVFX.renderBackdrop && previewFx.life > 0) {
        App.SkillVFX.renderBackdrop(ctx, previewFx, 0, W);
      }

      // 2A. 若为【群体一次性治疗 / 持续逐渐治疗 / 全军护盾 / 奇兵召唤】，在左翼真实演示我方伤兵回血、逐渐回春、护盾或召唤奇兵！
      if ((isMassHealPreview || isGradualHotPreview || (isShieldPreview && !hasOffensiveDmg)) && App.Sprites && App.Sprites.drawSoldierSprite) {
        const healRatio = isMassHealPreview
          ? (pProg < 0.20 ? 0.38 : Math.min(0.96, 0.38 + Math.min(1, (pProg - 0.20) / 0.16) * 0.58))
          : (pProg < 0.16 ? 0.36 : Math.min(0.95, 0.36 + (Math.floor(((pProg - 0.16) / 0.80) * 4) + 1) * 0.145));
        const allyCompanions = [
          { uid: 801, x: 206, y: 296, spriteKey: 'unit_pikeman', atkStyle: 'thrust' },
          { uid: 802, x: 368, y: 360, spriteKey: 'unit_archer', atkStyle: 'bow' },
        ];
        allyCompanions.forEach((ac) => {
          App.Sprites.drawSoldierSprite(ctx, {
            uid: ac.uid, side: 'player', kind: 'soldier', x: ac.x, y: ac.y,
            hp: Math.round(1000 * healRatio), maxHp: 1000,
            spriteKey: ac.spriteKey, atkStyle: ac.atkStyle, isMounted: false,
            moving: false, inCombat: true, runPhase: previewTime * 5, idlePhase: ac.uid,
            hotTimer: (isGradualHotPreview && pProg >= 0.16) ? 5.0 : 0,
          }, previewTime, previewHud);
        });
      }
      if (isSummonPreview && pProg >= 0.22 && App.Sprites && App.Sprites.drawSoldierSprite) {
        const sSpr = mech.summonTroop === 'cavalry' ? 'unit_cavalry' : (mech.summonTroop === 'archer' ? 'unit_archer' : 'unit_infantry');
        for (let si = 0; si < Math.min(2, mech.summonCount || 2); si++) {
          App.Sprites.drawSoldierSprite(ctx, {
            uid: 820 + si, side: 'player', kind: 'soldier', x: heroX + 46 + si * 28, y: si === 0 ? 302 : 356,
            hp: 1000, maxHp: 1000, spriteKey: sSpr, atkStyle: mech.summonTroop === 'archer' ? 'bow' : 'cleave',
            isMounted: mech.summonTroop === 'cavalry', moving: true, inCombat: true, runPhase: previewTime * 10 + si, idlePhase: si,
          }, previewTime, previewHud);
        }
      }

      // 2B. 绘制右侧演武敌军靶阵（受击闪白、震退、中毒/灼烧/流血/眩晕状态实时联动！）
      const hitActive = hasOffensiveDmg
        ? (isWeaponMode ? (comboCycle >= 0.34 && comboCycle <= 0.88) : (pProg >= 0.16 && pProg <= 0.90))
        : false;
      const hitWave = hitActive
        ? (isWeaponMode ? Math.sin(((comboCycle - 0.34) / 0.54) * Math.PI) : Math.sin(((pProg - 0.16) / 0.74) * Math.PI * 3))
        : 0;
      const recoil = hitActive
        ? (isWeaponMode ? hitWave * 0.75 : Math.max(0, Math.sin(((pProg - 0.16) / 0.74) * Math.PI)))
        : 0;
      const statusOnEnemy = !isWeaponMode && pProg >= 0.18;
      const enemyHpRatio = hasOffensiveDmg
        ? (isPoisonPreview ? Math.max(0.18, 1 - Math.max(0, pProg - 0.15) * 0.85) : Math.max(0.12, 1 - pProg * 0.56))
        : 1.0;

      const effRecoil = (isPetrifyPreview && statusOnEnemy) ? 0 : recoil;
      const dummyEnemies = [
        { uid: 901, x: 562 + effRecoil * 18, y: 298, spriteKey: 'unit_pikeman', atkStyle: 'thrust', isMounted: false },
        { uid: 902, x: 646 + effRecoil * 14, y: 360, spriteKey: 'unit_infantry', atkStyle: 'cleave', isMounted: false },
      ];
      dummyEnemies.forEach((du) => {
        if (App.Sprites && App.Sprites.drawSoldierSprite) {
          App.Sprites.drawSoldierSprite(ctx, {
            uid: du.uid, side: 'enemy', kind: 'soldier', x: du.x, y: du.y,
            hp: Math.round(1000 * enemyHpRatio), maxHp: 1000,
            spriteKey: du.spriteKey, atkStyle: du.atkStyle, isMounted: du.isMounted,
            moving: false, inCombat: true, runPhase: previewTime * 6, idlePhase: du.uid,
            hitFlash: hitWave > 0.25 ? 0.14 : 0, hitRecoil: effRecoil * 0.85,
            petrifyTimer: (isPetrifyPreview && statusOnEnemy) ? 5.0 : 0,
            stunTimer: (isStunPreview && statusOnEnemy) ? 5.0 : 0,
            poisonTimer: (isPoisonPreview && statusOnEnemy) ? 5.0 : 0,
            burnTimer: (isBurnPreview && statusOnEnemy) ? 5.0 : 0,
            bleedTimer: (isBleedPreview && statusOnEnemy) ? 5.0 : 0,
          }, previewTime, previewHud);
        }
      });

      if (App.Sprites && App.Sprites.drawMountedGeneral) {
        // 敌方演武守将靶标（实时呈现 🗿石化 / ★眩晕 / ☠中毒 / 🔥灼烧 / 🩸流血 / 💔破甲 铭牌角标与头顶异象！）
        const enemyMeta = resolvePreviewSpriteInfo(App.Config.GENERALS.huaxiong || 'huaxiong', null);
        App.Sprites.drawMountedGeneral(ctx, {
          uid: 900, id: 'huaxiong', name: '敌军守将', side: 'enemy', kind: 'general',
          x: 602 + effRecoil * 22, y: 332, hp: Math.round(3200 * enemyHpRatio), maxHp: 3200,
          spriteKey: enemyMeta.spriteKey, fallbackSpriteKey: enemyMeta.fallbackSpriteKey, battleSpec: enemyMeta.battleSpec, scale: enemyMeta.scale,
          atkStyle: enemyMeta.atkStyle, weaponKind: enemyMeta.weaponKind, isMounted: true,
          moving: false, moveBlend: 0, inCombat: true, runPhase: previewTime * 6, idlePhase: 2.1,
          hitFlash: hitWave > 0.15 ? 0.16 : 0, hitRecoil: effRecoil, equips: {},
          petrifyTimer: (isPetrifyPreview && statusOnEnemy) ? 5.0 : 0,
          stunTimer: (isStunPreview && statusOnEnemy) ? 5.0 : 0,
          poisonTimer: (isPoisonPreview && statusOnEnemy) ? 5.0 : 0,
          burnTimer: (isBurnPreview && statusOnEnemy) ? 5.0 : 0,
          bleedTimer: (isBleedPreview && statusOnEnemy) ? 5.0 : 0,
          armorBreakTimer: (statusOnEnemy && ((mech.armorBreak || 0) > 0 || (mech.armorIgnore || 0) > 0)) ? 5.0 : 0,
        }, previewTime, previewHud);

        // 3. 绘制左侧本命武将真身（含回血/回春灵环/护盾罩联动！）
        const atkProgVal = isWeaponMode
          ? comboCycle
          : ((pProg > 0.04 && pProg < 0.72) ? ((pProg - 0.04) / 0.68) : 0);
        const isCharging = dashCurve > 0.08 && (!isWeaponMode || pProg < 0.30);
        const heroHpRatio = (isMassHealPreview || isGradualHotPreview)
          ? (pProg < 0.18 ? 0.52 : Math.min(1, 0.52 + (pProg - 0.18) * 0.72))
          : 1.0;
        App.Sprites.drawMountedGeneral(ctx, {
          uid: 888, id: selectedGid, name: g.name, side: 'player', kind: 'general',
          x: heroX, y: heroY, hp: Math.round(stats.hp * heroHpRatio), maxHp: stats.hp,
          shieldHp: (isShieldPreview && pProg >= 0.20) ? Math.round(stats.hp * 0.28) : 0,
          hotTimer: (isGradualHotPreview && pProg >= 0.16) ? 5.0 : 0,
          spriteKey: sprMeta.spriteKey, fallbackSpriteKey: sprMeta.fallbackSpriteKey, battleSpec: sprMeta.battleSpec, scale: sprMeta.scale,
          atkStyle: sprMeta.atkStyle, weaponKind: sprMeta.weaponKind, isMagic: sprMeta.isMagic, isMounted: true,
          moving: isCharging, moveBlend: isCharging ? 0.95 : 0, inCombat: true,
          runPhase: previewTime * 15, idlePhase: 0.5,
          atkProg: atkProgVal, attackAnim: atkProgVal > 0 ? (1 - atkProgVal) : 0, comboStep: comboStepIdx,
          castAnim: (!isWeaponMode && pProg < 0.55) ? (0.55 - pProg) : 0,
          hitFlash: 0, hitRecoil: 0, equips: eqMap || {}, weaponVfx: activeWeaponVfx, setVfx: activeSetVfx, cfg: g,
        }, previewTime, previewHud);
      }

      // 4. 播放神兵普攻特效弹道/爆破 或 清透前景绝技光刃层
      if (isWeaponMode && App.Sprites && App.Sprites.drawProjectile) {
        const wCol = activeWeaponVfx ? activeWeaponVfx.color : '#fde047';
        const wCore = activeWeaponVfx ? activeWeaponVfx.coreColor : '#ffffff';
        const wAtk = activeWeaponVfx ? activeWeaponVfx.atkVfx : 'dragon_gold';
        const wScale = activeWeaponVfx ? activeWeaponVfx.scaleMult : 1.05;
        const targetX = 590 + recoil * 18;
        const targetY = 296;

        if (!isMeleeHero && comboCycle >= 0.36 && comboCycle < 0.72) {
          const flyT = (comboCycle - 0.36) / 0.36;
          const cx = heroX + 20 + (targetX - heroX - 20) * flyT;
          const cy = (heroY - 46) + (targetY - (heroY - 46)) * flyT - 4 * 26 * flyT * (1 - flyT);
          const trail = [];
          for (let ti = 4; ti >= 0; ti--) {
            const tt = Math.max(0, flyT - ti * 0.07);
            trail.push({
              x: heroX + 20 + (targetX - heroX - 20) * tt,
              y: (heroY - 46) + (targetY - (heroY - 46)) * tt - 4 * 26 * tt * (1 - tt),
            });
          }
          App.Sprites.drawProjectile(ctx, {
            kind: sprMeta.atkStyle === 'fan' ? 'gen_fan' : 'gen_arrow',
            ballistic: true, side: 'player',
            atkVfx: activeWeaponVfx ? wAtk : null, color: wCol, coreColor: wCore,
            cx, cy, ang: 0.05, trail,
          }, previewTime);
        }

        if (comboCycle >= 0.42 && comboCycle <= 0.92) {
          const bLife = Math.max(0.01, 1 - (comboCycle - 0.42) / 0.50);
          if (isMeleeHero) {
            App.Sprites.drawProjectile(ctx, {
              kind: sprMeta.atkStyle === 'thrust' ? 'thrust' : 'slash',
              x1: heroX + 18, y1: heroY - 38, x2: targetX, y2: targetY,
              dir: 1, scale: 1.35 * wScale, color: wCol, life: bLife, maxLife: 1,
            }, previewTime);
          }
          if (activeWeaponVfx) {
            App.Sprites.drawProjectile(ctx, {
              kind: 'weapon_burst',
              atkVfx: wAtk, vfxTex1: activeWeaponVfx.tex1, vfxTex2: activeWeaponVfx.tex2,
              color: wCol, coreColor: wCore,
              x2: targetX, y2: targetY, dir: 1, scale: 1.24 * wScale, life: bLife, maxLife: 1,
            }, previewTime);
          }
          App.Sprites.drawProjectile(ctx, {
            kind: 'clash_star', x2: targetX - 10, y2: targetY, scale: 1.35, color: wCol, life: bLife, maxLife: 1,
          }, previewTime);
        }
      } else if (!isWeaponMode && App.SkillVFX && previewFx.life > 0) {
        if (App.SkillVFX.renderForeground) App.SkillVFX.renderForeground(ctx, previewFx, 0, W);
        else App.SkillVFX.render(ctx, previewFx, 0, W);
      }

      // 4B. 顶层统一绘制双方将领与士卒铭牌血条及状态角标（确保人物信息永远清晰醒目！）
      if (App.Sprites && App.Sprites.drawUnitHudLayer) {
        App.Sprites.drawUnitHudLayer(ctx, previewHud, vx, vw);
      }

      // 5. 演武跳字反馈（精准区分：群体瞬疗大回血 / 多段逐渐回春 / 目标剧毒连跳 / 灼烧流血 / 暴击轰杀！）
      const drawPreviewFloat = (txt, fx0, fy0, col, alpha0, fSize) => {
        if (alpha0 <= 0.03) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha0);
        ctx.font = `bold ${fSize || 16}px "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.92)';
        ctx.lineWidth = 3.4;
        ctx.strokeText(txt, fx0, fy0);
        ctx.fillStyle = col;
        ctx.fillText(txt, fx0, fy0);
        ctx.restore();
      };

      if (isMassHealPreview && pProg >= 0.18 && pProg <= 0.90) {
        const hp = (pProg - 0.18) / 0.72;
        const ha = Math.sin(hp * Math.PI) * 1.3;
        const mainHeal = Math.round(stats.hp * (mech.healPct || mech.teamHealPct || 0.35) + stats.atk * 0.6);
        drawPreviewFloat(`✦群体瞬疗 +${mainHeal}`, heroX, 224 - hp * 28, '#4ade80', ha, 17);
        drawPreviewFloat(`+${Math.round(mainHeal * 0.72)}`, 206, 250 - hp * 24, '#86efac', ha, 14.5);
        drawPreviewFloat(`+${Math.round(mainHeal * 0.68)}`, 368, 312 - hp * 24, '#86efac', ha, 14.5);
      }
      if (isGradualHotPreview && pProg >= 0.16 && pProg <= 0.96) {
        const tickLen = 0.20;
        for (let tk = 0; tk < 4; tk++) {
          const tp = (pProg - (0.16 + tk * 0.18)) / tickLen;
          if (tp <= 0 || tp >= 1) continue;
          const ta = Math.sin(tp * Math.PI);
          const hotVal = Math.max(68, Math.round((stats.hp * (mech.teamHotPct || mech.selfHotPct || 0.42)) / 5));
          drawPreviewFloat(`✚持续回春 +${hotVal}`, heroX + (tk % 2 === 0 ? -12 : 14), 228 - tp * 26, '#4ade80', ta * 1.25, 16);
          if (!mech.selfHotPct) {
            drawPreviewFloat(`回春 +${Math.round(hotVal * 0.65)}`, tk % 2 === 0 ? 206 : 368, (tk % 2 === 0 ? 252 : 314) - tp * 22, '#86efac', ta * 1.15, 13.5);
          }
        }
      }
      if (isPoisonPreview && pProg >= 0.20 && pProg <= 0.96) {
        for (let pk = 0; pk < 4; pk++) {
          const pp = (pProg - (0.20 + pk * 0.18)) / 0.20;
          if (pp <= 0 || pp >= 1) continue;
          const pa = Math.sin(pp * Math.PI);
          const pDmg = Math.max(85, Math.round(stats.atk * (mech.poisonDpsPct || 0.40) * 1.25 + 160));
          drawPreviewFloat(`☠剧毒 -${pDmg}`, 602 + (pk % 2 === 0 ? -16 : 18), 216 - pp * 24, '#a3e635', pa * 1.3, 16);
        }
      }

      if (isPetrifyPreview && pProg >= 0.18 && pProg <= 0.92) {
        const cp = (pProg - 0.18) / 0.74;
        const ca = Math.sin(cp * Math.PI) * 1.35;
        drawPreviewFloat(`🗿玄石石化 ${mech.petrifySec || 2.2}秒!`, 602, 206 - cp * 20, '#e7e5e4', ca, 16.5);
      } else if (isStunPreview && pProg >= 0.18 && pProg <= 0.90) {
        const sp = (pProg - 0.18) / 0.72;
        const sa = Math.sin(sp * Math.PI) * 1.35;
        const stTxt = selectedGid === 'lvbu'
          ? `★无双全屏眩晕 ${mech.stunSec || 2.5}秒!`
          : ((mech.charmStrongestSec || 0) > 0 ? '★倾城魅惑禁锢!' : (g.skillElement === 'ice' ? `★寒冰冻结 ${mech.stunSec}秒!` : `★震慑眩晕 ${mech.stunSec}秒!`));
        drawPreviewFloat(stTxt, 602, 204 - sp * 20, selectedGid === 'lvbu' ? '#fde047' : (g.skillElement === 'ice' ? '#7dd3fc' : '#fde047'), sa, selectedGid === 'lvbu' ? 17.5 : 16);
      }

      if (hitActive) {
        const floatP = isWeaponMode ? ((comboCycle - 0.34) / 0.54) : ((pProg - 0.16) / 0.70);
        if (floatP > 0 && floatP < 1) {
          const floatA = Math.min(1, Math.sin(floatP * Math.PI) * 1.35);
          const pMult = g.skillPower || 2.1;
          const critDmg = isWeaponMode
            ? Math.round(stats.atk * (1.5 + (stats.critDmg || 0)) + 260)
            : Math.round(stats.atk * pMult * 1.5 + 760);
          const fy = (isPoisonPreview || isPetrifyPreview || isStunPreview ? 248 : 236) - floatP * 30;
          const tagPrefix = isWeaponMode && activeWeaponVfx
            ? `${activeWeaponVfx.atkName} `
            : (selectedGid === 'lvbu' ? '★无双灭世 ' : (isPetrifyPreview ? '碎石暴击 ' : '暴击 '));
          drawPreviewFloat(`${tagPrefix}-${critDmg}`, 602, fy, (activeWeaponVfx && isWeaponMode) ? activeWeaponVfx.color : (selectedGid === 'lvbu' ? '#fca5a5' : '#fde047'), floatA, selectedGid === 'lvbu' ? 19 : 17);
        }
      }

      ctx.restore();

      // 视窗金线内框
      ctx.save();
      App.UI.roundRect(ctx, vx, vy, vw, vh, 10);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 顶部武将头像 + 演示详情栏 + 右上角醒目【✕ 关闭】按钮
      const curIdx = Math.max(0, sorted.indexOf(selectedGid));
      App.Portraits.drawGeneralPortrait(ctx, selectedGid, sx + 16, sy + 11, 56, { radius: 8, lineWidth: 2 });
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15.5px "PingFang SC", serif';
      ctx.textAlign = 'left';
      const eqWeaponTpl = eqMap && eqMap.weapon ? App.Config.EQUIP_TEMPLATES[eqMap.weapon.tplId] : null;
      const wornGearNames = ['armor', 'helm', 'mount', 'jade', 'book']
        .map((sl) => (eqMap && eqMap[sl] && App.Config.EQUIP_TEMPLATES[eqMap[sl].tplId] ? App.Config.EQUIP_TEMPLATES[eqMap[sl].tplId].name : null))
        .filter(Boolean);
      const headerTitle = isWeaponMode
        ? `${g.name} · 兵刃演武【${activeWeaponVfx ? activeWeaponVfx.name + ' · ' + activeWeaponVfx.atkName : (eqWeaponTpl ? eqWeaponTpl.name + '（紫/金神兵解锁元素攻效）' : '本命制式兵刃（穿戴神兵即时焕新外观与招式！）')}】`
        : `${g.name}（${g.title}）· 独门绝技【${g.skillName}】`;
      ctx.fillText(headerTitle, sx + 82, sy + 33, sw - 188);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px "PingFang SC", sans-serif';
      const setTxt = activeSetVfx ? `${activeSetVfx.name}(${activeSetVfx.count}/${activeSetVfx.total})·【${activeSetVfx.auraName}】` : '未激活套装阵纹';
      const attireTxt = wornGearNames.length ? `披挂：${wornGearNames.join(' / ')}` : '暂未穿戴防具坐骑宝物';
      const headerSub = isWeaponMode
        ? `${setTxt}  |  ${attireTxt}`
        : `第 ${curIdx + 1}/${sorted.length} 将  |  ${g.skillDesc}`;
      ctx.fillText(headerSub, sx + 82, sy + 56, sw - 188);
      ctx.restore();

      App.UI.drawButton(ctx, sx + sw - 92, sy + 16, 76, 32, '✕ 关闭', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 12.5,
      }, closePreview);

      // 底部演武操控栏：上一位武将 / 切换兵刃·绝技 / 重放 / 下一位武将
      const btnY = sy + sh - 46;
      const launchCurrentMode = (gid) => {
        if (isWeaponMode) launchWeaponPreview(gid);
        else launchSkillPreview(gid);
      };
      App.UI.drawButton(ctx, W / 2 - 256, btnY, 118, 34, '◀ 上一位武将', {
        r: 8, grad: ['#57534e', '#292524'], border: '#fde68a', fontSize: 12,
      }, () => {
        const nextIdx = (curIdx - 1 + sorted.length) % sorted.length;
        selectedGid = sorted[nextIdx];
        listPage = Math.floor(nextIdx / perPage);
        launchCurrentMode(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 - 128, btnY, 122, 34, isWeaponMode ? '✦ 切换绝技演示' : '⚔ 切换兵刃演示', {
        r: 8, grad: ['#7e22ce', '#4c1d95'], border: '#f5d0fe', fontSize: 12,
      }, () => {
        if (isWeaponMode) launchSkillPreview(selectedGid);
        else launchWeaponPreview(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 + 4, btnY, 118, 34, '下一位武将 ▶', {
        r: 8, grad: ['#57534e', '#292524'], border: '#fde68a', fontSize: 12,
      }, () => {
        const nextIdx = (curIdx + 1) % sorted.length;
        selectedGid = sorted[nextIdx];
        listPage = Math.floor(nextIdx / perPage);
        launchCurrentMode(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 + 132, btnY, 118, 34, '✕ 关闭演示', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 12.5,
      }, closePreview);
    }

    if (showAscendModal && selectedGid) {
      drawAscendModal(ctx, W, H, st, selectedGid);
    }
    if (showDetailModal && selectedGid) {
      drawDetailBondModal(ctx, W, H, st, selectedGid, stats);
    }
  }

  function drawDetailBondModal(ctx, W, H, st, gid, stats) {
    const g = App.Config.GENERALS[gid];
    if (!g || !stats) { showDetailModal = false; return; }
    App.UI.addHit(0, 0, W, H, () => { showDetailModal = false; });
    ctx.save();
    ctx.fillStyle = 'rgba(8, 5, 3, 0.80)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 780, mh = 436;
    const mx = Math.round((W - mw) / 2), my = Math.round((H - mh) / 2) + 8;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 15, bg: '#221208', border: '#facc15', lineWidth: 2.4 });
    App.UI.addHit(mx, my, mw, mh, () => {});
    App.UI.drawWoodHeader(ctx, mx + 12, my + 10, mw - 24, 40);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(`✦ ${g.name}（${g.title}）· 十维属性与宿命羁绊谱 ✦`, W / 2, my + 30);
    ctx.restore();

    App.UI.drawButton(ctx, mx + mw - 88, my + 15, 68, 29, '✕ 关闭', {
      r: 7, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
    }, () => { showDetailModal = false; });

    // 左侧：十维高阶战斗属性与阵营/兵种法则
    const lx = mx + 16, ly = my + 58, lw = 338, lh = mh - 72;
    App.UI.drawPanel(ctx, lx, ly, lw, lh, { r: 10, bg: 'rgba(15, 8, 4, 0.78)', border: '#b45309', lineWidth: 1.4 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13px "PingFang SC", serif';
    ctx.fillText('⚔ 十维战斗属性总览', lx + 14, ly + 24);

    const rows = [
      ['总气血', `${stats.hp} (基础${stats.baseHp}+${stats.bonusHp})`],
      ['总武力', `${stats.atk} (基础${stats.baseAtk}+${stats.bonusAtk})`],
      ['总防御', `${stats.def} (基础${stats.baseDef}+${stats.bonusDef})`],
      ['暴击率', `${+(stats.crit * 100).toFixed(1)}%`],
      ['暴击伤害', `+${Math.round((1.5 + (stats.critDmg || 0)) * 100)}%`],
      ['嗜血汲取', `${+((stats.lifesteal || 0) * 100).toFixed(1)}%`],
      ['伤害减免', `${+((stats.dmgReduce || 0) * 100).toFixed(1)}%`],
      ['绝技增伤', `+${+((stats.skillDmgPct || 0) * 100).toFixed(1)}%`],
      ['攻速加成', `+${+((stats.spdPct || 0) * 100).toFixed(1)}%`],
      ['开局怒气', `${25 + (stats.initRage || 0)} / 100`],
    ];
    rows.forEach((r, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const rx0 = lx + 14 + col * 160, ry0 = ly + 48 + row * 32;
      ctx.fillStyle = '#fed7aa';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(r[0], rx0, ry0);
      ctx.fillStyle = '#fefce8';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(r[1], rx0, ry0 + 15, 152);
    });

    const facObj = App.Config.FACTIONS[st.factionId] || {};
    ctx.fillStyle = 'rgba(180, 83, 9, 0.25)';
    App.UI.roundRect(ctx, lx + 12, ly + 216, lw - 24, 134, 8);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`主公阵营【${facObj.name || '群雄'}】被动：`, lx + 20, ly + 236);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(facObj.passiveDesc || '乱世雄主 · 全军增益', lx + 20, ly + 255, lw - 40);

    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText('兵种相克法则（克制增伤 +20%）：', lx + 20, ly + 282);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText('步枪克铁骑  ▶  铁骑克弓策  ▶  弓策克步枪', lx + 20, ly + 300, lw - 40);

    const bInfo = stats.boundBeastId && App.Config.BEASTS[stats.boundBeastId] ? App.Config.BEASTS[stats.boundBeastId] : null;
    const bOwned = stats.boundBeastId && st.ownedBeasts ? st.ownedBeasts[stats.boundBeastId] : null;
    const bDispName = bInfo && App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(stats.boundBeastId, bOwned) : (bInfo ? bInfo.name : '');
    ctx.fillStyle = stats.beastFavored ? '#4ade80' : '#fde68a';
    ctx.fillText(
      bInfo
        ? `契约神兽：${bDispName}${stats.beastFavored ? '（★本命兵种契合+20%！）' : ''}`
        : '契约神兽：未缔结（前往四象兽栏可缔结契约）',
      lx + 20, ly + 328, lw - 40
    );
    ctx.restore();

    // 右侧：全军阵营共鸣 + 名将宿命羁绊列表
    const rx = lx + lw + 12, ry = ly, rw = mw - lw - 44, rh = lh;
    App.UI.drawPanel(ctx, rx, ry, rw, rh, { r: 10, bg: 'rgba(15, 8, 4, 0.78)', border: '#b45309', lineWidth: 1.4 });
    const lb = App.State.getLineupBondSummary ? App.State.getLineupBondSummary() : { activeFaction: null, activeBonds: [] };
    const bonds = App.Config.getGeneralBonds ? App.Config.getGeneralBonds(gid, st.deployIds) : [];

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13px "PingFang SC", serif';
    ctx.fillText('✦ 阵营共鸣 & 名将宿命羁绊（同上阵生效）', rx + 14, ry + 24);

    App.UI.drawPanel(ctx, rx + 12, ry + 36, rw - 24, 52, {
      r: 8,
      bg: lb.activeFaction ? 'rgba(20, 83, 45, 0.45)' : 'rgba(68, 64, 60, 0.35)',
      border: lb.activeFaction ? '#4ade80' : '#78716c',
      lineWidth: 1.3,
    });
    ctx.fillStyle = lb.activeFaction ? '#86efac' : '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(
      lb.activeFaction ? `★ 已激活阵营共鸣：【${lb.activeFaction.name || lb.activeFaction.label}】（${lb.activeFaction.desc || ''}）` : '阵营共鸣未激活（上阵 3/4/5 名同阵营或魏蜀吴群各1名激活）',
      rx + 22, ry + 56, rw - 44
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px "PingFang SC", sans-serif';
    ctx.fillText('同阵营3/4/5将享最高+20%攻血防；四海归心（四阵营齐聚）享全属性+12%与暴击免伤！', rx + 22, ry + 75, rw - 44);

    if (!bonds.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fed7aa';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`【${g.name}】暂无专属人物宿命羁绊，可享受全军阵营共鸣加成！`, rx + rw / 2, ry + 188, rw - 40);
      if (lb.activeBonds && lb.activeBonds.length) {
        ctx.fillStyle = '#86efac';
        ctx.font = '11.5px "PingFang SC", sans-serif';
        ctx.fillText(`当前队伍已激活：${lb.activeBonds.map((b) => '【' + b.name + '】').join(' ')}`, rx + rw / 2, ry + 218, rw - 40);
      }
    } else {
      bonds.slice(0, 4).forEach((bd, bi) => {
        const by = ry + 98 + bi * 64;
        App.UI.drawPanel(ctx, rx + 12, by, rw - 24, 56, {
          r: 8,
          bg: bd.active ? 'rgba(180, 83, 9, 0.38)' : 'rgba(30, 20, 14, 0.72)',
          border: bd.active ? '#fde047' : '#6b4423',
          lineWidth: bd.active ? 1.8 : 1.1,
        });
        const names = (bd.generals || []).map((id) => (App.Config.GENERALS[id] && App.Config.GENERALS[id].name) || id).join(' · ');
        ctx.fillStyle = bd.active ? '#fef08a' : '#e2e8f0';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        const needCnt = bd.need || bd.minCount || 0;
        const needTxt = needCnt && needCnt < (bd.generals || []).length ? `（任上${needCnt}人）` : '';
        ctx.fillText(`${bd.active ? '★ [已激活] ' : '◇ '}${bd.name}${needTxt}：${names}`, rx + 20, by + 21, rw - 40);
        ctx.fillStyle = bd.active ? '#86efac' : '#a8a29e';
        ctx.font = '10.5px "PingFang SC", sans-serif';
        ctx.fillText(`加成：${bd.desc || ''}`, rx + 20, by + 42, rw - 40);
      });
    }
    ctx.restore();
  }

  function drawAscendModal(ctx, W, H, st, gid) {
    const g = App.Config.GENERALS[gid];
    const owned = st.ownedGenerals && st.ownedGenerals[gid];
    if (!g || !owned) {
      showAscendModal = false;
      return;
    }

    const ac = App.Config.ASCENSION || {};
    const absMaxLv = (App.Config.PARAMS && App.Config.PARAMS.generalMaxLevel) || 150;
    const reqLv = ac.reqLevel || absMaxLv;
    const maxTier = ac.maxTier || 5;
    const curPath = owned.ascend || '';
    const curTier = Math.max(1, Number(owned.ascendTier) || 1);
    const ascInfo = App.Config.getAscendInfo ? App.Config.getAscendInfo(owned) : null;
    const lvReady = (owned.lv || 1) >= reqLv;

    // 拦截底层点击
    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(8, 5, 14, 0.80)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 820, mh = 456;
    const mx = Math.round((W - mw) / 2), my = Math.round((H - mh) / 2) + 8;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 16, bg: '#160d1f', border: '#facc15', lineWidth: 2.5 });
    App.UI.drawPanel(ctx, mx + 7, my + 7, mw - 14, mh - 14, { r: 12, bg: 'rgba(30, 18, 42, 0.78)', border: 'rgba(250, 204, 21, 0.28)', lineWidth: 1.2 });

    // 顶部标题匾额
    const modalRarLabel = App.Config.getRarityLabel ? App.Config.getRarityLabel(gid, owned) : g.rarity;
    App.UI.drawPanel(ctx, W / 2 - 224, my - 20, 448, 42, { r: 21, bg: '#4c1d95', border: '#fef08a', lineWidth: 2.2 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17.5px "PingFang SC", serif';
    ctx.fillText(`✦ 神魔封神台 · [${modalRarLabel}] ${g.name} (Lv.${owned.lv}/${reqLv})`, W / 2, my + 6, 426);
    ctx.restore();

    App.UI.drawButton(ctx, mx + mw - 88, my + 14, 72, 28, '✕ 关闭', {
      r: 7, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
    }, () => { showAscendModal = false; });

    // 当前武将境界总览条
    App.UI.drawPanel(ctx, mx + 18, my + 30, mw - 116, 48, {
      r: 9,
      bg: ascInfo ? (curPath === 'xian' ? 'rgba(8, 51, 68, 0.88)' : 'rgba(74, 4, 78, 0.88)') : 'rgba(42, 24, 16, 0.88)',
      border: ascInfo ? ascInfo.color : '#d97706',
      lineWidth: 1.5,
    });
    App.Portraits.drawGeneralPortrait(ctx, gid, mx + 26, my + 34, 40, { radius: 7, lineWidth: 1.6, ascend: curPath || undefined });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    if (ascInfo) {
      ctx.fillText(`当前神魔品阶：【${modalRarLabel} · ${ascInfo.realm}】(${curTier}/${maxTier}重)  ·  全三维属性 +${Math.round((ascInfo.statMult - 1) * 100)}%`, mx + 76, my + 49);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText('继续消耗同道丹髓可突破更高神/魔重数，亦可通关另一副本后消耗丹髓【洗髓转修】互换神魔大道！', mx + 76, my + 68, mw - 208);
    } else {
      ctx.fillText(
        lvReady
          ? `✓ 已达满级 Lv.${reqLv}！通关对应【成神副本 / 成魔副本】并集齐丹髓，即可晋升 ${g.rarity}.神 或 ${g.rarity}.魔！`
          : `封神门槛：需先将 ${g.name} 升至满级 Lv.${reqLv}（当前 Lv.${owned.lv}，还差 ${reqLv - owned.lv} 级）`,
        mx + 76, my + 49, mw - 208
      );
      ctx.fillStyle = lvReady ? '#86efac' : '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`提示：成神晋升【${g.rarity}.神】、成魔晋升【${g.rarity}.魔】，解锁神罡/魔煞光环与巨幅三维倍率！`, mx + 76, my + 68, mw - 208);
    }
    ctx.restore();

    const paths = [
      {
        id: 'xian',
        title: `✦ 天道成神 · 晋升【${g.rarity}.神】`,
        dgTitle: '成神副本（九天封神台）',
        bg: '#082f49',
        border: '#38bdf8',
        headBg: '#0369a1',
        accent: '#67e8f9',
        pillId: ac.xianPillItem || 'ascend_xian_pill',
        subId: ac.xianSubItem || 'ascend_xian_jade',
        lore1: '全属性飞跃：1~5重提升 +35% / +50% / +65% / +80% / +95%',
        lore2: '神道法则：伤害减免+9%~21% · 绝技增伤+14%~34% · 开局神力+16~36',
        lore3: '沙场异象：脚踏【九天神罡】清辉神阵，先手开大、万法不侵',
        btnGrad: ['#0284c7', '#0c4a6e'],
      },
      {
        id: 'mo',
        title: `✦ 魔道成魔 · 晋升【${g.rarity}.魔】`,
        dgTitle: '成魔副本（幽冥魔渊）',
        bg: '#2e1065',
        border: '#e879f9',
        headBg: '#86198f',
        accent: '#f472b6',
        pillId: ac.moPillItem || 'ascend_mo_pill',
        subId: ac.moSubItem || 'ascend_mo_crystal',
        lore1: '全属性飞跃：1~5重提升 +35% / +50% / +65% / +80% / +95%',
        lore2: '魔道法则：暴击伤害+20%~48% · 嗜血汲取+8%~20% · 狂魔攻速+11%~27%',
        lore3: '沙场异象：身披【九幽魔煞】血影战阵，刀刀暴击、以战养战',
        btnGrad: ['#a21caf', '#581c87'],
      },
    ];

    const cardW = 384, cardH = 354;
    paths.forEach((p, idx) => {
      const cx = mx + 18 + idx * (cardW + 16);
      const cy = my + 86;
      const isCur = curPath === p.id;
      const isSwitch = curPath && curPath !== p.id;
      const dgCleared = !!(st.clearedLevels && st.clearedLevels[p.id]);

      // 计算本次操作所需材料与铜钱/将魂
      let needPill = ac.initPillCost != null ? ac.initPillCost : 3;
      let needSub = ac.initSubCost != null ? ac.initSubCost : 6;
      let needGold = ac.initGoldCost != null ? ac.initGoldCost : 50000;
      let needSoul = ac.initSoulCost != null ? ac.initSoulCost : 300;
      if (isCur) {
        needPill = (ac.tierPillBase ?? 2) + (curTier - 1) * (ac.tierPillStep ?? 2);
        needSub = (ac.tierSubBase ?? 4) + (curTier - 1) * (ac.tierSubStep ?? 4);
        needGold = (ac.tierGoldBase ?? 40000) + (curTier - 1) * (ac.tierGoldStep ?? 25000);
        needSoul = (ac.tierSoulBase ?? 240) + (curTier - 1) * (ac.tierSoulStep ?? 160);
      } else if (isSwitch) {
        needPill = ac.switchPillCost ?? 2;
        needSub = ac.switchSubCost ?? 4;
        needGold = ac.switchGoldCost ?? 30000;
        needSoul = 0;
      }

      const havePill = App.State.getItemCount(p.pillId);
      const haveSub = App.State.getItemCount(p.subId);
      const pillName = (App.Config.ITEMS[p.pillId] && App.Config.ITEMS[p.pillId].name) || (p.id === 'xian' ? '九转封神丹' : '九幽化魔丹');
      const subName = (App.Config.ITEMS[p.subId] && App.Config.ITEMS[p.subId].name) || (p.id === 'xian' ? '太初神灵髓' : '炼狱魔煞晶');

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, {
        r: 12,
        bg: p.bg,
        border: isCur ? '#fde047' : p.border,
        lineWidth: isCur ? 2.4 : 1.6,
      });

      App.UI.drawPanel(ctx, cx + 10, cy + 10, cardW - 20, 34, {
        r: 8, bg: p.headBg, border: isCur ? '#fef08a' : p.accent, lineWidth: 1.4,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14.5px "PingFang SC", serif';
      ctx.fillText(isCur ? `${p.title} [当前主修]` : p.title, cx + cardW / 2, cy + 32);

      // 三行法则说明
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`✦ ${p.lore1}`, cx + 14, cy + 64, cardW - 28);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(`✦ ${p.lore2}`, cx + 14, cy + 84, cardW - 28);
      ctx.fillStyle = p.accent;
      ctx.fillText(`✦ ${p.lore3}`, cx + 14, cy + 104, cardW - 28);

      // 副本历劫证道状态条 + 一键前往按钮
      App.UI.drawPanel(ctx, cx + 12, cy + 116, cardW - 24, 38, {
        r: 7, bg: 'rgba(10, 8, 18, 0.58)', border: dgCleared ? '#4ade80' : '#f87171', lineWidth: 1.2,
      });
      ctx.fillStyle = dgCleared ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`${p.dgTitle}：${dgCleared ? '✓ 已通关证道' : '✗ 尚未通关'}`, cx + 22, cy + 139);
      ctx.restore();

      App.UI.drawButton(ctx, cx + cardW - 114, cy + 122, 94, 26, '去打材料副本', {
        r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10,
      }, () => {
        showAscendModal = false;
        App.Main.goScene('challenge', { tab: 'ascend' });
      });

      // 所需副本掉落材料双卡片展示
      const mats = [
        { id: p.pillId, name: pillName, have: havePill, need: needPill },
        { id: p.subId, name: subName, have: haveSub, need: needSub },
      ];
      mats.forEach((m, mi) => {
        const mxBox = cx + 12 + mi * 184;
        const myBox = cy + 162;
        const ok = m.have >= m.need;
        App.UI.drawPanel(ctx, mxBox, myBox, 176, 60, {
          r: 8, bg: 'rgba(10, 8, 18, 0.65)', border: ok ? '#4ade80' : '#94a3b8', lineWidth: 1.2,
        });
        App.Sprites.drawEquipIcon(ctx, m.id, mxBox + 8, myBox + 8, 44, { radius: 7, border: p.accent, lineWidth: 1.5 });
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(m.name, mxBox + 58, myBox + 26, 110);
        ctx.fillStyle = ok ? '#4ade80' : '#fca5a5';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`持有 ${m.have} / 需 ${m.need}`, mxBox + 58, myBox + 46);
        ctx.restore();
      });

      // 铜钱与将魂消耗行
      ctx.save();
      ctx.textAlign = 'center';
      const goldOk = (st.gold || 0) >= needGold;
      const soulOk = (st.soul || 0) >= needSoul;
      ctx.fillStyle = (goldOk && soulOk) ? '#fde68a' : '#fca5a5';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      const maxReached = isCur && curTier >= maxTier;
      const costLine = maxReached
        ? `★ 已臻至第 ${maxTier} 重圆满至高果位！`
        : `消耗：${needGold} 金币(铜钱)${needSoul > 0 ? `  +  ${needSoul} 将魂` : '（转修保留当前重数）'}`;
      ctx.fillText(costLine, cx + cardW / 2, cy + 244);
      ctx.restore();

      // 主操作按钮 + 未满足时的快捷引导
      if (isCur) {
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, maxReached ? `★ 已圆满 (${maxTier}/${maxTier}重)` : `突破至第 ${curTier + 1} 重 (${curTier}/${maxTier})`, {
          r: 10,
          grad: p.btnGrad,
          border: '#fef08a',
          fontSize: 13.5,
          subText: maxReached ? '威震九州 · 神魔绝巅' : '全属性+15% · 神魔法则进阶',
          disabled: maxReached,
        }, () => {
          App.State.ascendUpGeneral(gid);
        });
      } else if (isSwitch) {
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, `↻ 洗髓转修【${p.id === 'xian' ? g.rarity + '.神' : g.rarity + '.魔'}】`, {
          r: 10,
          grad: p.btnGrad,
          border: '#fef08a',
          fontSize: 13,
          subText: dgCleared ? `保留当前第 ${curTier} 重境界` : `需先通关${p.dgTitle}`,
        }, () => {
          if (!dgCleared) {
            App.UI.showToast(`请先通关一次【${p.dgTitle}】再进行转修！`, '#fbbf24');
            return;
          }
          App.State.switchAscendGeneral(gid);
        });
      } else {
        const canAscend = lvReady && dgCleared && havePill >= needPill && haveSub >= needSub && goldOk && soulOk;
        const btnTxt = p.id === 'xian' ? `☁ 渡劫成神 (${g.rarity}.神)` : `🔥 觉醒成魔 (${g.rarity}.魔)`;
        const subTxt = !lvReady
          ? `需武将满 Lv.${reqLv}（当前 Lv.${owned.lv}）`
          : (!dgCleared ? `需先通关${p.id === 'xian' ? '成神副本' : '成魔副本'}` : '晋升一重 · 激活专属神魔光环');
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, btnTxt, {
          r: 10,
          grad: canAscend ? p.btnGrad : ['#475569', '#334155'],
          border: canAscend ? '#fef08a' : '#94a3b8',
          fontSize: 13.5,
          subText: subTxt,
        }, () => {
          if (!lvReady) {
            App.UI.showToast(`请先将 ${g.name} 升至满级 Lv.${reqLv} 后再抉择成神或成魔！`, '#fbbf24');
            return;
          }
          if (!dgCleared) {
            showAscendModal = false;
            App.UI.showToast(`正在前往【${p.dgTitle}】历劫证道…`, '#fde047');
            App.Main.goScene('challenge', { tab: 'ascend' });
            return;
          }
          App.State.ascendGeneral(gid, p.id);
        });
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`材料出处：征战秘境 → 神魔渡劫 → ${p.dgTitle}`, cx + cardW / 2, cy + 328);
      ctx.restore();
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.roster = { enter, render, update, launchWeaponPreview, launchSkillPreview, hasActiveVfx: () => !!previewFx };
})(typeof globalThis !== 'undefined' ? globalThis : window);
