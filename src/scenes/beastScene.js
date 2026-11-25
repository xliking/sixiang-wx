(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let selectedBeastId = 'qinglong';
  let subTab = 'equip'; // 'equip' | 'bond'
  let selectedEqUid = null;
  let bagPage = 0;
  let bondPage = 0;

  function render(ctx) {
    if (!App.Config.BEASTS[selectedBeastId]) selectedBeastId = App.Config.BEAST_IDS[0];
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#24130a';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // ================= 左侧：四大圣兽玄金名录栏 =================
    App.UI.drawPanel(ctx, 12, 60, 224, 418, { r: 12, bg: '#321b0e', border: '#b4823c', lineWidth: 2 });

    App.Config.BEAST_IDS.forEach((bid, idx) => {
      const bCfg = App.Config.BEASTS[bid];
      const owned = st.ownedBeasts[bid];
      const bStats = App.State.getBeastStats(bid);
      const isSel = selectedBeastId === bid;
      const y = 72 + idx * 98;

      App.UI.drawPanel(ctx, 22, y, 204, 88, {
        r: 10,
        bg: isSel ? '#4b2410' : 'rgba(20, 11, 6, 0.85)',
        border: isSel ? bCfg.glow : '#6b4423',
        lineWidth: isSel ? 2.4 : 1.3,
      });

      ctx.save();
      if (!owned) ctx.globalAlpha = 0.45;
      App.Portraits.drawBeastPortrait(ctx, bid, 32, y + 12, 64, { radius: 10, border: bCfg.glow, lineWidth: 1.8 });
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = bCfg.glow;
      ctx.font = 'bold 14.5px "PingFang SC", serif';
      ctx.fillText(bCfg.name, 104, y + 28);

      if (owned && bStats) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Lv.${bStats.lv}  ${'★'.repeat(bStats.star)}`, 104, y + 48, 114);
        ctx.fillStyle = st.activeBeastId === bid ? '#4ade80' : '#cbd5e1';
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `${st.activeBeastId === bid ? '●上阵中 ' : ''}战力 ${bStats.power}`,
          104, y + 68, 114
        );
      } else {
        const reqLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(bid) : 15;
        const canCatch = (st.lordLevel || 1) >= reqLv;
        ctx.fillStyle = canCatch ? '#86efac' : '#94a3b8';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText(`未收服 · Lv.${reqLv}可抓`, 104, y + 49, 114);
        ctx.fillStyle = '#d6b685';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(bCfg.direction, 104, y + 68, 114);
      }
      ctx.restore();

      App.UI.addHit(22, y, 204, 88, () => {
        selectedBeastId = bid;
        selectedEqUid = null;
      });
    });

    // ================= 右侧：圣兽祭坛主面板（深色乌金高级质感，零杂乱堆叠按钮！） =================
    const bCfg = App.Config.BEASTS[selectedBeastId];
    const owned = st.ownedBeasts[selectedBeastId];
    const bStats = App.State.getBeastStats(selectedBeastId);
    const eqMap = App.State.getBeastEquippedMap(selectedBeastId);

    App.UI.drawPanel(ctx, 246, 60, W - 258, 418, { r: 12, bg: '#321b0e', border: '#b4823c', lineWidth: 2 });

    // 1. 顶部圣兽主信息殿堂卡（左：发光大图 | 中：等级经验与四维属性 | 右：整齐操作列）
    App.UI.drawPanel(ctx, 258, 72, W - 282, 142, {
      r: 10, bg: 'rgba(20, 10, 5, 0.78)', border: 'rgba(212, 163, 75, 0.55)', lineWidth: 1.5,
    });

    // 圣兽发光底座托盘 + 立绘
    const selectedUnlockLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(selectedBeastId) : 15;
    const canCatchSelected = (st.lordLevel || 1) >= selectedUnlockLv;

    ctx.save();
    const auraG = ctx.createRadialGradient(320, 143, 10, 320, 143, 64);
    auraG.addColorStop(0, bCfg.glow);
    auraG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = auraG;
    ctx.beginPath(); ctx.arc(320, 143, 64, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const beastSetVfx = App.Config.resolveSetVfx ? App.Config.resolveSetVfx(Object.values(eqMap)) : null;
    if (beastSetVfx && App.Sprites.drawUiSetAura) {
      App.Sprites.drawUiSetAura(ctx, 320, 138, 60, beastSetVfx);
    }
    App.Portraits.drawBeastPortrait(ctx, selectedBeastId, 268, 86, 104, {
      radius: 12,
      border: beastSetVfx ? beastSetVfx.auraColor : bCfg.glow,
      lineWidth: beastSetVfx ? 2.8 : 2.5,
    });

    // 右侧独立操作列与中部文字区严格划分安全边界，彻底杜绝按钮遮挡绝技文字！
    const infoLeftX = 384;
    const actX = 764, actW = 162;
    const infoMaxW = actX - infoLeftX - 10; // 370px 纯净文字区，绝不侵入右侧按钮列

    // 中部：圣兽名 + 星级 + 战力 + 灵气进度槽 + 四维胶囊 + 绝技说明
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = bCfg.glow;
    ctx.font = 'bold 20px "PingFang SC", serif';
    ctx.fillText(bCfg.name, infoLeftX, 102);

    const starStr = '★'.repeat(bStats.star) + '☆'.repeat(Math.max(0, 5 - bStats.star));
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(starStr, infoLeftX + 98, 101);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    ctx.fillText(`圣兽战力 ${bStats.power}`, infoLeftX + 194, 101);

    ctx.fillStyle = owned ? '#cbd5e1' : (canCatchSelected ? '#86efac' : '#cbd5e1');
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(
      owned
        ? `等级 Lv.${bStats.lv}/60   灵气 (${bStats.exp}/${bStats.needExp})`
        : `栖息秘境：${bCfg.direction}（主公 Lv.${selectedUnlockLv} 开启抓捕）`,
      infoLeftX, 124, infoMaxW
    );
    App.UI.drawBar(ctx, infoLeftX, 130, infoMaxW - 6, 8, owned ? (bStats.exp / bStats.needExp) : 0, bCfg.glow, '#0f172a');

    // 4 枚精致黑金属性小胶囊
    const statsList = [
      { k: '气血', v: bStats.hp, b: bStats.bonusHp },
      { k: '攻击', v: bStats.atk, b: bStats.bonusAtk },
      { k: '防御', v: bStats.def, b: bStats.bonusDef },
      { k: '暴击', v: `${Math.round(bStats.crit * 100)}%`, b: 0 },
    ];
    statsList.forEach((item, idx) => {
      const sx = infoLeftX + idx * 91;
      const sy = 148;
      ctx.fillStyle = 'rgba(56, 30, 14, 0.90)';
      App.UI.roundRect(ctx, sx, sy, 86, 22, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`${item.k} ${item.v}`, sx + 6, sy + 14.5, item.b > 0 ? 50 : 74);
      if (item.b > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.fillText(`+${item.b}`, sx + 56, sy + 14.5, 26);
      }
    });

    const skillText = `神兽绝技【${bCfg.skillName}】：${bCfg.skillDesc}`;
    ctx.fillStyle = '#fde68a';
    let skFont = 11;
    ctx.font = `${skFont}px "PingFang SC", sans-serif`;
    while (ctx.measureText(skillText).width > infoMaxW && skFont > 9.5) {
      skFont -= 0.5;
      ctx.font = `${skFont}px "PingFang SC", sans-serif`;
    }
    ctx.fillText(skillText, infoLeftX, 195, infoMaxW);
    ctx.restore();

    // 右侧独立操作列（严格在 actX=764 右侧，零遮挡中部绝技说明！）
    if (owned) {
      const feedCost = App.State.getCost('beastFeed', bStats.lv);
      const soulCost = App.State.getCost('beastStar', bStats.star);
      const isAct = st.activeBeastId === selectedBeastId;

      App.UI.drawButton(ctx, actX, 84, actW, 34, `灵气喂养 (${feedCost}铜钱)`, {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11.5,
      }, () => {
        App.State.upgradeBeast(selectedBeastId);
      });

      App.UI.drawButton(ctx, actX, 125, actW, 34, bStats.star >= 5 ? '已觉醒满星 5★' : `血脉升星 (${soulCost}将魂)`, {
        r: 8, grad: ['#7e22ce', '#581c87'], border: '#f5d0fe', fontSize: 11.5,
        disabled: bStats.star >= 5,
      }, () => {
        App.State.starUpBeast(selectedBeastId);
      });

      App.UI.drawButton(ctx, actX, 166, actW, 36, isAct ? '撤下休息（不上阵）' : '任命上阵（沙场冲锋）', {
        r: 8, grad: isAct ? ['#475569', '#334155'] : ['#15803d', '#166534'], border: isAct ? '#cbd5e1' : '#bbf7d0', fontSize: 11.5,
      }, () => {
        App.State.setActiveBeast(isAct ? null : selectedBeastId).then((res) => {
          if (res.ok) App.UI.showToast(isAct ? `已撤下【${bCfg.name}】休息待命` : `【${bCfg.name}】已随军上阵！`, '#4ade80');
        });
      });
    } else {
      App.UI.drawButton(
        ctx, actX, 98, actW, 48,
        canCatchSelected ? `前往秘境抓捕 ${bCfg.shortName}` : `🔒 Lv.${selectedUnlockLv} 抓捕${bCfg.shortName}`,
        {
          r: 10,
          grad: canCatchSelected ? [bCfg.color, bCfg.darkColor] : ['#475569', '#334155'],
          border: canCatchSelected ? '#fef08a' : '#94a3b8',
          fontSize: 12.5,
          subText: canCatchSelected ? '击败神兽即可几率收服' : `当前主公 Lv.${st.lordLevel || 1}`,
        },
        () => {
          if (!canCatchSelected) {
            App.UI.showToast(`主公达到 Lv.${selectedUnlockLv} 方可讨伐并抓捕【${bCfg.name}】！`, '#fbbf24');
          }
          App.Main.goScene('beastDungeon');
        }
      );

      App.UI.drawButton(ctx, actX, 156, actW, 34, '铜钱商城搜罗兽装', {
        r: 8, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 11.5,
      }, () => App.Main.goScene('shop'));
    }

    // 2. 下半区一体化页签栏：【神兽四槽装备】 | 【名将契约共鸣】
    const boundName = owned && owned.boundGeneralId && App.Config.GENERALS[owned.boundGeneralId]
      ? App.Config.GENERALS[owned.boundGeneralId].name
      : '未缔结';

    App.UI.drawButton(ctx, 258, 224, 184, 30, '神兽专属装备 (4槽位)', {
      r: 8,
      grad: subTab === 'equip' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'equip' ? '#fef08a' : '#6b4423',
      fontSize: 12,
    }, () => { subTab = 'equip'; });

    App.UI.drawButton(ctx, 450, 224, 198, 30, `名将契约共鸣 (${boundName})`, {
      r: 8,
      grad: subTab === 'bond' ? ['#d97706', '#92400e'] : ['#24130a', '#1c0e07'],
      border: subTab === 'bond' ? '#fef08a' : '#6b4423',
      fontSize: 12,
    }, () => { subTab = 'bond'; });

    const scrollCnt = App.State.getItemCount(App.Config.SPECIAL.beastScrollItem);
    if (owned && scrollCnt > 0) {
      App.UI.drawButton(ctx, 782, 224, 156, 30, `灵简喂养+280经验(剩${scrollCnt})`, {
        r: 8, grad: ['#0284c7', '#0369a1'], border: '#bae6fd', fontSize: 10.5,
      }, () => {
        App.State.feedBeastScroll(selectedBeastId);
      });
    }

    // ================= 子页签 A：神兽 4 槽装备祭坛 + 右侧闲置兽装匣 =================
    if (subTab === 'equip') {
      App.UI.drawPanel(ctx, 258, 260, 366, 206, {
        r: 10, bg: 'rgba(20, 10, 5, 0.76)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });

      ctx.save();
      ctx.textAlign = 'left';
      const topBeastSet = bStats.activeSets && bStats.activeSets[0];
      if (topBeastSet) {
        ctx.fillStyle = topBeastSet.unlocked.length ? '#4ade80' : '#fde68a';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(
          `✦ 兽装套装【${topBeastSet.name}】(${topBeastSet.count}/${topBeastSet.total}) ${topBeastSet.unlocked.length ? '★已激活四象圣兽共鸣！' : '凑齐2/4件激活共鸣'}`,
          270, 280, 344
        );
      } else {
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText('四象神兽穿戴槽（集齐2/4件同名兽装激活四象圣兽套装共鸣）', 270, 280, 344);
      }
      ctx.restore();

      App.Config.BEAST_EQUIP_SLOTS.forEach((slot, idx) => {
        const sx = 272 + idx * 86;
        const sy = 292;
        const eq = eqMap[slot.id];
        const tpl = eq ? App.Config.EQUIP_TEMPLATES[eq.tplId] : null;
        const q = tpl ? App.Config.QUALITIES[tpl.quality] : null;
        const isSelEq = eq && selectedEqUid === eq.uid;

        if (tpl) {
          App.Sprites.drawEquipIcon(ctx, tpl.id, sx, sy, 76, {
            radius: 10, border: isSelEq ? '#ffffff' : q.color, lineWidth: isSelEq ? 3.2 : 2.2,
            enhance: eq.enhance, star: eq.star, advance: eq.advance,
          });
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(sx + 2, sy + 56, 72, 18);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, sx + 38, sy + 69);
          ctx.restore();
          App.UI.addHit(sx, sy, 76, 76, () => { selectedEqUid = eq.uid; });
        } else {
          App.UI.drawPanel(ctx, sx, sy, 76, 76, { r: 10, bg: 'rgba(46, 25, 13, 0.90)', border: '#784820', lineWidth: 1.4 });
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.16)';
          ctx.beginPath(); ctx.arc(sx + 38, sy + 38, 24, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#d6b685';
          ctx.font = 'bold 13px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(slot.name, sx + 38, sy + 36);
          ctx.fillStyle = '#78716c';
          ctx.font = '10px "PingFang SC", sans-serif';
          ctx.fillText('待穿戴', sx + 38, sy + 54);
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
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${tpl.name} +${selEq.enhance}（攻+${eb.atk} 血+${eb.hp} 防+${eb.def}）`, 272, 390);
        ctx.restore();

        App.UI.drawButton(ctx, 272, 402, 162, 32, `精炼强化 (${enhCost}铜钱)`, {
          r: 8, grad: ['#ea580c', '#9a3412'], border: '#fef08a', fontSize: 11.5,
        }, () => {
          App.State.enhanceEquip(selEq.uid);
        });

        if (selEq.equippedByBeast) {
          App.UI.drawButton(ctx, 444, 402, 148, 32, '卸下兽装回库', {
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
        ctx.fillText('点击已穿戴兽装可精炼强化或卸下；点击右侧闲置兽装一键穿戴', 272, 418, 342);
        ctx.restore();
      }

      // 右半区：闲置兽装匣（2排×4列小巧图标 + 页码直选分页条）
      App.UI.drawPanel(ctx, 634, 260, 304, 206, {
        r: 10, bg: 'rgba(20, 10, 5, 0.76)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
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
      ctx.fillText(`闲置兽装匣 (${idleBeastEquips.length}件 · 点击一键穿戴)`, 646, 278);
      ctx.restore();

      const bSz = 50;
      if (idleBeastEquips.length === 0) {
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('当前暂无闲置兽装', 786, 344);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10.5px "PingFang SC", sans-serif';
        ctx.fillText('通关神兽副本、开启宝箱或逛铜钱商城均可获得', 786, 366);
        ctx.restore();
      } else {
        idleBeastEquips.slice(bagPage * perPage, (bagPage + 1) * perPage).forEach((eq, idx) => {
          const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
          const q = App.Config.QUALITIES[tpl.quality];
          const col = idx % bCols;
          const row = Math.floor(idx / bCols);
          const ix = 646 + col * 71;
          const iy = 286 + row * 73;

          App.Sprites.drawEquipIcon(ctx, tpl.id, ix, iy, bSz, { radius: 7, border: q.color, lineWidth: 1.8 });
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(ix + 2, iy + bSz - 14, bSz - 4, 12);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 8px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tpl.name.slice(0, 4)}+${eq.enhance}`, ix + bSz / 2, iy + bSz - 5, bSz - 4);
          ctx.fillStyle = owned ? '#4ade80' : '#94a3b8';
          ctx.font = 'bold 9px "PingFang SC", sans-serif';
          ctx.fillText(owned ? '点击穿戴' : '收服后穿', ix + bSz / 2, iy + bSz + 11);
          ctx.restore();

          App.UI.addHit(ix, iy, bSz, bSz + 16, () => {
            if (!owned) {
              App.UI.showToast(`请先达到 Lv.${selectedUnlockLv} 在【神兽副本】收服 ${bCfg.shortName}！`, '#fbbf24');
              return;
            }
            App.State.equipBeastItem(selectedBeastId, eq.uid).then((res) => { if (res.ok) selectedEqUid = eq.uid; });
          });
        });
      }

      App.UI.drawPagination(ctx, 642, 436, 288, 24, bagPage, maxPage + 1, (p) => { bagPage = p; });
    } else {
      // ================= 子页签 B：名将契约共鸣台（出战将领置顶 + 数字分页浏览） =================
      App.UI.drawPanel(ctx, 258, 260, W - 282, 206, {
        r: 10, bg: 'rgba(20, 10, 5, 0.76)', border: 'rgba(212, 163, 75, 0.50)', lineWidth: 1.4,
      });
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${bCfg.bondDesc}（随神兽等级与星级提升，并额外共享神兽已穿兽装 25% 属性给契约名将！）`,
        274, 282, W - 314
      );
      ctx.restore();

      if (!owned) {
        ctx.save();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 13px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`收服【${bCfg.name}】后，点击下方任意名将即可缔结四象守护契约！`, 598, 366);
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
          const gy = 296;
          const isBound = owned.boundGeneralId === gid;
          const isDep = deploySet.has(gid);
          App.Portraits.drawGeneralPortrait(ctx, gid, gx, gy, 62, {
            radius: 10, border: isBound ? '#4ade80' : (isDep ? '#fde047' : '#784820'), lineWidth: isBound ? 3 : 1.8,
          });
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = isBound ? '#4ade80' : (isDep ? '#fde68a' : '#fef3c7');
          ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
          ctx.fillText(App.Config.GENERALS[gid].name, gx + 31, gy + 77);
          if (isBound) {
            ctx.fillStyle = '#facc15';
            ctx.fillText('★契约共鸣', gx + 31, gy + 92);
          } else if (isDep) {
            ctx.fillStyle = '#86efac';
            ctx.font = '9.5px "PingFang SC", sans-serif';
            ctx.fillText('出战中', gx + 31, gy + 92);
          }
          ctx.restore();

          App.UI.addHit(gx, gy, 62, 98, () => {
            App.State.bindBeastToGeneral(selectedBeastId, gid).then((res) => { if (res.ok && res.msg) App.UI.showToast(res.msg, '#4ade80'); });
          });
        });

        App.UI.drawPagination(ctx, 274, 434, W - 314, 24, bondPage, maxBondPage + 1, (p) => { bondPage = p; });
      }
    }

    App.Scenes.map.drawBottomNav(ctx, 'beast');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.beast = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
