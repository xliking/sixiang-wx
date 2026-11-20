(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let filterTab = 'items'; // 'items' | 'sets' | 'all' | 'weapon' | 'armor' | 'treasure' | 'mount' | 'beast_eq'
  let showItemCodex = false; // false = 仅展示数量>0的库存道具；true = 浏览全214种道具百宝图鉴
  let codexCat = 'all';
  let itemPage = 0;
  let setPage = 0;
  let selectedSetId = 'set_yinlong';
  let selectedUid = null;
  let selectedItemId = 'chest_bronze';
  let page = 0;

  function drawItemBoxIcon(ctx, itemId, x, y, size, isSel) {
    const cfg = App.Config.ITEMS[itemId];
    if (!cfg) return;
    const q = App.Config.QUALITIES[cfg.quality] || App.Config.QUALITIES.blue;
    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, 10);
    ctx.clip();
    const img = App.Assets.get(cfg.imgKey);
    if (img) ctx.drawImage(img, x, y, size, size);
    else { ctx.fillStyle = q.bg; ctx.fillRect(x, y, size, size); }
    ctx.restore();

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, 10);
    ctx.strokeStyle = isSel ? '#ffffff' : q.color;
    ctx.lineWidth = isSel ? 3.0 : 2.0;
    ctx.stroke();
    ctx.restore();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    // 顶部分类栏（新增【套装图鉴(24套)】，并支持库存道具/214种道具图鉴切换！）
    const cats = [
      { id: 'items', label: '宝箱道具' },
      { id: 'sets', label: '24套神装' },
      { id: 'all', label: '全部装备' },
      { id: 'weapon', label: '神兵武器' },
      { id: 'armor', label: '战甲头盔' },
      { id: 'treasure', label: '宝玉兵书' },
      { id: 'mount', label: '名驹战马' },
      { id: 'beast_eq', label: '神兽兽装' },
    ];
    cats.forEach((c, idx) => {
      const act = filterTab === c.id;
      App.UI.drawButton(ctx, 22 + idx * 92, 74, 87, 32, c.label, {
        r: 8,
        grad: act ? ['#b45309', '#78350f'] : ['#5c2c16', '#3d1c0d'],
        border: act ? '#fef08a' : '#a16207',
        fontSize: 10.5,
      }, () => { filterTab = c.id; page = 0; itemPage = 0; });
    });

    if (filterTab === 'items') {
      const totalItemKinds = (App.Config.ITEM_IDS || []).length;
      App.UI.drawButton(ctx, W - 194, 74, 170, 32, showItemCodex ? '◀ 返回我的库存道具' : `百宝图鉴 (${totalItemKinds}种)`, {
        r: 8,
        grad: showItemCodex ? ['#78350f', '#451a03'] : ['#16a34a', '#15803d'],
        border: showItemCodex ? '#fde047' : '#bbf7d0',
        fontSize: 11,
      }, () => {
        showItemCodex = !showItemCodex;
        itemPage = 0;
      });
    } else if (filterTab === 'sets') {
      App.UI.drawButton(ctx, W - 194, 74, 170, 32, '前往铜钱商城搜集套装', {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10.5,
      }, () => App.Main.goScene('shop'));
    } else {
      App.UI.drawButton(ctx, W - 186, 74, 162, 32, '一键出售闲置蓝装', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11,
      }, () => {
        selectedUid = null;
        App.State.sellAllBlueEquips();
      });
    }

    // ================= 分支 A：【宝箱与道具】（库存严格隐藏0数量；图鉴模式支持浏览全214种道具！） =================
    if (filterTab === 'items') {
      App.UI.drawPanel(ctx, 26, 114, 596, 346, { r: 10, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });

      let listIds = [];
      if (showItemCodex) {
        // 顶部分类小胶囊（全部/秘匣/灵丹/竹简/符印/矿玉/锦缎/奇珍/御兽）
        const icats = App.Config.ITEM_CATEGORIES || [{ id: 'all', name: '全部' }];
        icats.forEach((ic, idx) => {
          const isAct = codexCat === ic.id;
          App.UI.drawButton(ctx, 34 + idx * 64, 120, 60, 22, ic.name.slice(0, 4), {
            r: 5,
            grad: isAct ? ['#d97706', '#92400e'] : ['#4a2c16', '#321b0e'],
            border: isAct ? '#fef08a' : '#a16207',
            fontSize: 9.5,
          }, () => { codexCat = ic.id; itemPage = 0; });
        });
        listIds = App.Config.ITEM_IDS.filter((id) => codexCat === 'all' || App.Config.ITEMS[id].cat === codexCat);
      } else {
        // 库存模式：数量为 0 的道具绝不展示！
        listIds = App.Config.ITEM_IDS.filter((id) => App.State.getItemCount(id) > 0);
      }

      if (!listIds.includes(selectedItemId)) {
        selectedItemId = listIds[0] || null;
      }

      const perPage = showItemCodex ? 9 : 6;
      const maxItemPage = Math.max(0, Math.ceil(listIds.length / perPage) - 1);
      itemPage = Math.min(itemPage, maxItemPage);
      const sliceIds = listIds.slice(itemPage * perPage, (itemPage + 1) * perPage);

      if (sliceIds.length === 0) {
        ctx.save();
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 15px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('当前仓库暂无宝箱与道具', 324, 248);
        ctx.fillStyle = '#fde68a';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText('可通过【攻克关隘】【铜钱商城】【天命抽奖】【福利签到】获取物资，或点右上查看【百宝图鉴】！', 324, 276);
        ctx.restore();
      } else if (showItemCodex) {
        sliceIds.forEach((itemId, idx) => {
          const cfg = App.Config.ITEMS[itemId];
          const cnt = App.State.getItemCount(itemId);
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const ix = 38 + col * 192;
          const iy = 148 + row * 90;
          const isSel = selectedItemId === itemId;

          App.UI.drawPanel(ctx, ix, iy, 182, 82, {
            r: 8, bg: '#3b2112', border: isSel ? '#fef08a' : '#a16207', lineWidth: isSel ? 2.4 : 1.2,
          });
          drawItemBoxIcon(ctx, itemId, ix + 10, iy + 11, 60, isSel);
          ctx.save();
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
          ctx.fillText(cfg.name.slice(0, 7), ix + 78, iy + 30);
          ctx.fillStyle = cnt > 0 ? '#4ade80' : '#a8a29e';
          ctx.font = 'bold 10.5px sans-serif';
          ctx.fillText(cnt > 0 ? `库存：×${cnt}` : '暂未获得', ix + 78, iy + 50);
          ctx.fillStyle = '#fde68a';
          ctx.font = '9.5px "PingFang SC", sans-serif';
          ctx.fillText(`估值 ${cfg.sellPrice} 铜钱`, ix + 78, iy + 68);
          ctx.restore();

          App.UI.addHit(ix, iy, 182, 82, () => { selectedItemId = itemId; });
        });
      } else {
        sliceIds.forEach((itemId, idx) => {
          const cfg = App.Config.ITEMS[itemId];
          const cnt = App.State.getItemCount(itemId);
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const ix = 42 + col * 190;
          const iy = 126 + row * 144;
          const isSel = selectedItemId === itemId;

          App.UI.drawPanel(ctx, ix, iy, 176, 132, {
            r: 10, bg: '#3b2112', border: isSel ? '#fef08a' : '#a16207', lineWidth: isSel ? 2.6 : 1.4,
          });
          drawItemBoxIcon(ctx, itemId, ix + 14, iy + 18, 70, isSel);

          ctx.save();
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
          ctx.fillText(cfg.name.slice(0, 6), ix + 92, iy + 38);
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(`拥有：×${cnt}`, ix + 92, iy + 64);
          ctx.fillStyle = '#fde68a';
          ctx.font = '10px "PingFang SC", sans-serif';
          const tagTxt = cfg.kind === 'chest' ? '可开启爆宝' : (cfg.kind === 'usable' ? '可直接使用' : (cfg.kind === 'special' ? '招降/特权' : '锻造/贡品'));
          ctx.fillText(tagTxt, ix + 92, iy + 88);
          ctx.restore();

          App.UI.addHit(ix, iy, 176, 132, () => { selectedItemId = itemId; });
        });
      }

      if (maxItemPage > 0) {
        App.UI.drawButton(ctx, 206, 426, 66, 26, '◀ 上页', { r: 6, bg: '#4a2c16', fontSize: 10.5, disabled: itemPage <= 0 }, () => { itemPage--; });
        ctx.save();
        ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${itemPage + 1} / ${maxItemPage + 1}`, 324, 443);
        ctx.restore();
        App.UI.drawButton(ctx, 376, 426, 66, 26, '下页 ▶', { r: 6, bg: '#4a2c16', fontSize: 10.5, disabled: itemPage >= maxItemPage }, () => { itemPage++; });
      }

      // 右侧：道具详情与使用/出售面板
      App.UI.drawPanel(ctx, 634, 114, 300, 346, { r: 10, bg: '#ead4a2', border: '#7c4a21', lineWidth: 2 });
      const cfg = selectedItemId ? App.Config.ITEMS[selectedItemId] : null;
      const cnt = selectedItemId ? App.State.getItemCount(selectedItemId) : 0;
      if (cfg) {
        const q = App.Config.QUALITIES[cfg.quality] || App.Config.QUALITIES.blue;
        drawItemBoxIcon(ctx, selectedItemId, 650, 130, 88, false);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#451a03';
        ctx.font = 'bold 16px "PingFang SC", sans-serif';
        ctx.fillText(cfg.name, 750, 156);
        ctx.fillStyle = q.bg;
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`品质：${q.name}`, 750, 180);
        ctx.fillStyle = cnt > 0 ? '#15803d' : '#78350f';
        ctx.fillText(`当前库存：${cnt} 件`, 750, 204);

        ctx.fillStyle = '#573318';
        ctx.font = '12px "PingFang SC", sans-serif';
        App.UI.drawWrappedText(ctx, cfg.desc, 650, 240, 268, 18, 'left');

        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`单件回收价格：${cfg.sellPrice} 铜钱`, 650, 304);
        ctx.restore();

        if (cnt > 0) {
          if (cfg.kind === 'chest' || cfg.kind === 'usable') {
            const btnText = cfg.kind === 'chest' ? `开启宝箱 (剩${cnt}个)` : `立即使用 (剩${cnt}个)`;
            App.UI.drawButton(ctx, 650, 324, 268, 44, btnText, {
              r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14,
            }, () => { App.State.useOrOpenItem(selectedItemId); });
          }
          App.UI.drawButton(ctx, 650, 380, 268, 42, `出售 1 件 (+${cfg.sellPrice} 铜钱)`, {
            r: 10, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13,
          }, () => { App.State.sellItem(selectedItemId); });
        } else {
          App.UI.drawButton(ctx, 650, 344, 268, 44, '前往铜钱商城 / 征战获取', {
            r: 10, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13,
          }, () => App.Main.goScene('shop'));
        }
      } else {
        ctx.save();
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 14px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无选中的库存道具', 784, 215);
        ctx.restore();
        App.UI.drawButton(ctx, 658, 252, 252, 42, '前往铜钱商城采购宝箱物资', {
          r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13,
        }, () => App.Main.goScene('shop'));
        App.UI.drawButton(ctx, 658, 308, 252, 42, '前往天命轮盘免费抽奖', {
          r: 10, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13,
        }, () => App.Main.goScene('wheel'));
      }

      App.Scenes.map.drawBottomNav(ctx, 'warehouse');
      return;
    }

    // ================= 分支 B：【24套传世神装】套装图鉴与收集进度（20套武将六件套 + 4套神兽四件套！） =================
    if (filterTab === 'sets') {
      const setIds = App.Config.EQUIP_SET_IDS || [];
      if (!setIds.includes(selectedSetId)) selectedSetId = setIds[0];
      const ownedTplSet = new Set((st.inventory || []).map((e) => e.tplId));

      // 左侧：24 套套装分页名录
      App.UI.drawPanel(ctx, 26, 114, 248, 346, { r: 10, bg: '#573b22', border: '#4a2c16', lineWidth: 1.5 });
      const sPerPage = 7;
      const maxSetPage = Math.max(0, Math.ceil(setIds.length / sPerPage) - 1);
      setPage = Math.min(setPage, maxSetPage);
      const sSlice = setIds.slice(setPage * sPerPage, (setPage + 1) * sPerPage);

      sSlice.forEach((sid, idx) => {
        const sCfg = App.Config.EQUIP_SETS[sid];
        const q = App.Config.QUALITIES[sCfg.quality] || App.Config.QUALITIES.blue;
        const ownedCnt = sCfg.pieceIds.filter((pid) => ownedTplSet.has(pid)).length;
        const isSel = sid === selectedSetId;
        const sy = 122 + idx * 42;

        App.UI.drawButton(ctx, 34, sy, 232, 36, '', {
          r: 8,
          grad: isSel ? ['#b45309', '#78350f'] : ['#3b2112', '#261409'],
          border: isSel ? '#fef08a' : q.color,
        }, () => { selectedSetId = sid; });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = isSel ? '#fef08a' : q.color;
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`${sCfg.isBeastSet ? '[兽] ' : ''}${sCfg.name}`, 44, sy + 22);
        ctx.textAlign = 'right';
        ctx.fillStyle = ownedCnt > 0 ? '#4ade80' : '#a8a29e';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${ownedCnt}/${sCfg.pieceIds.length}`, 256, sy + 22);
        ctx.restore();
      });

      App.UI.drawButton(ctx, 36, 424, 62, 26, '◀ 上页', { r: 6, bg: '#3b2112', fontSize: 10, disabled: setPage <= 0 }, () => { setPage--; });
      ctx.save();
      ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${setPage + 1}/${maxSetPage + 1} (共${setIds.length}套)`, 150, 441);
      ctx.restore();
      App.UI.drawButton(ctx, 198, 424, 62, 26, '下页 ▶', { r: 6, bg: '#3b2112', fontSize: 10, disabled: setPage >= maxSetPage }, () => { setPage++; });

      // 右侧：选中套装的 6 件（或神兽 4 件）高清图标展示 + 套装共鸣属性词条！
      const curSet = App.Config.EQUIP_SETS[selectedSetId];
      App.UI.drawPanel(ctx, 284, 114, 650, 346, { r: 10, bg: '#361c0d', border: '#d4a34b', lineWidth: 2 });
      if (curSet) {
        const q = App.Config.QUALITIES[curSet.quality];
        const ownedCnt = curSet.pieceIds.filter((pid) => ownedTplSet.has(pid)).length;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = q.color;
        ctx.font = 'bold 18px "PingFang SC", serif';
        ctx.fillText(`【${curSet.name}】 (${q.name}${curSet.isBeastSet ? ' · 四象神兽专属套装' : ' · 名将六件套装'})`, 302, 144);
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`当前已收集：${ownedCnt} / ${curSet.pieceIds.length} 件`, 768, 144);
        ctx.restore();

        curSet.pieceIds.forEach((pid, idx) => {
          const tpl = App.Config.EQUIP_TEMPLATES[pid];
          const hasIt = ownedTplSet.has(pid);
          const px = 302 + idx * 104;
          const py = 162;

          App.UI.drawPanel(ctx, px, py, 94, 132, {
            r: 9, bg: hasIt ? '#4c2612' : '#221108', border: hasIt ? '#4ade80' : q.color, lineWidth: hasIt ? 2.2 : 1.3,
          });
          ctx.save();
          if (!hasIt) ctx.globalAlpha = 0.72;
          App.Sprites.drawEquipIcon(ctx, pid, px + 11, py + 8, 72, { radius: 8, border: q.color, lineWidth: 1.8 });
          ctx.globalAlpha = 1;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
          ctx.fillText(tpl.name.slice(0, 6), px + 47, py + 97);
          ctx.fillStyle = hasIt ? '#4ade80' : '#a8a29e';
          ctx.font = '10px "PingFang SC", sans-serif';
          ctx.fillText(hasIt ? '✓ 已拥有' : `攻+${tpl.atk}`, px + 47, py + 116);
          ctx.restore();
        });

        // 套装共鸣属性面板
        App.UI.drawPanel(ctx, 302, 308, 614, 134, { r: 9, bg: 'rgba(18, 9, 4, 0.72)', border: '#a16207', lineWidth: 1.4 });
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px "PingFang SC", sans-serif';
        ctx.fillText('★ 同一武将/神兽穿戴同套装部件，自动激活【套装共鸣加成】：', 318, 332);
        curSet.bonuses.forEach((b, bi) => {
          const active = ownedCnt >= b.count;
          ctx.fillStyle = active ? '#4ade80' : '#e2e8f0';
          ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
          ctx.fillText(`${active ? '●' : '○'} ${b.desc}  ${active ? '(已集齐部件数)' : ''}`, 324, 360 + bi * 26);
        });
        ctx.restore();
      }

      App.Scenes.map.drawBottomNav(ctx, 'warehouse');
      return;
    }

    // ================= 分支 C：装备与神兽兽装网格与出售强化 =================
    const filtered = st.inventory.filter((eq) => {
      const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
      if (!tpl) return false;
      if (filterTab === 'beast_eq') return !!tpl.isBeastEquip;
      if (filterTab === 'weapon') return tpl.slot === 'weapon';
      if (filterTab === 'armor') return tpl.slot === 'armor' || tpl.slot === 'helm';
      if (filterTab === 'treasure') return tpl.slot === 'jade' || tpl.slot === 'book';
      if (filterTab === 'mount') return tpl.slot === 'mount';
      return true;
    });

    if (!selectedUid || !filtered.some((e) => e.uid === selectedUid)) {
      selectedUid = filtered[0] ? filtered[0].uid : null;
    }

    App.UI.drawPanel(ctx, 26, 114, 596, 346, { r: 10, bg: '#7c5c3e', border: '#4a2c16', lineWidth: 1.5 });
    const perPage = 18;
    const maxPage = Math.max(0, Math.ceil(filtered.length / perPage) - 1);
    page = Math.min(page, maxPage);
    const items = filtered.slice(page * perPage, (page + 1) * perPage);

    if (!items.length) {
      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('该分类暂无装备 — 开启宝箱、扫荡关卡或查看【24套神装】即可获取！', 324, 280);
      ctx.restore();
    } else {
      items.forEach((eq, idx) => {
        const col = idx % 6;
        const row = Math.floor(idx / 6);
        const ix = 38 + col * 96;
        const iy = 124 + row * 102;
        const tpl = App.Config.EQUIP_TEMPLATES[eq.tplId];
        const q = App.Config.QUALITIES[tpl.quality];
        const isSel = eq.uid === selectedUid;

        App.Sprites.drawEquipIcon(ctx, tpl.id, ix, iy, 82, {
          radius: 10, border: isSel ? '#ffffff' : q.color, lineWidth: isSel ? 3.2 : 2,
        });

        ctx.save();
        if (eq.equippedBy || eq.equippedByBeast) {
          ctx.fillStyle = eq.equippedByBeast ? '#0284c7' : '#15803d';
          App.UI.roundRect(ctx, ix + 4, iy + 4, 52, 15, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          const wearer = eq.equippedByBeast
            ? (App.Config.BEASTS[eq.equippedByBeast] ? App.Config.BEASTS[eq.equippedByBeast].shortName : '神兽')
            : (App.Config.GENERALS[eq.equippedBy] ? App.Config.GENERALS[eq.equippedBy].name : '穿戴');
          ctx.fillText(wearer, ix + 30, iy + 15);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(ix + 2, iy + 62, 78, 18);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tpl.name.slice(0, 4)} +${eq.enhance}`, ix + 41, iy + 75);
        ctx.restore();

        App.UI.addHit(ix, iy, 82, 86, () => { selectedUid = eq.uid; });
      });
    }

    if (maxPage > 0) {
      App.UI.drawButton(ctx, 230, 430, 64, 24, '◀ 上页', { r: 6, bg: '#4a2c16', fontSize: 10, disabled: page <= 0 }, () => { page--; });
      App.UI.drawButton(ctx, 354, 430, 64, 24, '下页 ▶', { r: 6, bg: '#4a2c16', fontSize: 10, disabled: page >= maxPage }, () => { page++; });
    }

    App.UI.drawPanel(ctx, 634, 114, 300, 346, { r: 10, bg: '#ead4a2', border: '#7c4a21', lineWidth: 2 });
    const selEq = st.inventory.find((e) => e.uid === selectedUid);
    if (selEq) {
      const tpl = App.Config.EQUIP_TEMPLATES[selEq.tplId];
      const q = App.Config.QUALITIES[tpl.quality];
      const bonus = App.Config.getEquipBonus(selEq);
      const sellPrice = App.Config.getEquipSellPrice(selEq);
      const enhCost = App.State.getCost('enhance', selEq.enhance);

      App.Sprites.drawEquipIcon(ctx, tpl.id, 650, 126, 86, { radius: 12, border: q.color, lineWidth: 2.5 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 16px "PingFang SC", sans-serif';
      ctx.fillText(`${tpl.name} +${selEq.enhance}`, 746, 150);
      ctx.fillStyle = q.bg;
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`品质：${q.name}${tpl.setName ? ` · ${tpl.setName}` : ''}`, 746, 173);
      const wearerDesc = selEq.equippedByBeast
        ? `穿戴神兽：${App.Config.BEASTS[selEq.equippedByBeast].name}`
        : (selEq.equippedBy ? `穿戴名将：${App.Config.GENERALS[selEq.equippedBy].name}` : (tpl.isBeastEquip ? '类型：神兽专属装备（闲置）' : '状态：仓库闲置'));
      ctx.fillStyle = (selEq.equippedBy || selEq.equippedByBeast) ? '#15803d' : '#78350f';
      ctx.fillText(wearerDesc, 746, 195);

      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`属性：攻击 +${bonus.atk}  气血 +${bonus.hp}  防御 +${bonus.def}`, 650, 234);
      ctx.fillText(`暴击 +${Math.round(bonus.crit * 100)}%   回收估值：${sellPrice} 铜钱`, 650, 255);

      if (tpl.setId && App.Config.EQUIP_SETS && App.Config.EQUIP_SETS[tpl.setId]) {
        const sCfg = App.Config.EQUIP_SETS[tpl.setId];
        ctx.fillStyle = '#9a3412';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`套装【${sCfg.name}】：${sCfg.bonuses[0].desc}`, 650, 279);
        if (sCfg.bonuses[1]) {
          ctx.fillText(`${sCfg.bonuses[1].desc}`, 650, 297);
        }
      }
      ctx.restore();

      App.UI.drawButton(ctx, 650, 314, 268, 40, `精炼强化 +1 (消耗 ${enhCost} 铜钱)`, {
        r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13,
      }, () => {
        App.State.enhanceEquip(selEq.uid);
      });

      if (selEq.equippedBy || selEq.equippedByBeast) {
        App.UI.drawButton(ctx, 650, 364, 268, 40, '卸下回仓库（卸下后可出售）', {
          r: 9, bg: '#57534e', border: '#d6d3d1', fontSize: 12,
        }, () => {
          App.State.unequipItem(selEq.uid).then((res) => { if (res.ok) App.UI.showToast('已卸下回仓库！', '#fde047'); });
        });
      } else {
        App.UI.drawButton(ctx, 650, 364, 130, 42, `出售(+${sellPrice})`, {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13,
        }, () => {
          App.State.sellEquip(selEq.uid).then((res) => { if (res.ok) selectedUid = null; });
        });

        App.UI.drawButton(ctx, 788, 364, 130, 42, tpl.isBeastEquip ? '去给神兽穿戴' : '去给武将穿戴', {
          r: 9, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13,
        }, () => App.Main.goScene(tpl.isBeastEquip ? 'beast' : 'roster'));
      }
    }

    App.Scenes.map.drawBottomNav(ctx, 'warehouse');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.warehouse = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
