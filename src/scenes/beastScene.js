(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let selectedBeastId = 'qinglong';
  let beastListPage = 0;
  let subTab = 'equip'; // 'equip' | 'bond'
  let selectedEqUid = null;
  let bagPage = 0;
  let bondPage = 0;

  const LIST_PER_PAGE = 4;

  function enter(params) {
    if (params && params.beastId && App.Config.BEASTS[params.beastId]) {
      selectedBeastId = params.beastId;
    } else if (!App.Config.BEASTS[selectedBeastId]) {
      selectedBeastId = App.Config.BEAST_IDS[0] || 'qinglong';
    }
    const idx = App.Config.BEAST_IDS.indexOf(selectedBeastId);
    if (idx >= 0) beastListPage = Math.floor(idx / LIST_PER_PAGE);
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
      ctx.fillStyle = bCfg.glow;
      ctx.font = 'bold 14px "PingFang SC", serif';
      ctx.fillText(bCfg.name, 102, y + 27, 120);

      if (owned && bStats) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Lv.${bStats.lv}  ${'★'.repeat(bStats.star)}`, 102, y + 48, 120);
        ctx.fillStyle = st.activeBeastId === bid ? '#4ade80' : '#cbd5e1';
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `${st.activeBeastId === bid ? '●上阵中 ' : ''}战力 ${bStats.power}`,
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

    const beastSetVfx = App.Config.resolveSetVfx ? App.Config.resolveSetVfx(Object.values(eqMap)) : null;
    if (beastSetVfx && App.Sprites.drawUiSetAura) {
      App.Sprites.drawUiSetAura(ctx, 322, 142, 62, beastSetVfx);
    }
    App.Portraits.drawBeastPortrait(ctx, selectedBeastId, 268, 88, 108, {
      radius: 12,
      border: beastSetVfx ? beastSetVfx.auraColor : bCfg.glow,
      lineWidth: beastSetVfx ? 2.8 : 2.5,
    });

    const infoLeftX = 388;
    const actX = 730, actW = 156;
    const infoMaxW = actX - infoLeftX - 10;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = bCfg.glow;
    ctx.font = 'bold 20px "PingFang SC", serif';
    ctx.fillText(bCfg.name, infoLeftX, 102);

    const starStr = '★'.repeat(bStats.star) + '☆'.repeat(Math.max(0, 5 - bStats.star));
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 13.5px sans-serif';
    ctx.fillText(starStr, infoLeftX + 96, 101);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`战力 ${bStats.power}`, infoLeftX + 188, 101);

    ctx.fillStyle = owned ? '#cbd5e1' : (canCatchSelected ? '#86efac' : '#cbd5e1');
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(
      owned
        ? `等级 Lv.${bStats.lv}/60   灵气 (${bStats.exp}/${bStats.needExp})`
        : `栖息秘境：${bCfg.direction}（主公 Lv.${selectedUnlockLv} 开启抓捕）`,
      infoLeftX, 124, infoMaxW
    );
    App.UI.drawBar(ctx, infoLeftX, 131, infoMaxW - 6, 8, owned ? (bStats.exp / bStats.needExp) : 0, bCfg.glow, '#0f172a');

    const statsList = [
      { k: '气血', v: bStats.hp, b: bStats.bonusHp },
      { k: '攻击', v: bStats.atk, b: bStats.bonusAtk },
      { k: '防御', v: bStats.def, b: bStats.bonusDef },
      { k: '暴击', v: `${Math.round(bStats.crit * 100)}%`, b: 0 },
    ];
    statsList.forEach((item, idx) => {
      const sx = infoLeftX + idx * 83;
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
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(skillText, infoLeftX, 200, infoMaxW);
    ctx.restore();

    if (owned) {
      const feedCost = App.State.getCost('beastFeed', bStats.lv);
      const soulCost = App.State.getCost('beastStar', bStats.star);
      const isAct = st.activeBeastId === selectedBeastId;

      App.UI.drawButton(ctx, actX, 84, actW, 35, `灵气喂养 (${feedCost}铜钱)`, {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
      }, () => {
        App.State.upgradeBeast(selectedBeastId);
      });

      App.UI.drawButton(ctx, actX, 126, actW, 35, bStats.star >= 5 ? '已觉醒满星 5★' : `血脉升星 (${soulCost}将魂)`, {
        r: 8, grad: ['#7e22ce', '#581c87'], border: '#f5d0fe', fontSize: 11,
        disabled: bStats.star >= 5,
      }, () => {
        App.State.starUpBeast(selectedBeastId);
      });

      App.UI.drawButton(ctx, actX, 168, actW, 36, isAct ? '撤下休息（不上阵）' : '任命上阵（沙场冲锋）', {
        r: 8, grad: isAct ? ['#475569', '#334155'] : ['#15803d', '#166534'], border: isAct ? '#cbd5e1' : '#bbf7d0', fontSize: 11,
      }, () => {
        App.State.setActiveBeast(isAct ? null : selectedBeastId).then((res) => {
          if (res.ok) App.UI.showToast(isAct ? `已撤下【${bCfg.name}】休息待命` : `【${bCfg.name}】已随军上阵！`, '#4ade80');
        });
      });
    } else {
      App.UI.drawButton(
        ctx, actX, 98, actW, 48,
        canCatchSelected ? `前往抓捕 ${bCfg.shortName}` : `🔒 Lv.${selectedUnlockLv} 抓捕${bCfg.shortName}`,
        {
          r: 10,
          grad: canCatchSelected ? [bCfg.color, bCfg.darkColor] : ['#475569', '#334155'],
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

    // 2. 下半区页签栏
    const boundName = owned && owned.boundGeneralId && App.Config.GENERALS[owned.boundGeneralId]
      ? App.Config.GENERALS[owned.boundGeneralId].name
      : '未缔结';

    App.UI.drawButton(ctx, 258, 230, 184, 32, '神兽专属装备 (4槽位)', {
      r: 8,
      grad: subTab === 'equip' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'equip' ? '#fef08a' : '#6b4423',
      fontSize: 12,
    }, () => { subTab = 'equip'; });

    App.UI.drawButton(ctx, 450, 230, 202, 32, `名将契约共鸣 (${boundName})`, {
      r: 8,
      grad: subTab === 'bond' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'bond' ? '#fef08a' : '#6b4423',
      fontSize: 12,
    }, () => { subTab = 'bond'; });

    const scrollCnt = App.State.getItemCount(App.Config.SPECIAL.beastScrollItem);
    if (owned && scrollCnt > 0) {
      App.UI.drawButton(ctx, 774, 230, 160, 32, `灵简喂养+280经验(剩${scrollCnt})`, {
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
        ctx.fillStyle = topBeastSet.unlocked.length ? '#4ade80' : '#fde68a';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `✦ 兽装套装【${topBeastSet.name}】(${topBeastSet.count}/${topBeastSet.total}) ${topBeastSet.unlocked.length ? '★已激活共鸣！' : '凑齐2/4件激活'}`,
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
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`闲置兽装匣 (${idleBeastEquips.length}件 · 点击穿戴)`, 646, 292);
      ctx.restore();

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
    } else {
      // ================= 子页签 B：名将契约共鸣台 =================
      App.UI.drawPanel(ctx, 258, 270, W - 284, 250, {
        r: 10, bg: 'rgba(18, 9, 4, 0.78)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${bCfg.bondDesc}（随神兽等级与星级成长，并共享兽装 25% 属性给契约名将）`,
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
          return App.State.getGeneralPower(b) - App.State.getGeneralPower(a);
        });
        const bondPerPage = 8;
        const maxBondPage = Math.max(0, Math.ceil(ownedGids.length / bondPerPage) - 1);
        bondPage = Math.min(bondPage, maxBondPage);

        ownedGids.slice(bondPage * bondPerPage, (bondPage + 1) * bondPerPage).forEach((gid, idx) => {
          const gx = 274 + idx * 81;
          const gy = 320;
          const isBound = owned.boundGeneralId === gid;
          const isDep = deploySet.has(gid);
          App.Portraits.drawGeneralPortrait(ctx, gid, gx, gy, 66, {
            radius: 10, border: isBound ? '#4ade80' : (isDep ? '#fde047' : '#784820'), lineWidth: isBound ? 3 : 1.8,
          });
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = isBound ? '#4ade80' : (isDep ? '#fde68a' : '#fef3c7');
          ctx.font = 'bold 11px "PingFang SC", sans-serif';
          ctx.fillText(App.Config.GENERALS[gid].name, gx + 33, gy + 82);
          if (isBound) {
            ctx.fillStyle = '#facc15';
            ctx.fillText('★契约共鸣', gx + 33, gy + 98);
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
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.beast = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
