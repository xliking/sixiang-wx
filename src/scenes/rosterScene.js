(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let selectedGid = null;
  let selectedEqUid = null;
  let confirmExileGid = null;
  let showAll800 = true;
  let listPage = 0;
  let bagPage = 0;
  let previewFx = null;
  let previewCooldown = 0;

  function launchSkillPreview(gid) {
    const g = App.Config.GENERALS[gid];
    if (!g) return;
    const isFull = !!(g.isFullscreenSkill || (g.vfxSpec && g.vfxSpec.isFullscreen));
    const dur = isFull ? 1.85 : 1.65;
    if (App.Audio) App.Audio.playSfx('ultimate');
    previewFx = {
      generalId: gid,
      casterName: g.name,
      x: isFull ? 480 : 545,
      y: 318,
      casterX: 280,
      casterY: 318,
      facing: 1,
      skillName: g.skillName,
      isFullscreen: isFull,
      element: g.skillElement || 'thunder',
      vfxSpec: g.vfxSpec || null,
      life: dur,
      maxLife: dur,
    };
    previewCooldown = 0.45;
  }

  function update(dt) {
    if (!previewFx) return;
    if (previewFx.life > 0) {
      previewFx.life = Math.max(0, previewFx.life - dt);
    } else {
      previewCooldown -= dt;
      if (previewCooldown <= 0 && selectedGid) {
        launchSkillPreview(selectedGid);
      }
    }
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    const coreIds = App.Config.CORE_GENERAL_IDS || App.Config.GENERAL_IDS;
    const fullIds = App.Config.ALL_GENERAL_IDS || Object.keys(App.Config.GENERALS);
    const coreSet = new Set(coreIds);
    const basePool = showAll800 ? fullIds : Array.from(new Set([...Object.keys(st.ownedGenerals || {}), ...coreIds]));
    const sorted = [...basePool].sort((a, b) => {
      const oa = st.ownedGenerals[a] ? 1 : 0;
      const ob = st.ownedGenerals[b] ? 1 : 0;
      if (oa !== ob) return ob - oa;
      if (oa === 1) return App.State.getGeneralPower(b) - App.State.getGeneralPower(a);
      const ca = coreSet.has(a) ? 1 : 0;
      const cb = coreSet.has(b) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return (App.Config.GENERALS[a].stageOrder || 999) - (App.Config.GENERALS[b].stageOrder || 999);
    });
    if (!selectedGid || !App.Config.GENERALS[selectedGid]) selectedGid = sorted[0];

    // 左侧：名将分页列表（全量收录 800 位独立立绘名将与守将！）
    App.UI.drawPanel(ctx, 14, 62, 220, 412, { r: 12, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`聚义 ${Object.keys(st.ownedGenerals).length}/${fullIds.length}将 · 阵${st.deployIds.length}/5`, 22, 83);
    ctx.restore();
    App.UI.drawButton(ctx, 174, 68, 52, 20, showAll800 ? '全图鉴' : '仅核心', {
      r: 5, bg: showAll800 ? '#15803d' : '#78350f', border: '#fef08a', fontSize: 9.5,
    }, () => { showAll800 = !showAll800; listPage = 0; });

    const perPage = 8;
    const maxPage = Math.max(0, Math.ceil(sorted.length / perPage) - 1);
    listPage = Math.min(listPage, maxPage);
    const slice = sorted.slice(listPage * perPage, listPage * perPage + perPage);

    slice.forEach((gid, idx) => {
      const g = App.Config.GENERALS[gid];
      const owned = st.ownedGenerals[gid];
      const deployed = st.deployIds.includes(gid);
      const isSel = gid === selectedGid;
      const y = 94 + idx * 42;

      App.UI.drawButton(ctx, 22, y, 204, 36, '', {
        r: 16,
        bg: isSel ? '#9a3412' : (owned ? '#c27c44' : '#a8a29e'),
        border: isSel ? '#fde047' : '#5c2c16',
        lineWidth: isSel ? 2.2 : 1.2,
      }, () => {
        selectedGid = gid;
        selectedEqUid = null;
        confirmExileGid = null;
      });

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
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(owned ? `Lv.${owned.lv} ${g.name}` : `未降·${g.name}`, 54, y + 18);

      ctx.textAlign = 'right';
      ctx.font = 'bold 10px sans-serif';
      if (owned) {
        ctx.fillStyle = deployed ? '#fde047' : '#e2e8f0';
        ctx.fillText(`${deployed ? '战·' : ''}${App.State.getGeneralPower(gid)}`, 218, y + 18);
      } else {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(g.rarity, 218, y + 18);
      }
      ctx.restore();
    });

    App.UI.drawButton(ctx, 24, 436, 62, 28, '◀ 上页', { r: 6, bg: '#78350f', fontSize: 11, disabled: listPage <= 0 }, () => { listPage--; });
    App.UI.drawButton(ctx, 160, 436, 62, 28, '下页 ▶', { r: 6, bg: '#78350f', fontSize: 11, disabled: listPage >= maxPage }, () => { listPage++; });
    ctx.save();
    ctx.fillStyle = '#451a03'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${listPage + 1}/${maxPage + 1}`, 123, 454);
    ctx.restore();

    // 右侧：英雄详情 + 单人英雄战力 + 【流放武将】 + 6格穿戴装备
    const g = App.Config.GENERALS[selectedGid];
    const owned = st.ownedGenerals[selectedGid];
    const stats = App.State.getGeneralStats(selectedGid);
    const eqMap = App.State.getEquippedMap(selectedGid);

    App.UI.drawPanel(ctx, 242, 62, W - 256, 412, { r: 12, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.Portraits.drawGeneralPortrait(ctx, selectedGid, 254, 74, 92, { radius: 10, lineWidth: 2.2 });

    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 15px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${g.rarity}] ${g.name}`, 300, 182);
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`英雄战力 ${stats.power}`, 300, 199);
    ctx.restore();

    if (owned) {
      const deployed = st.deployIds.includes(selectedGid);
      App.UI.drawButton(ctx, 254, 208, 92, 27, deployed ? '撤下阵位' : '编入出战', {
        r: 7, grad: deployed ? ['#57534e', '#44403c'] : ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 11,
      }, () => {
        App.State.toggleDeploy(selectedGid);
      });

      const gCost = App.State.getCost('generalUp', owned.lv);
      App.UI.drawButton(ctx, 254, 240, 92, 27, `升级(${gCost})`, {
        r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
      }, () => {
        App.State.upgradeGeneral(selectedGid);
      });

      const sCost = App.State.getCost('generalStar', owned.star);
      App.UI.drawButton(ctx, 254, 272, 92, 27, owned.star >= 5 ? '已满星' : `升星(${sCost}魂)`, {
        r: 7, grad: ['#7e22ce', '#581c87'], border: '#e9d5ff', fontSize: 11, disabled: owned.star >= 5,
      }, () => {
        App.State.starUpGeneral(selectedGid);
      });

      // ★ 【流放武将】按钮（点击一次确认，再点流放返还将魂与铜钱，装备自动归库！）
      const isConfirm = confirmExileGid === selectedGid;
      App.UI.drawButton(ctx, 254, 304, 92, 27, isConfirm ? '确认流放?' : '流放武将', {
        r: 7, grad: isConfirm ? ['#dc2626', '#7f1d1d'] : ['#78350f', '#451a03'],
        border: isConfirm ? '#fef08a' : '#fca5a5',
        fontSize: 11,
      }, () => {
        if (!isConfirm) {
          confirmExileGid = selectedGid;
          App.UI.showToast(`再次点击【确认流放】将舍弃 ${g.name} 并返还大量铜钱将魂！`, '#fbbf24');
          return;
        }
        confirmExileGid = null;
        App.State.exileGeneral(selectedGid).then((res) => { if (res.ok) selectedGid = Object.keys(st.ownedGenerals)[0]; });
      });
    }

    // 英雄属性与专属技能栏
    App.UI.drawPanel(ctx, 356, 74, 578, 86, { r: 8, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`${g.title} · [${App.Config.UNIT_TYPES[g.type].name}]   绝技【${g.skillName}】：${g.skillDesc}`, 368, 94);

    const drawStatPill = (label, baseVal, bonusVal, x, y) => {
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(label, x, y);
      ctx.fillStyle = '#3b2614';
      App.UI.roundRect(ctx, x + 36, y - 13, 126, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${baseVal}`, x + 44, y);
      if (bonusVal > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`+${bonusVal}`, x + 96, y);
      }
    };
    drawStatPill('气血', stats.baseHp, stats.bonusHp, 368, 120);
    drawStatPill('武力', stats.baseAtk, stats.bonusAtk, 550, 120);
    drawStatPill('防御', stats.baseDef, stats.bonusDef, 732, 120);
    drawStatPill('暴击', `${Math.round(stats.crit * 100)}%`, 0, 368, 146);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`单将战力：${stats.power} (${owned ? `Lv.${owned.lv}·${owned.star}星` : '未招降'})`, 550, 146);
    ctx.restore();

    App.UI.drawButton(ctx, 830, 130, 94, 24, '✦ 绝技演示', {
      r: 6, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 11,
    }, () => {
      launchSkillPreview(selectedGid);
    });

    // 6格穿戴装备栏 + 套装共鸣实时显示
    App.UI.drawPanel(ctx, 356, 166, 578, 134, { r: 8, bg: '#8a6845', border: '#4a2c16', lineWidth: 1.5 });
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    const topSet = stats.activeSets && stats.activeSets[0];
    const setSummary = topSet
      ? `套装【${topSet.name}】(${topSet.count}/${topSet.total}) ${topSet.unlocked.length ? '★已激活共鸣加成！' : '凑齐2/4/6件激活套装属性'}`
      : '穿戴 24 套传世套装（凑齐 2 / 4 / 6 件自动激活强力套装共鸣属性！）';
    ctx.fillText(setSummary, 368, 185);
    ctx.restore();

    App.Config.EQUIP_SLOTS.forEach((slot, idx) => {
      const sx = 368 + idx * 92;
      const sy = 194;
      const eq = eqMap[slot.id];
      const tpl = eq ? App.Config.EQUIP_TEMPLATES[eq.tplId] : null;
      const q = tpl ? App.Config.QUALITIES[tpl.quality] : null;
      const isSelEq = eq && selectedEqUid === eq.uid;

      if (tpl) {
        App.Sprites.drawEquipIcon(ctx, tpl.id, sx, sy, 80, {
          radius: 10, border: isSelEq ? '#ffffff' : q.color, lineWidth: isSelEq ? 3.2 : 2.2,
        });
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(sx + 2, sy + 60, 76, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tpl.name.slice(0, 4)} +${eq.enhance}`, sx + 40, sy + 73);
        ctx.restore();
        App.UI.addHit(sx, sy, 80, 80, () => { selectedEqUid = eq.uid; });
      } else {
        App.UI.drawPanel(ctx, sx, sy, 80, 80, { r: 10, bg: '#573b22', border: '#a16207', lineWidth: 1.5 });
        ctx.save();
        ctx.fillStyle = '#d6b685';
        ctx.font = 'bold 13px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(slot.name, sx + 40, sy + 40);
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText('空槽', sx + 40, sy + 58);
        ctx.restore();
      }
    });

    if (selectedEqUid) {
      const eq = st.inventory.find((i) => i.uid === selectedEqUid);
      if (eq) {
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        App.UI.drawButton(ctx, 254, 340, 92, 28, '去锻器坊', {
          r: 7, grad: ['#ea580c', '#9a3412'], border: '#fef08a', fontSize: 11,
        }, () => App.Main.goScene('forge'));
        if (eq.equippedBy) {
          App.UI.drawButton(ctx, 254, 374, 92, 26, '卸下回仓库', {
            r: 7, bg: '#57534e', border: '#d6d3d1', fontSize: 10,
          }, () => {
            App.State.unequipItem(eq.uid).then((res) => { if (res.ok) { selectedEqUid = null; App.UI.showToast(`已卸下 ${tpl.name}`, '#e2e8f0'); } });
          });
        }
      }
    }

    // 底部快捷穿戴栏（仅展示名将专属装备，神兽装备在【四象兽栏】穿戴！）
    App.UI.drawPanel(ctx, 356, 306, 578, 158, { r: 8, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });
    const unequipped = st.inventory.filter((i) => {
      const t = App.Config.EQUIP_TEMPLATES[i.tplId];
      return t && !t.isBeastEquip && !i.equippedBy;
    });
    const bagPerPage = 6;
    const maxBagPage = Math.max(0, Math.ceil(unequipped.length / bagPerPage) - 1);
    bagPage = Math.min(bagPage, maxBagPage);

    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`快捷穿戴 (${unequipped.length}件闲置 · 点击穿戴，出售管理请点下方【军备仓库】)`, 368, 326);
    ctx.restore();

    if (maxBagPage > 0) {
      App.UI.drawButton(ctx, 826, 311, 46, 22, '◀', { r: 5, bg: '#4a2c16', fontSize: 10, disabled: bagPage <= 0 }, () => { bagPage--; });
      App.UI.drawButton(ctx, 878, 311, 46, 22, '▶', { r: 5, bg: '#4a2c16', fontSize: 10, disabled: bagPage >= maxBagPage }, () => { bagPage++; });
    }

    unequipped.slice(bagPage * bagPerPage, (bagPage + 1) * bagPerPage).forEach((eq, idx) => {
      const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
      const q = App.Config.QUALITIES[tpl.quality];
      const ix = 368 + idx * 92;
      const iy = 338;

      App.Sprites.drawEquipIcon(ctx, tpl.id, ix, iy, 78, { radius: 9, border: q.color, lineWidth: 2 });
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(ix + 2, iy + 56, 74, 20);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, ix + 39, iy + 70);
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText('点击穿戴', ix + 39, iy + 94);
      ctx.restore();

      App.UI.addHit(ix, iy, 78, 102, () => {
        if (!owned) { App.UI.showToast('请先招降该名将再穿戴装备！', '#f87171'); return; }
        App.State.equipItem(selectedGid, eq.uid).then((res) => { if (res.ok) { selectedEqUid = eq.uid; App.UI.showToast(`${g.name} 已穿戴 [${q.name}] ${tpl.name}！`, '#4ade80'); } });
      });
    });

    App.Scenes.map.drawBottomNav(ctx, 'roster');

    // ★ 800名将独门绝技演武试招台（支持一键切换上/下一将，逐一鉴赏全部800式高精特效！）
    if (previewFx) {
      App.UI.clearHits();
      ctx.save();
      ctx.fillStyle = 'rgba(8, 5, 3, 0.86)';
      ctx.fillRect(0, 0, W, H);

      const sx = 60, sy = 44, sw = W - 120, sh = H - 88;
      App.UI.drawPanel(ctx, sx, sy, sw, sh, { r: 14, bg: '#160d07', border: '#facc15', lineWidth: 2.2 });

      // 演武石台地面透视砖纹
      const groundG = ctx.createLinearGradient(sx, sy + 180, sx, sy + sh);
      groundG.addColorStop(0, '#29180e');
      groundG.addColorStop(1, '#120904');
      ctx.fillStyle = groundG;
      ctx.fillRect(sx + 4, sy + 185, sw - 8, sh - 189);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.14)';
      ctx.lineWidth = 1;
      for (let row = 0; row < 5; row++) {
        const ly = sy + 205 + row * 42;
        ctx.beginPath(); ctx.moveTo(sx + 16, ly); ctx.lineTo(sx + sw - 16, ly); ctx.stroke();
      }

      // 剪裁在演武台视窗内播放五层高精度绝技特效
      ctx.save();
      App.UI.roundRect(ctx, sx + 4, sy + 4, sw - 8, sh - 8, 12);
      ctx.clip();
      if (App.SkillVFX && previewFx.life > 0) {
        App.SkillVFX.render(ctx, previewFx, sx, sw);
      }
      ctx.restore();

      // 顶部武将与绝技信息栏
      const curIdx = Math.max(0, sorted.indexOf(selectedGid));
      App.Portraits.drawPortrait(ctx, selectedGid, sx + 18, sy + 14, 58, { radius: 8, lineWidth: 2 });
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${g.name}（${g.title}）· 独门绝技【${g.skillName}】`, sx + 88, sy + 36);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(`第 ${curIdx + 1} / ${sorted.length} 位名将专属特效  |  ${g.skillDesc}`, sx + 88, sy + 58);
      ctx.restore();

      // 底部演武操控栏：上一将 / 重播绝技 / 下一将 / 关闭
      const btnY = sy + sh - 48;
      App.UI.drawButton(ctx, W / 2 - 250, btnY, 112, 34, '◀ 上一位武将', {
        r: 8, grad: ['#57534e', '#292524'], border: '#fde68a', fontSize: 12,
      }, () => {
        const nextIdx = (curIdx - 1 + sorted.length) % sorted.length;
        selectedGid = sorted[nextIdx];
        listPage = Math.floor(nextIdx / perPage);
        launchSkillPreview(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 - 126, btnY, 116, 34, '↻ 重放绝技', {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12.5,
      }, () => {
        launchSkillPreview(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 + 2, btnY, 112, 34, '下一位武将 ▶', {
        r: 8, grad: ['#57534e', '#292524'], border: '#fde68a', fontSize: 12,
      }, () => {
        const nextIdx = (curIdx + 1) % sorted.length;
        selectedGid = sorted[nextIdx];
        listPage = Math.floor(nextIdx / perPage);
        launchSkillPreview(selectedGid);
      });

      App.UI.drawButton(ctx, W / 2 + 126, btnY, 112, 34, '✕ 关闭演示', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 12.5,
      }, () => {
        previewFx = null;
      });
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.roster = { render, update };
})(typeof globalThis !== 'undefined' ? globalThis : window);
