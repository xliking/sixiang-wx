(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let selectedBeastId = 'qinglong';
  let beastListPage = 0;
  let subTab = 'equip'; // 'equip' | 'bond' | 'guard'
  let showBeastAscendModal = false;
  let selectedEqUid = null;
  let selectedGuardSlot = 0;
  let bagPage = 0;
  let bondPage = 0;
  let guardPage = 0;

  const LIST_PER_PAGE = 4;

  function enter(params) {
    showBeastAscendModal = false;
    const p = params || {};
    const st = App.State.get();
    if (p.subTab && (p.subTab === 'equip' || p.subTab === 'bond' || p.subTab === 'guard')) {
      subTab = p.subTab;
    }
    if (p.beastId && App.Config.BEASTS[p.beastId]) {
      selectedBeastId = p.beastId;
    } else if (p.openAscend) {
      const ownedIds = Object.keys(st.ownedBeasts || {}).filter((k) => App.Config.BEASTS[k]);
      if (ownedIds.length) {
        ownedIds.sort((a, b) => {
          const oa = st.ownedBeasts[a], ob = st.ownedBeasts[b];
          return ((ob.lv || 1) * 20 + (ob.star || 1)) - ((oa.lv || 1) * 20 + (oa.star || 1));
        });
        selectedBeastId = ownedIds[0];
      }
    } else if (!App.Config.BEASTS[selectedBeastId]) {
      selectedBeastId = App.Config.BEAST_IDS[0] || 'qinglong';
    }
    const idx = App.Config.BEAST_IDS.indexOf(selectedBeastId);
    if (idx >= 0) beastListPage = Math.floor(idx / LIST_PER_PAGE);
    if (p.openAscend && selectedBeastId && st.ownedBeasts && st.ownedBeasts[selectedBeastId]) {
      showBeastAscendModal = true;
    }
  }

  function render(ctx) {
    const beastIds = App.Config.BEAST_IDS || [];
    if (!App.Config.BEASTS[selectedBeastId]) selectedBeastId = beastIds[0] || 'qinglong';
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#1c0e07';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // ================= 左侧：十二神兽玄金名录栏（支持翻页查看四象/四凶/上古神兽） =================
    App.UI.drawPanel(ctx, 14, 58, 224, 474, { r: 12, bg: '#2d170b', border: '#b4823c', lineWidth: 2 });

    const ownedBeastCnt = beastIds.filter((id) => !!st.ownedBeasts[id]).length;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12.5px "PingFang SC", serif';
    ctx.fillText(`万兽灵栏 (${ownedBeastCnt}/${beastIds.length})`, 24, 80);
    ctx.restore();

    App.UI.drawButton(ctx, 162, 65, 66, 22, '抓捕秘境', {
      r: 6, grad: ['#0f766e', '#115e59'], border: '#99f6e4', fontSize: 9.5,
    }, () => App.Main.goScene('beastDungeon', { beastId: selectedBeastId }));

    const totalBeastPages = Math.max(1, Math.ceil(beastIds.length / LIST_PER_PAGE));
    beastListPage = Math.max(0, Math.min(beastListPage, totalBeastPages - 1));
    const visibleBeasts = beastIds.slice(beastListPage * LIST_PER_PAGE, (beastListPage + 1) * LIST_PER_PAGE);

    visibleBeasts.forEach((bid, idx) => {
      const bCfg = App.Config.BEASTS[bid];
      if (!bCfg) return;
      const owned = st.ownedBeasts[bid];
      const bStats = App.State.getBeastStats(bid);
      const isSel = selectedBeastId === bid;
      const y = 94 + idx * 97;

      App.UI.drawPanel(ctx, 22, y, 208, 89, {
        r: 10,
        bg: isSel ? '#4b2410' : 'rgba(18, 9, 5, 0.86)',
        border: isSel ? bCfg.glow : '#6b4423',
        lineWidth: isSel ? 2.4 : 1.3,
      });

      ctx.save();
      if (!owned) ctx.globalAlpha = 0.48;
      App.Portraits.drawBeastPortrait(ctx, bid, 30, y + 12, 64, { radius: 10, border: bCfg.glow, lineWidth: 1.8 });
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'left';
      const listDispName = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(bid, owned) : bCfg.name;
      ctx.fillStyle = owned && owned.ascend === 'xian' ? '#67e8f9' : (owned && owned.ascend === 'mo' ? '#f472b6' : bCfg.glow);
      ctx.font = 'bold 13.5px "PingFang SC", serif';
      ctx.fillText(listDispName, 102, y + 27, 120);

      if (owned && bStats) {
        const isSup = st.activeBeastId !== bid && (st.supportBeastIds || []).indexOf(bid) >= 0;
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 10.5px sans-serif';
        const lvTxt = `Lv.${bStats.lv} `;
        ctx.fillText(lvTxt, 102, y + 48);
        const lvW = ctx.measureText(lvTxt).width;
        if (bStats.star <= 5) {
          ctx.fillStyle = '#facc15';
          ctx.fillText('★'.repeat(bStats.star), 102 + lvW, y + 48, 120 - lvW);
        } else {
          ctx.fillStyle = '#fb7185';
          ctx.font = 'bold 9.5px sans-serif';
          ctx.fillText(`${'★'.repeat(Math.min(5, bStats.star))}✦${bStats.star}★`, 102 + lvW, y + 48, 120 - lvW);
        }
        ctx.fillStyle = st.activeBeastId === bid ? '#4ade80' : (isSup ? '#38bdf8' : '#cbd5e1');
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `${st.activeBeastId === bid ? '●上阵中 ' : (isSup ? '◆护法中 ' : '')}战力 ${bStats.power}`,
          102, y + 68, 120
        );
      } else {
        const reqLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(bid) : 15;
        const canCatch = (st.lordLevel || 1) >= reqLv;
        ctx.fillStyle = canCatch ? '#86efac' : '#94a3b8';
        ctx.font = '10.5px "PingFang SC", sans-serif';
        ctx.fillText(`未收服 · Lv.${reqLv}可抓`, 102, y + 48, 120);
        ctx.fillStyle = '#d6b685';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(bCfg.tierName || bCfg.direction, 102, y + 68, 120);
      }
      ctx.restore();

      App.UI.addHit(22, y, 208, 89, () => {
        selectedBeastId = bid;
        selectedEqUid = null;
      });
    });

    // 左侧列表底部极简左右翻页条
    App.UI.drawButton(ctx, 24, 490, 56, 30, '◀ 上页', {
      r: 7, bg: '#451a03', border: '#b45309', fontSize: 10.5, disabled: beastListPage <= 0,
    }, () => { beastListPage = Math.max(0, beastListPage - 1); });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`${beastListPage + 1} / ${totalBeastPages}`, 126, 505);
    ctx.restore();

    App.UI.drawButton(ctx, 172, 490, 56, 30, '下页 ▶', {
      r: 7, bg: '#451a03', border: '#b45309', fontSize: 10.5, disabled: beastListPage >= totalBeastPages - 1,
    }, () => { beastListPage = Math.min(totalBeastPages - 1, beastListPage + 1); });

    // ================= 右侧：圣兽祭坛主面板（满高 y=58..532 + 右上角 ✕ 关闭圆章） =================
    const bCfg = App.Config.BEASTS[selectedBeastId];
    const owned = st.ownedBeasts[selectedBeastId];
    const bStats = App.State.getBeastStats(selectedBeastId);
    const eqMap = App.State.getBeastEquippedMap(selectedBeastId);

    App.UI.drawPanel(ctx, 246, 58, W - 260, 474, { r: 12, bg: '#2d170b', border: '#b4823c', lineWidth: 2 });

    // 1. 顶部圣兽主信息殿堂卡（留出右上角 ✕ 按钮位）
    App.UI.drawPanel(ctx, 258, 70, W - 284, 150, {
      r: 10, bg: 'rgba(18, 9, 4, 0.80)', border: 'rgba(212, 163, 75, 0.55)', lineWidth: 1.5,
    });

    const selectedUnlockLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(selectedBeastId) : 15;
    const canCatchSelected = (st.lordLevel || 1) >= selectedUnlockLv;

    ctx.save();
    const auraG = ctx.createRadialGradient(322, 145, 10, 322, 145, 66);
    auraG.addColorStop(0, bCfg.glow);
    auraG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = auraG;
    ctx.beginPath(); ctx.arc(322, 145, 66, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const equipSetVfx = App.Config.resolveSetVfx ? App.Config.resolveSetVfx(Object.values(eqMap)) : null;
    const beastSetVfx = equipSetVfx || (bStats && bStats.ascendInfo ? bStats.ascendInfo.auraVfx : null);
    if (beastSetVfx && App.Sprites.drawUiSetAura) {
      App.Sprites.drawUiSetAura(ctx, 322, 142, 62, beastSetVfx);
    }
    App.Portraits.drawBeastPortrait(ctx, selectedBeastId, 268, 88, 108, {
      radius: 12,
      border: beastSetVfx ? beastSetVfx.auraColor : bCfg.glow,
      lineWidth: beastSetVfx ? 2.8 : 2.5,
    });

    const infoLeftX = 388;
    const actX = 724, actW = 164;
    const infoMaxW = actX - infoLeftX - 10;
    const beastMaxLv = (App.Config.PARAMS && App.Config.PARAMS.beastMaxLevel) || 120;
    const beastMaxStar = (App.Config.PARAMS && App.Config.PARAMS.beastMaxStar) || 10;
    const ac = App.Config.ASCENSION || {};
    const beastAscReqLv = ac.beastReqLevel || beastMaxLv;
    const beastAscReqStar = ac.beastReqStar || beastMaxStar;
    const dispName = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(selectedBeastId, owned) : bCfg.name;
    const bAscInfo = bStats && bStats.ascendInfo;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = bAscInfo ? bAscInfo.color : bCfg.glow;
    ctx.font = 'bold 18.5px "PingFang SC", serif';
    ctx.fillText(dispName, infoLeftX, 96, 138);
    const nameW = Math.min(138, ctx.measureText(dispName).width);

    if (bAscInfo) {
      const badgeX = infoLeftX + nameW + 6;
      const badgeTxt = `${bAscInfo.shortTag}·${bAscInfo.realm}`;
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      const bw = Math.min(92, Math.ceil(ctx.measureText(badgeTxt).width) + 12);
      ctx.fillStyle = bAscInfo.bg;
      App.UI.roundRect(ctx, badgeX, 81, bw, 17, 5);
      ctx.fill();
      ctx.strokeStyle = bAscInfo.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(badgeTxt, badgeX + bw / 2, 93, bw - 6);
      ctx.textAlign = 'left';
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`战力 ${bStats.power}`, infoLeftX + infoMaxW, 96);
    ctx.textAlign = 'left';

    // 10星血脉觉醒星轨（1~5★金星，6~10★神血赤紫星） + 本命兵种加成
    ctx.font = 'bold 12px sans-serif';
    for (let si = 0; si < beastMaxStar; si++) {
      const lit = bStats.star >= si + 1;
      ctx.fillStyle = lit ? (si >= 5 ? '#fb7185' : '#facc15') : 'rgba(148, 163, 184, 0.45)';
      ctx.fillText(lit ? '★' : '☆', infoLeftX + si * 12.6 + (si >= 5 ? 4 : 0), 115);
    }
    const starEndX = infoLeftX + beastMaxStar * 12.6 + 8;
    ctx.fillStyle = bStats.star >= beastMaxStar ? '#fb7185' : '#fde047';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.fillText(`${bStats.star}/${beastMaxStar}★`, starEndX, 114.5);

    const favTypeName = (App.Config.UNIT_TYPES && bCfg.favoredType && App.Config.UNIT_TYPES[bCfg.favoredType])
      ? App.Config.UNIT_TYPES[bCfg.favoredType].name
      : '全军';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.fillText(`★本命·${favTypeName}(+20%)`, infoLeftX + infoMaxW, 114.5, 108);
    ctx.textAlign = 'left';

    ctx.fillStyle = owned ? '#cbd5e1' : (canCatchSelected ? '#86efac' : '#cbd5e1');
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(
      owned
        ? `等级 Lv.${bStats.lv}/${beastMaxLv}   灵气 (${bStats.exp}/${bStats.needExp})`
        : `栖息秘境：${bCfg.direction}（主公 Lv.${selectedUnlockLv} 开启抓捕）`,
      infoLeftX, 133, infoMaxW
    );
    App.UI.drawBar(ctx, infoLeftX, 138, infoMaxW - 2, 6, owned ? (bStats.exp / bStats.needExp) : 0, bAscInfo ? bAscInfo.color : bCfg.glow, '#0f172a');

    const statsList = [
      { k: '气血', v: bStats.hp, b: bStats.bonusHp },
      { k: '攻击', v: bStats.atk, b: bStats.bonusAtk },
      { k: '防御', v: bStats.def, b: bStats.bonusDef },
      { k: '暴击', v: `${Math.round(bStats.crit * 100)}%`, b: 0 },
    ];
    statsList.forEach((item, idx) => {
      const sx = infoLeftX + idx * 82;
      const sy = 150;
      ctx.fillStyle = 'rgba(56, 30, 14, 0.90)';
      App.UI.roundRect(ctx, sx, sy, 78, 22, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText(`${item.k} ${item.v}`, sx + 5, sy + 14.5, item.b > 0 ? 48 : 68);
      if (item.b > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`+${item.b}`, sx + 52, sy + 14.5, 24);
      }
    });

    const skillText = `绝技【${bCfg.skillName}】：${bCfg.skillDesc}`;
    ctx.fillStyle = '#fde68a';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(skillText, infoLeftX, 191, infoMaxW);

    if (bAscInfo) {
      ctx.fillStyle = bAscInfo.color;
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText(
        `✦ 神魔道果【${bAscInfo.title}】：全维 +${Math.round((bAscInfo.statMult - 1) * 100)}% · 契约增幅 +${Math.round((bAscInfo.bondMult - 1) * 100)}%`,
        infoLeftX, 209, infoMaxW
      );
    } else if (owned) {
      const canAscNow = bStats.lv >= beastAscReqLv && bStats.star >= beastAscReqStar;
      ctx.fillStyle = canAscNow ? '#86efac' : '#94a3b8';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(
        canAscNow
          ? `✦ 已圆满 ${beastAscReqStar}★ · Lv.${beastAscReqLv}！点击右侧【神兽封神】挑战神魔副本蜕变 神.${bCfg.name} / 魔.${bCfg.name}`
          : `✦ 觉醒满 ${beastAscReqStar}★ 且达 Lv.${beastAscReqLv} 后可挑战神兽神魔副本，晋升【神.${bCfg.name} / 魔.${bCfg.name}】`,
        infoLeftX, 209, infoMaxW
      );
    }
    ctx.restore();

    if (owned) {
      const feedCost = App.State.getCost('beastFeed', bStats.lv);
      const soulCost = App.State.getCost('beastStar', bStats.star);
      const isAct = st.activeBeastId === selectedBeastId;
      const atMaxBeastLv = bStats.lv >= beastMaxLv;
      const atMaxBeastStar = bStats.star >= beastMaxStar;
      const beastAscReady = bStats.lv >= beastAscReqLv && bStats.star >= beastAscReqStar;

      App.UI.drawButton(ctx, actX, 78, 98, 30, atMaxBeastLv ? `已满${beastMaxLv}级` : `喂养(${feedCost})`, {
        r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10, disabled: atMaxBeastLv,
      }, () => {
        App.State.upgradeBeast(selectedBeastId, 1);
      });

      App.UI.drawButton(ctx, actX + 102, 78, 62, 30, '⚡连喂10', {
        r: 7, grad: ['#ea580c', '#9a3412'], border: '#fde68a', fontSize: 9.5, disabled: atMaxBeastLv,
      }, () => {
        App.State.upgradeBeast(selectedBeastId, 10);
      });

      App.UI.drawButton(ctx, actX, 112, actW, 30, atMaxBeastStar ? `已觉醒满星 ${beastMaxStar}★` : `血脉觉醒 (${soulCost}将魂)`, {
        r: 7, grad: ['#7e22ce', '#581c87'], border: '#f5d0fe', fontSize: 10.5,
        disabled: atMaxBeastStar,
      }, () => {
        App.State.starUpBeast(selectedBeastId);
      });

      const ascBtnTxt = owned.ascend === 'xian'
        ? `✦ 神·${owned.ascendTier || 1}重突破`
        : (owned.ascend === 'mo'
          ? `🔥 魔·${owned.ascendTier || 1}重突破`
          : (beastAscReady ? '✦ 神兽封神（可渡劫）' : `✦ 神魔飞升(${beastAscReqLv}级${beastAscReqStar}★)`));
      const ascBtnGrad = owned.ascend === 'xian'
        ? ['#0284c7', '#0c4a6e']
        : (owned.ascend === 'mo' ? ['#a21caf', '#581c87'] : (beastAscReady ? ['#0891b2', '#6d28d9'] : ['#475569', '#334155']));
      App.UI.drawButton(ctx, actX, 146, actW, 30, ascBtnTxt, {
        r: 7, grad: ascBtnGrad, border: beastAscReady || owned.ascend ? '#67e8f9' : '#cbd5e1', fontSize: 10,
      }, () => {
        showBeastAscendModal = true;
      });

      App.UI.drawButton(ctx, actX, 180, actW, 30, isAct ? '撤下休息（不上阵）' : '任命上阵（沙场冲锋）', {
        r: 7, grad: isAct ? ['#475569', '#334155'] : ['#15803d', '#166534'], border: isAct ? '#cbd5e1' : '#bbf7d0', fontSize: 10.5,
      }, () => {
        App.State.setActiveBeast(isAct ? null : selectedBeastId).then((res) => {
          if (res.ok) App.UI.showToast(isAct ? `已撤下【${dispName}】休息待命` : `【${dispName}】已随军上阵！`, '#4ade80');
        });
      });
    } else {
      App.UI.drawButton(
        ctx, actX, 98, actW, 48,
        canCatchSelected ? `前往抓捕 ${bCfg.shortName}` : `🔒 Lv.${selectedUnlockLv} 抓捕${bCfg.shortName}`,
        {
          r: 10,
          grad: canCatchSelected ? ['#f97316', '#7c2d12'] : ['#475569', '#334155'],
          border: canCatchSelected ? '#fef08a' : '#94a3b8',
          fontSize: 12,
          subText: canCatchSelected ? '击败神兽即可几率收服' : `当前主公 Lv.${st.lordLevel || 1}`,
        },
        () => {
          if (!canCatchSelected) {
            App.UI.showToast(`主公达到 Lv.${selectedUnlockLv} 方可讨伐并抓捕【${bCfg.name}】！`, '#fbbf24');
          }
          App.Main.goScene('beastDungeon', { beastId: selectedBeastId });
        }
      );

      App.UI.drawButton(ctx, actX, 156, actW, 34, '铜钱集市搜罗兽装', {
        r: 8, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 11,
      }, () => App.Main.goScene('shop'));
    }

    // 右上角统一 ✕ 关闭圆章按钮
    App.UI.drawCloseButton(ctx, W - 56, 76, 32, () => App.Main.goScene('map'));

    // 2. 下半区页签栏（专属兽装 / 契约共鸣 / 四象护法）
    const boundName = owned && owned.boundGeneralId && App.Config.GENERALS[owned.boundGeneralId]
      ? App.Config.GENERALS[owned.boundGeneralId].name
      : '未缔结';
    const validSupIds = (st.supportBeastIds || []).filter((id) => id && st.ownedBeasts[id] && id !== st.activeBeastId).slice(0, 2);

    App.UI.drawButton(ctx, 258, 230, 150, 32, '神兽装备 (4槽)', {
      r: 8,
      grad: subTab === 'equip' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'equip' ? '#fef08a' : '#6b4423',
      fontSize: 11.5,
    }, () => { subTab = 'equip'; });

    App.UI.drawButton(ctx, 414, 230, 178, 32, `契约共鸣 (${boundName})`, {
      r: 8,
      grad: subTab === 'bond' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'bond' ? '#fef08a' : '#6b4423',
      fontSize: 11.5,
    }, () => { subTab = 'bond'; });

    App.UI.drawButton(ctx, 598, 230, 168, 32, `四象护法 (助战${validSupIds.length}/2)`, {
      r: 8,
      grad: subTab === 'guard' ? ['#0284c7', '#0c4a6e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'guard' ? '#67e8f9' : '#6b4423',
      fontSize: 11.5,
    }, () => { subTab = 'guard'; });

    const scrollCnt = App.State.getItemCount(App.Config.SPECIAL.beastScrollItem);
    if (owned && scrollCnt > 0) {
      App.UI.drawButton(ctx, 774, 230, 160, 32, `灵简+280经验(剩${scrollCnt})`, {
        r: 8, grad: ['#0284c7', '#0369a1'], border: '#bae6fd', fontSize: 10.5,
      }, () => {
        App.State.feedBeastScroll(selectedBeastId);
      });
    }

    // ================= 子页签 A：神兽 4 槽装备祭坛 + 右侧闲置兽装匣（纵深拓展至 y=520） =================
    if (subTab === 'equip') {
      App.UI.drawPanel(ctx, 258, 270, 366, 250, {
        r: 10, bg: 'rgba(18, 9, 4, 0.78)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });

      ctx.save();
      ctx.textAlign = 'left';
      const topBeastSet = bStats.activeSets && bStats.activeSets[0];
      if (topBeastSet) {
        const resTxt = topBeastSet.resonanceActive
          ? ` ★${topBeastSet.ascendAffinity === 'xian' ? '神道' : '魔道'}共鸣+${Math.round((topBeastSet.resonancePct || 0.12) * 100)}%！`
          : (topBeastSet.unlocked.length ? ' ★已激活共鸣！' : ' 凑齐2/4件激活');
        ctx.fillStyle = topBeastSet.unlocked.length ? '#4ade80' : '#fde68a';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `✦ 兽装套装【${topBeastSet.name}】(${topBeastSet.count}/${topBeastSet.total})${resTxt}`,
          272, 294, 340
        );
      } else {
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText('神兽穿戴槽（集齐2/4件同名兽装激活圣兽套装共鸣）', 272, 294, 340);
      }
      ctx.restore();

      App.Config.BEAST_EQUIP_SLOTS.forEach((slot, idx) => {
        const sx = 272 + idx * 86;
        const sy = 314;
        const eq = eqMap[slot.id];
        const tpl = eq ? App.Config.EQUIP_TEMPLATES[eq.tplId] : null;
        const q = tpl ? App.Config.QUALITIES[tpl.quality] : null;
        const isSelEq = eq && selectedEqUid === eq.uid;

        if (tpl) {
          App.Sprites.drawEquipIcon(ctx, tpl.id, sx, sy, 78, {
            radius: 10, border: isSelEq ? '#ffffff' : q.color, lineWidth: isSelEq ? 3.2 : 2.2,
            enhance: eq.enhance, star: eq.star, advance: eq.advance,
          });
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(sx + 2, sy + 58, 74, 18);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, sx + 39, sy + 71);
          ctx.restore();
          App.UI.addHit(sx, sy, 78, 78, () => { selectedEqUid = eq.uid; });
        } else {
          App.UI.drawPanel(ctx, sx, sy, 78, 78, { r: 10, bg: 'rgba(46, 25, 13, 0.90)', border: '#784820', lineWidth: 1.4 });
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.16)';
          ctx.beginPath(); ctx.arc(sx + 39, sy + 39, 25, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#d6b685';
          ctx.font = 'bold 13px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(slot.name, sx + 39, sy + 37);
          ctx.fillStyle = '#78716c';
          ctx.font = '10px "PingFang SC", sans-serif';
          ctx.fillText('待穿戴', sx + 39, sy + 55);
          ctx.restore();
        }
      });

      const selEq = selectedEqUid ? st.inventory.find((i) => i.uid === selectedEqUid) : null;
      if (selEq && App.Config.EQUIP_TEMPLATES[selEq.tplId]) {
        const tpl = App.Config.EQUIP_TEMPLATES[selEq.tplId];
        const eb = App.Config.getEquipBonus(selEq);
        const enhCost = App.State.getCost('enhance', selEq.enhance);
        ctx.save();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${tpl.name} +${selEq.enhance}（攻+${eb.atk} 血+${eb.hp} 防+${eb.def}）`, 272, 424);
        ctx.restore();

        App.UI.drawButton(ctx, 272, 444, 166, 36, `精炼强化 (${enhCost}铜钱)`, {
          r: 8, grad: ['#ea580c', '#9a3412'], border: '#fef08a', fontSize: 11.5,
        }, () => {
          App.State.enhanceEquip(selEq.uid);
        });

        if (selEq.equippedByBeast) {
          App.UI.drawButton(ctx, 448, 444, 152, 36, '卸下兽装回库', {
            r: 8, bg: '#475569', border: '#cbd5e1', fontSize: 11.5,
          }, () => {
            App.State.unequipItem(selEq.uid).then((res) => { if (res.ok) { selectedEqUid = null; App.UI.showToast(`已卸下【${tpl.name}】`, '#fde047'); } });
          });
        }
      } else {
        ctx.save();
        ctx.fillStyle = '#a8a29e';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('点击已穿戴兽装可精炼强化或卸下；点击右侧闲置兽装一键穿戴', 272, 456, 342);
        ctx.restore();
      }

      // 右半区：闲置兽装匣
      App.UI.drawPanel(ctx, 634, 270, 300, 250, {
        r: 10, bg: 'rgba(18, 9, 4, 0.78)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });
      const idleBeastEquips = st.inventory.filter((eq) => {
        const t = App.Config.EQUIP_TEMPLATES[eq.tplId];
        return t && t.isBeastEquip && !eq.equippedByBeast;
      });
      const bCols = 4;
      const perPage = 8;
      const maxPage = Math.max(0, Math.ceil(idleBeastEquips.length / perPage) - 1);
      bagPage = Math.min(bagPage, maxPage);

      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`闲置兽装 (${idleBeastEquips.length}件)`, 644, 290, 146);
      ctx.restore();

      App.UI.drawButton(ctx, 796, 275, 74, 22, '⚡一键穿装', {
        r: 5, grad: ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 9.5,
        disabled: !owned || App.State.isBusy(),
      }, () => {
        if (!owned) return;
        App.State.autoEquipBeast(selectedBeastId);
      });
      App.UI.drawButton(ctx, 874, 275, 50, 22, '全卸', {
        r: 5, bg: '#475569', border: '#cbd5e1', fontSize: 9.5,
        disabled: !owned || !Object.keys(eqMap).length || App.State.isBusy(),
      }, () => {
        if (!owned) return;
        App.State.unequipAllBeast(selectedBeastId).then((res) => { if (res.ok) selectedEqUid = null; });
      });

      const bSz = 54;
      if (idleBeastEquips.length === 0) {
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('当前暂无闲置兽装', 784, 376);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10.5px "PingFang SC", sans-serif';
        ctx.fillText('讨伐万兽秘境或逛集市均可获得', 784, 398);
        ctx.restore();
      } else {
        idleBeastEquips.slice(bagPage * perPage, (bagPage + 1) * perPage).forEach((eq, idx) => {
          const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
          const q = App.Config.QUALITIES[tpl.quality];
          const col = idx % bCols;
          const row = Math.floor(idx / bCols);
          const ix = 646 + col * 70;
          const iy = 304 + row * 84;

          App.Sprites.drawEquipIcon(ctx, tpl.id, ix, iy, bSz, { radius: 8, border: q.color, lineWidth: 1.8 });
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(ix + 2, iy + bSz - 14, bSz - 4, 12);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, ix + bSz / 2, iy + bSz - 5, bSz - 4);
          ctx.fillStyle = owned ? '#4ade80' : '#94a3b8';
          ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
          ctx.fillText(owned ? '点击穿戴' : '收服后穿', ix + bSz / 2, iy + bSz + 13);
          ctx.restore();

          App.UI.addHit(ix, iy, bSz, bSz + 18, () => {
            if (!owned) {
              App.UI.showToast(`请先达到 Lv.${selectedUnlockLv} 在【万兽秘境】收服 ${bCfg.shortName}！`, '#fbbf24');
              return;
            }
            App.State.equipBeastItem(selectedBeastId, eq.uid).then((res) => { if (res.ok) selectedEqUid = eq.uid; });
          });
        });
      }

      if (maxPage > 0) {
        App.UI.drawPagination(ctx, 646, 484, 276, 26, bagPage, maxPage + 1, (p) => { bagPage = p; });
      }
    } else if (subTab === 'bond') {
      // ================= 子页签 B：名将契约共鸣台（本命兵种名将额外 +20% 契约加成） =================
      App.UI.drawPanel(ctx, 258, 270, W - 284, 250, {
        r: 10, bg: 'rgba(18, 9, 4, 0.78)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${bCfg.bondDesc}（★本命【${favTypeName}】将领缔结享 +20% 契约加成，并共享兽装 25% 属性！）`,
        274, 296, W - 314
      );
      ctx.restore();

      if (!owned) {
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`收服【${bCfg.name}】后，点击下方任意名将即可缔结守护契约！`, 596, 396);
        ctx.restore();
      } else {
        const deploySet = new Set(st.deployIds || []);
        const ownedGids = Object.keys(st.ownedGenerals).sort((a, b) => {
          const da = deploySet.has(a) ? 1 : 0;
          const db = deploySet.has(b) ? 1 : 0;
          if (da !== db) return db - da;
          const fa = (App.Config.GENERALS[a] && App.Config.GENERALS[a].type === bCfg.favoredType) ? 1 : 0;
          const fb = (App.Config.GENERALS[b] && App.Config.GENERALS[b].type === bCfg.favoredType) ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return App.State.getGeneralPower(b) - App.State.getGeneralPower(a);
        });
        const bondPerPage = 8;
        const maxBondPage = Math.max(0, Math.ceil(ownedGids.length / bondPerPage) - 1);
        bondPage = Math.min(bondPage, maxBondPage);

        ownedGids.slice(bondPage * bondPerPage, (bondPage + 1) * bondPerPage).forEach((gid, idx) => {
          const gx = 274 + idx * 81;
          const gy = 320;
          const gItem = App.Config.GENERALS[gid];
          const isBound = owned.boundGeneralId === gid;
          const isDep = deploySet.has(gid);
          const isFav = gItem && gItem.type === bCfg.favoredType;
          App.Portraits.drawGeneralPortrait(ctx, gid, gx, gy, 66, {
            radius: 10, border: isBound ? '#4ade80' : (isFav ? '#38bdf8' : (isDep ? '#fde047' : '#784820')), lineWidth: isBound ? 3 : 1.8,
          });
          ctx.save();
          if (isFav) {
            ctx.fillStyle = 'rgba(8, 51, 68, 0.90)';
            App.UI.roundRect(ctx, gx + 4, gy + 4, 58, 13, 4);
            ctx.fill();
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.fillStyle = '#67e8f9';
            ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★本命+20%', gx + 33, gy + 13.5);
          }
          ctx.textAlign = 'center';
          ctx.fillStyle = isBound ? '#4ade80' : (isDep ? '#fde68a' : '#fef3c7');
          ctx.font = 'bold 11px "PingFang SC", sans-serif';
          ctx.fillText(gItem.name, gx + 33, gy + 82);
          if (isBound) {
            ctx.fillStyle = '#facc15';
            ctx.fillText(isFav ? '★本命契约' : '★契约共鸣', gx + 33, gy + 98);
          } else if (isDep) {
            ctx.fillStyle = '#86efac';
            ctx.font = '10px "PingFang SC", sans-serif';
            ctx.fillText('出战中', gx + 33, gy + 98);
          }
          ctx.restore();

          App.UI.addHit(gx, gy, 66, 104, () => {
            App.State.bindBeastToGeneral(selectedBeastId, gid).then((res) => { if (res.ok && res.msg) App.UI.showToast(res.msg, '#4ade80'); });
          });
        });

        if (maxBondPage > 0) {
          App.UI.drawPagination(ctx, 274, 478, W - 314, 28, bondPage, maxBondPage + 1, (p) => { bondPage = p; });
        }
      }
    } else {
      // ================= 子页签 C：四象护法助战阵（最多 2 只闲置神兽助战） =================
      App.UI.drawPanel(ctx, 258, 270, W - 284, 250, {
        r: 10, bg: 'rgba(12, 18, 28, 0.84)', border: 'rgba(56, 189, 248, 0.50)', lineWidth: 1.4,
      });
      const supSharePct = Math.round(((App.Config.PARAMS && App.Config.PARAMS.supportBeastShare) || 0.30) * 100);
      ctx.save();
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `✦ 四象护法大阵：配置最多 2 只闲置神兽入驻，继承 ${supSharePct}% 神兽战力，开局赐全军 +8%/只 护盾与 +6%/只 加攻（享50%战斗灵气）！`,
        272, 294, W - 310
      );
      ctx.restore();

      const supSlots = [validSupIds[0] || null, validSupIds[1] || null];
      if (selectedGuardSlot !== 0 && selectedGuardSlot !== 1) selectedGuardSlot = 0;

      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const sx = 272, sy = 308 + sIdx * 102, sw = 276, sh = 94;
        const sbid = supSlots[sIdx];
        const sbCfg = sbid ? App.Config.BEASTS[sbid] : null;
        const sbs = sbid ? App.State.getBeastStats(sbid) : null;
        const isSelSlot = selectedGuardSlot === sIdx;

        App.UI.drawPanel(ctx, sx, sy, sw, sh, {
          r: 9,
          bg: sbCfg ? 'rgba(15, 36, 54, 0.90)' : 'rgba(24, 24, 27, 0.72)',
          border: isSelSlot ? '#fde047' : (sbCfg ? '#38bdf8' : '#475569'),
          lineWidth: isSelSlot ? 2.2 : 1.4,
        });

        if (sbCfg && sbs) {
          const sbDisp = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(sbid, st.ownedBeasts[sbid]) : sbCfg.name;
          App.Portraits.drawBeastPortrait(ctx, sbid, sx + 10, sy + 15, 64, { radius: 9, border: sbCfg.glow, lineWidth: 1.8 });
          ctx.save();
          ctx.textAlign = 'left';
          ctx.fillStyle = sbs.ascendInfo ? sbs.ascendInfo.color : sbCfg.glow;
          ctx.font = 'bold 13px "PingFang SC", serif';
          ctx.fillText(`护法${sIdx === 0 ? '壹' : '贰'} · ${sbDisp}`, sx + 82, sy + 28, 130);
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 11px "PingFang SC", sans-serif';
          ctx.fillText(`军团战力 +${Math.round(sbs.power * (supSharePct / 100))}`, sx + 82, sy + 50);
          ctx.fillStyle = '#bae6fd';
          ctx.font = '10px "PingFang SC", sans-serif';
          ctx.fillText('开战灵盾+8% · 全军攻+6%', sx + 82, sy + 70);
          ctx.restore();

          App.UI.drawButton(ctx, sx + sw - 58, sy + 31, 48, 30, '撤下', {
            r: 6, bg: '#475569', border: '#cbd5e1', fontSize: 10.5,
          }, () => {
            App.State.setSupportBeast(sIdx, null);
          });
          App.UI.addHit(sx, sy, sw - 62, sh, () => { selectedGuardSlot = sIdx; });
        } else {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = isSelSlot ? '#fde047' : '#94a3b8';
          ctx.font = 'bold 13px "PingFang SC", sans-serif';
          ctx.fillText(`◇ 四象护法 · ${sIdx === 0 ? '壹位' : '贰位'}（空缺）`, sx + sw / 2, sy + 38);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10.5px "PingFang SC", sans-serif';
          ctx.fillText('点击右侧闲置圣兽入驻护法', sx + sw / 2, sy + 64);
          ctx.restore();
          App.UI.addHit(sx, sy, sw, sh, () => { selectedGuardSlot = sIdx; });
        }
      }

      const candBeasts = beastIds.filter((id) => !!st.ownedBeasts[id] && id !== st.activeBeastId);
      const gPerPage = 6;
      const maxGuardP = Math.max(0, Math.ceil(candBeasts.length / gPerPage) - 1);
      guardPage = Math.min(guardPage, maxGuardP);

      App.UI.drawPanel(ctx, 560, 308, 362, 196, {
        r: 9, bg: 'rgba(15, 23, 42, 0.72)', border: 'rgba(56, 189, 248, 0.35)', lineWidth: 1.2,
      });

      if (!candBeasts.length) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
        ctx.fillText('当前暂无闲置已收服神兽', 741, 392);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText('前往【抓捕秘境】收服第 2、3 只圣兽即可组建护法大阵！', 741, 418);
        ctx.restore();
      } else {
        candBeasts.slice(guardPage * gPerPage, (guardPage + 1) * gPerPage).forEach((cbid, idx) => {
          const col = idx % 3, row = Math.floor(idx / 3);
          const cx = 572 + col * 114, cy = 318 + row * 78;
          const cbCfg = App.Config.BEASTS[cbid];
          const cbs = App.State.getBeastStats(cbid);
          const inGuardIdx = supSlots.indexOf(cbid);
          App.UI.drawPanel(ctx, cx, cy, 106, 70, {
            r: 8,
            bg: inGuardIdx >= 0 ? 'rgba(14, 116, 144, 0.45)' : 'rgba(30, 41, 59, 0.85)',
            border: inGuardIdx >= 0 ? '#67e8f9' : cbCfg.glow,
            lineWidth: inGuardIdx >= 0 ? 2 : 1.3,
          });
          const cbShort = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(cbid, st.ownedBeasts[cbid], true) : (cbCfg.shortName || cbCfg.name);
          App.Portraits.drawBeastPortrait(ctx, cbid, cx + 6, cy + 11, 48, { radius: 7, border: cbCfg.glow, lineWidth: 1.4 });
          ctx.save();
          ctx.textAlign = 'left';
          ctx.fillStyle = cbs && cbs.ascendInfo ? cbs.ascendInfo.color : cbCfg.glow;
          ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
          ctx.fillText(cbShort, cx + 59, cy + 25, 43);
          ctx.fillStyle = '#fde047';
          ctx.font = '9.5px sans-serif';
          ctx.fillText(`+${Math.round((cbs ? cbs.power : 0) * (supSharePct / 100))}`, cx + 59, cy + 43, 42);
          ctx.fillStyle = inGuardIdx >= 0 ? '#67e8f9' : '#86efac';
          ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
          ctx.fillText(inGuardIdx >= 0 ? `护法${inGuardIdx + 1}` : '点此入驻', cx + 59, cy + 60, 44);
          ctx.restore();

          App.UI.addHit(cx, cy, 106, 70, () => {
            if (inGuardIdx >= 0) {
              App.State.setSupportBeast(inGuardIdx, null);
              return;
            }
            const targetSlot = !supSlots[0] ? 0 : (!supSlots[1] ? 1 : selectedGuardSlot);
            App.State.setSupportBeast(targetSlot, cbid);
          });
        });
        if (maxGuardP > 0) {
          App.UI.drawPagination(ctx, 572, 474, 338, 24, guardPage, maxGuardP + 1, (p) => { guardPage = p; });
        }
      }
    }

    if (showBeastAscendModal && selectedBeastId) {
      drawBeastAscendModal(ctx, W, H, st, selectedBeastId);
    }
  }

  function drawBeastAscendModal(ctx, W, H, st, bid) {
    const bCfg = App.Config.BEASTS[bid];
    const owned = st.ownedBeasts && st.ownedBeasts[bid];
    if (!bCfg || !owned) {
      showBeastAscendModal = false;
      return;
    }

    const ac = App.Config.ASCENSION || {};
    const reqLv = ac.beastReqLevel || ((App.Config.PARAMS && App.Config.PARAMS.beastMaxLevel) || 120);
    const reqStar = ac.beastReqStar || ((App.Config.PARAMS && App.Config.PARAMS.beastMaxStar) || 10);
    const maxTier = ac.beastMaxTier || ac.maxTier || 5;
    const curPath = owned.ascend || '';
    const curTier = Math.max(1, Number(owned.ascendTier) || 1);
    const ascInfo = App.Config.getBeastAscendInfo ? App.Config.getBeastAscendInfo(owned) : null;
    const curLv = owned.lv || 1;
    const curStar = owned.star || 1;
    const lvReady = curLv >= reqLv;
    const starReady = curStar >= reqStar;
    const dispName = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(bid, owned) : bCfg.name;

    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(8, 5, 14, 0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 820, mh = 456;
    const mx = Math.round((W - mw) / 2), my = Math.round((H - mh) / 2) + 8;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 16, bg: '#160d1f', border: '#facc15', lineWidth: 2.5 });
    App.UI.drawPanel(ctx, mx + 7, my + 7, mw - 14, mh - 14, { r: 12, bg: 'rgba(30, 18, 42, 0.78)', border: 'rgba(250, 204, 21, 0.28)', lineWidth: 1.2 });

    App.UI.drawPanel(ctx, W / 2 - 236, my - 20, 472, 42, { r: 21, bg: '#4c1d95', border: '#fef08a', lineWidth: 2.2 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(`✦ 万兽封神台 · ${dispName} (Lv.${curLv}/${reqLv} · ${curStar}/${reqStar}★)`, W / 2, my + 6, 448);
    ctx.restore();

    App.UI.drawButton(ctx, mx + mw - 88, my + 14, 72, 28, '✕ 关闭', {
      r: 7, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
    }, () => { showBeastAscendModal = false; });

    App.UI.drawPanel(ctx, mx + 18, my + 30, mw - 116, 48, {
      r: 9,
      bg: ascInfo ? (curPath === 'xian' ? 'rgba(8, 51, 68, 0.88)' : 'rgba(74, 4, 78, 0.88)') : 'rgba(42, 24, 16, 0.88)',
      border: ascInfo ? ascInfo.color : '#d97706',
      lineWidth: 1.5,
    });
    App.Portraits.drawBeastPortrait(ctx, bid, mx + 26, my + 34, 40, { radius: 7, lineWidth: 1.6, ascend: curPath || undefined });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    if (ascInfo) {
      ctx.fillText(
        `当前神魔圣号：【${dispName} · ${ascInfo.realm}】(${curTier}/${maxTier}重)  ·  全维 +${Math.round((ascInfo.statMult - 1) * 100)}%  ·  契约增幅 +${Math.round((ascInfo.bondMult - 1) * 100)}%`,
        mx + 76, my + 49, mw - 208
      );
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText('继续消耗同道兽丹灵髓可突破更高神/魔重数，亦可通关另一神兽副本后【洗髓转修】互换神魔大道！', mx + 76, my + 68, mw - 208);
    } else {
      const bothReady = lvReady && starReady;
      ctx.fillText(
        bothReady
          ? `✓ 已圆满达成 ${reqStar}★ · Lv.${reqLv}！通关【神兽成神/成魔副本】集齐丹髓，即可蜕变【神.${bCfg.name}】或【魔.${bCfg.name}】！`
          : `渡劫门槛：需将 ${bCfg.name} 觉醒至满星 ${reqStar}★（当前 ${curStar}★）且升至满级 Lv.${reqLv}（当前 Lv.${curLv}）`,
        mx + 76, my + 49, mw - 208
      );
      ctx.fillStyle = bothReady ? '#86efac' : '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`提示：化神蜕变【神.${bCfg.name}】、入魔蜕变【魔.${bCfg.name}】，解锁九天神罡/九幽魔煞光环与兽装共鸣！`, mx + 76, my + 68, mw - 208);
    }
    ctx.restore();

    const paths = [
      {
        id: 'xian',
        dgKey: 'beast_xian',
        title: `✦ 天道化神 · 晋升【神.${bCfg.name}】`,
        dgTitle: '神兽成神（万兽封神坛）',
        bg: '#082f49',
        border: '#38bdf8',
        headBg: '#0369a1',
        accent: '#67e8f9',
        pillId: ac.beastXianPillItem || 'beast_xian_pill',
        subId: ac.beastXianSubItem || 'beast_xian_jade',
        lore1: '全属性飞跃：1~5重提升 +40% / +56% / +72% / +88% / +104%',
        lore2: '神兽法则：免伤+9%~21% · 技伤+14%~34% · 契约增幅+15%~35%',
        lore3: '沙场异象：身绕【九天神罡】瑞兽法阵，穿戴神·凌霄套再享+12%共鸣',
        btnGrad: ['#0284c7', '#0c4a6e'],
      },
      {
        id: 'mo',
        dgKey: 'beast_mo',
        title: `✦ 魔道入魔 · 晋升【魔.${bCfg.name}】`,
        dgTitle: '神兽成魔（洪荒魔兽渊）',
        bg: '#2e1065',
        border: '#e879f9',
        headBg: '#86198f',
        accent: '#f472b6',
        pillId: ac.beastMoPillItem || 'beast_mo_pill',
        subId: ac.beastMoSubItem || 'beast_mo_crystal',
        lore1: '全属性飞跃：1~5重提升 +40% / +56% / +72% / +88% / +104%',
        lore2: '魔兽法则：暴伤+20%~48% · 嗜血+8%~20% · 契约增幅+15%~35%',
        lore3: '沙场异象：脚踏【九幽魔煞】凶神血阵，穿戴魔·深渊套再享+12%共鸣',
        btnGrad: ['#a21caf', '#581c87'],
      },
    ];

    const cardW = 384, cardH = 354;
    paths.forEach((p, idx) => {
      const cx = mx + 18 + idx * (cardW + 16);
      const cy = my + 86;
      const isCur = curPath === p.id;
      const isSwitch = curPath && curPath !== p.id;
      const dgCleared = !!(st.clearedLevels && st.clearedLevels[p.dgKey]);

      let needPill = ac.beastInitPillCost != null ? ac.beastInitPillCost : 3;
      let needSub = ac.beastInitSubCost != null ? ac.beastInitSubCost : 6;
      let needGold = ac.beastInitGoldCost != null ? ac.beastInitGoldCost : 60000;
      let needSoul = ac.beastInitSoulCost != null ? ac.beastInitSoulCost : 400;
      if (isCur) {
        needPill = (ac.beastTierPillBase ?? 2) + (curTier - 1) * (ac.beastTierPillStep ?? 2);
        needSub = (ac.beastTierSubBase ?? 4) + (curTier - 1) * (ac.beastTierSubStep ?? 4);
        needGold = (ac.beastTierGoldBase ?? 50000) + (curTier - 1) * (ac.beastTierGoldStep ?? 30000);
        needSoul = (ac.beastTierSoulBase ?? 300) + (curTier - 1) * (ac.beastTierSoulStep ?? 200);
      } else if (isSwitch) {
        needPill = ac.beastSwitchPillCost ?? 2;
        needSub = ac.beastSwitchSubCost ?? 4;
        needGold = ac.beastSwitchGoldCost ?? 36000;
        needSoul = 0;
      }

      const havePill = App.State.getItemCount(p.pillId);
      const haveSub = App.State.getItemCount(p.subId);
      const pillName = (App.Config.ITEMS[p.pillId] && App.Config.ITEMS[p.pillId].name) || (p.id === 'xian' ? '万兽封神丹' : '九幽化魔兽丹');
      const subName = (App.Config.ITEMS[p.subId] && App.Config.ITEMS[p.subId].name) || (p.id === 'xian' ? '太初圣兽髓' : '炼狱魔兽晶');

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
      ctx.font = 'bold 14px "PingFang SC", serif';
      ctx.fillText(isCur ? `${p.title} [当前主修]` : p.title, cx + cardW / 2, cy + 32, cardW - 28);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`✦ ${p.lore1}`, cx + 14, cy + 64, cardW - 28);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(`✦ ${p.lore2}`, cx + 14, cy + 84, cardW - 28);
      ctx.fillStyle = p.accent;
      ctx.fillText(`✦ ${p.lore3}`, cx + 14, cy + 104, cardW - 28);

      App.UI.drawPanel(ctx, cx + 12, cy + 116, cardW - 24, 38, {
        r: 7, bg: 'rgba(10, 8, 18, 0.58)', border: dgCleared ? '#4ade80' : '#f87171', lineWidth: 1.2,
      });
      ctx.fillStyle = dgCleared ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`${p.dgTitle}：${dgCleared ? '✓ 已通关证道' : '✗ 尚未通关'}`, cx + 20, cy + 139, cardW - 144);
      ctx.restore();

      App.UI.drawButton(ctx, cx + cardW - 116, cy + 122, 96, 26, '去打神兽副本', {
        r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10,
      }, () => {
        showBeastAscendModal = false;
        App.Main.goScene('challenge', { tab: 'beastAscend' });
      });

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

      ctx.save();
      ctx.textAlign = 'center';
      const goldOk = (st.gold || 0) >= needGold;
      const soulOk = (st.soul || 0) >= needSoul;
      ctx.fillStyle = (goldOk && soulOk) ? '#fde68a' : '#fca5a5';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      const maxReached = isCur && curTier >= maxTier;
      const costLine = maxReached
        ? `★ 已臻至第 ${maxTier} 重圆满至高兽皇果位！`
        : `消耗：${needGold} 铜钱${needSoul > 0 ? `  +  ${needSoul} 将魂` : '（转修保留当前重数）'}`;
      ctx.fillText(costLine, cx + cardW / 2, cy + 244);
      ctx.restore();

      const targetSaintName = `${p.id === 'xian' ? '神.' : '魔.'}${bCfg.name}`;
      if (isCur) {
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, maxReached ? `★ 已圆满 (${maxTier}/${maxTier}重)` : `突破至第 ${curTier + 1} 重 (${curTier}/${maxTier})`, {
          r: 10,
          grad: p.btnGrad,
          border: '#fef08a',
          fontSize: 13.5,
          subText: maxReached ? '威震八荒 · 万兽至尊' : '全属性+16% · 契约加成+5%',
          disabled: maxReached,
        }, () => {
          App.State.ascendUpBeast(bid);
        });
      } else if (isSwitch) {
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, `↻ 洗髓转修【${targetSaintName}】`, {
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
          App.State.switchAscendBeast(bid);
        });
      } else {
        const canAscend = lvReady && starReady && dgCleared && havePill >= needPill && haveSub >= needSub && goldOk && soulOk;
        const btnTxt = p.id === 'xian' ? `☁ 渡劫化神 (${targetSaintName})` : `🔥 觉醒入魔 (${targetSaintName})`;
        const subTxt = !starReady
          ? `需血脉觉醒满 ${reqStar}★（当前 ${curStar}★）`
          : (!lvReady
            ? `需神兽满 Lv.${reqLv}（当前 Lv.${curLv}）`
            : (!dgCleared ? `需先通关${p.id === 'xian' ? '神兽成神副本' : '神兽成魔副本'}` : '晋升一重 · 激活神魔圣兽光环'));
        App.UI.drawButton(ctx, cx + 32, cy + 262, cardW - 64, 44, btnTxt, {
          r: 10,
          grad: canAscend ? p.btnGrad : ['#475569', '#334155'],
          border: canAscend ? '#fef08a' : '#94a3b8',
          fontSize: 13,
          subText: subTxt,
        }, () => {
          if (!starReady) {
            App.UI.showToast(`请先将【${bCfg.name}】觉醒至满星 ${reqStar}★（当前 ${curStar}★）！`, '#fbbf24');
            return;
          }
          if (!lvReady) {
            App.UI.showToast(`请先将【${bCfg.name}】喂养升至满级 Lv.${reqLv}（当前 Lv.${curLv}）！`, '#fbbf24');
            return;
          }
          if (!dgCleared) {
            showBeastAscendModal = false;
            App.UI.showToast(`正在前往【${p.dgTitle}】历劫证道…`, '#fde047');
            App.Main.goScene('challenge', { tab: 'beastAscend' });
            return;
          }
          App.State.ascendBeast(bid, p.id);
        });
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`材料出处：征战秘境 → 神兽神魔 → ${p.dgTitle}`, cx + cardW / 2, cy + 328);
      ctx.restore();
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.beast = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
