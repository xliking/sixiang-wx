(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const PAGE_SIZE = 4;
  const TIER_TABS = [
    { id: 'all', label: '全部神兽' },
    { id: 'four_symbols', label: '四象圣兽' },
    { id: 'fierce_four', label: '太古四凶' },
    { id: 'primordial', label: '上古神兽' },
  ];

  const TIER_BY_ID = {
    qinglong: 'four_symbols', zhuque: 'four_symbols', xuanwu: 'four_symbols', baihu: 'four_symbols',
    taotie: 'fierce_four', qiongqi: 'fierce_four', taowu: 'fierce_four', hundun: 'fierce_four',
    qilin: 'primordial', baize: 'primordial', kunpeng: 'primordial', zhulong: 'primordial',
  };

  const TIER_BADGE = {
    four_symbols: { name: '四象圣兽', bg: '#065f46', border: '#34d399', text: '#a7f3d0' },
    fierce_four:  { name: '太古四凶', bg: '#581c87', border: '#e879f9', text: '#f5d0fe' },
    primordial:   { name: '上古神兽', bg: '#7c2d12', border: '#facc15', text: '#fef08a' },
  };

  let activeTier = 'all';
  let pageIdx = 0;

  function enter(params) {
    if (params && params.tier) {
      activeTier = params.tier;
      pageIdx = 0;
    } else if (params && params.beastId) {
      activeTier = 'all';
      const all = App.Config.getBeastDungeons();
      const idx = all.findIndex((d) => d.beastId === params.beastId);
      pageIdx = idx >= 0 ? Math.floor(idx / PAGE_SIZE) : 0;
    }
  }

  function resolveTier(bCfg, bid) {
    return (bCfg && bCfg.tier) || TIER_BY_ID[bid] || 'four_symbols';
  }

  function render(ctx, rawTime) {
    const time = rawTime || 0;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const allDungeons = App.Config.getBeastDungeons();
    const lordLv = st.lordLevel || 1;

    // 洪荒祭坛深色玄金大底板
    ctx.fillStyle = '#120a06';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高洪荒神殿画框（y=58..532，彻底消除底部留白与冗余返回条）
    ctx.save();
    App.UI.roundRect(ctx, 26, 58, W - 52, 474, 15);
    const bgG = ctx.createLinearGradient(26, 58, 26, 532);
    bgG.addColorStop(0, '#26140b');
    bgG.addColorStop(0.55, '#180c07');
    bgG.addColorStop(1, '#100805');
    ctx.fillStyle = bgG;
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    App.UI.roundRect(ctx, 31, 63, W - 62, 464, 12);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 顶部神兽猎场导航横匾（去繁就简：标题 + 四象/四凶/上古筛选签 + 绳索库存 + 右上角 ✕）
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#1b0c06', border: '#b45309', lineWidth: 1.6 });
    const iconImg = App.Assets.get('icon_beast_dungeon');
    if (iconImg) ctx.drawImage(iconImg, 44, 70, 34, 34);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('万兽秘境', iconImg ? 84 : 48, 87);
    ctx.restore();

    let tabX = 166;
    TIER_TABS.forEach((tb) => {
      const isCur = activeTier === tb.id;
      App.UI.drawButton(ctx, tabX, 73, 86, 28, tb.label, {
        r: 7,
        grad: isCur ? ['#d97706', '#92400e'] : undefined,
        bg: isCur ? undefined : 'rgba(42, 20, 10, 0.78)',
        border: isCur ? '#fef08a' : 'rgba(217, 119, 6, 0.42)',
        color: isCur ? '#fffbeb' : '#e7d5b8',
        fontSize: 11,
      }, () => {
        if (activeTier !== tb.id) {
          activeTier = tb.id;
          pageIdx = 0;
        }
      });
      tabX += 92;
    });

    // 缚兽索库存轻巧胶囊 + 灵栏快捷入口 + 右上角 ✕ 关闭按钮
    App.UI.drawPanel(ctx, W - 318, 73, 146, 28, { r: 14, bg: 'rgba(15, 23, 42, 0.78)', border: 'rgba(56, 189, 248, 0.55)', lineWidth: 1.2 });
    App.UI.drawMiniIcon(ctx, 'res_rope', W - 310, 77, 20);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
    ctx.fillText(`索 ${st.ropes || 0} · 金索 ${st.goldRopes || 0}`, W - 286, 87);
    ctx.restore();

    App.UI.drawButton(ctx, W - 164, 73, 82, 28, '前往兽栏', {
      r: 7, grad: ['#0f766e', '#115e59'], border: '#99f6e4', fontSize: 10.5,
    }, () => App.Main.goScene('beast'));

    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    const dungeons = allDungeons.filter((d) => {
      if (activeTier === 'all') return true;
      const bCfg = App.Config.BEASTS[d.beastId];
      return resolveTier(bCfg, d.beastId) === activeTier;
    });

    const totalPages = Math.max(1, Math.ceil(dungeons.length / PAGE_SIZE));
    if (pageIdx >= totalPages) pageIdx = totalPages - 1;
    if (pageIdx < 0) pageIdx = 0;
    const pageList = dungeons.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

    const startX = 38;
    const startY = 116;
    const gap = 12;
    const cardW = 212;
    const cardH = 404;

    pageList.forEach((d, idx) => {
      const bCfg = App.Config.BEASTS[d.beastId];
      if (!bCfg) return;
      const owned = st.ownedBeasts[d.beastId];
      const tierKey = resolveTier(bCfg, d.beastId);
      const tBadge = TIER_BADGE[tierKey] || TIER_BADGE.four_symbols;
      const reqLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(d.beastId) : (d.unlockLordLv || 15);
      const cardUnlocked = lordLv >= reqLv;
      const cx = startX + idx * (cardW + gap);
      const cy = startY;
      const midX = cx + cardW / 2;

      // 神兽本命元素图腾柱卡片
      ctx.save();
      App.UI.roundRect(ctx, cx, cy, cardW, cardH, 13);
      const cg = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      if (cardUnlocked) {
        cg.addColorStop(0, bCfg.darkColor || '#1e1b4b');
        cg.addColorStop(0.42, '#1a100b');
        cg.addColorStop(1, '#110a06');
      } else {
        cg.addColorStop(0, '#272320');
        cg.addColorStop(1, '#141110');
      }
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = cardUnlocked ? bCfg.glow : '#57534e';
      ctx.lineWidth = cardUnlocked ? 2.2 : 1.4;
      ctx.stroke();

      // 背后元素呼吸神环
      const pulse = 0.22 + 0.08 * Math.sin(time * 2.8 + idx);
      const auraG = ctx.createRadialGradient(midX, cy + 104, 10, midX, cy + 104, 78);
      auraG.addColorStop(0, cardUnlocked ? bCfg.glow : '#78716c');
      auraG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = cardUnlocked ? pulse : 0.12;
      ctx.fillStyle = auraG;
      ctx.beginPath();
      ctx.arc(midX, cy + 104, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 顶部阶位印章 + 栖息秘境方位
      ctx.save();
      ctx.fillStyle = cardUnlocked ? tBadge.bg : '#3f3b37';
      App.UI.roundRect(ctx, cx + 10, cy + 9, 64, 19, 6);
      ctx.fill();
      ctx.strokeStyle = cardUnlocked ? tBadge.border : '#78716c';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = cardUnlocked ? tBadge.text : '#cbd5e1';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tBadge.name, cx + 42, cy + 18.5);

      ctx.textAlign = 'right';
      ctx.fillStyle = cardUnlocked ? '#fde68a' : '#a8a29e';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(bCfg.direction || '', cx + cardW - 10, cy + 19);
      ctx.restore();

      // 巨幅神兽立绘（124x124）
      const pSz = 124;
      const px = Math.round(midX - pSz / 2);
      const py = cy + 36;
      ctx.save();
      if (!cardUnlocked) ctx.globalAlpha = 0.55;
      App.Portraits.drawBeastPortrait(ctx, d.beastId, px, py, pSz, {
        radius: 14,
        border: cardUnlocked ? bCfg.glow : '#78716c',
        lineWidth: 2.5,
      });
      ctx.restore();

      // 立绘底部收服状态/概率胶囊条
      ctx.save();
      const statusY = py + pSz - 16;
      App.UI.roundRect(ctx, px + 8, statusY, pSz - 16, 20, 10);
      ctx.fillStyle = owned ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 10, 8, 0.88)';
      ctx.fill();
      ctx.strokeStyle = owned ? '#34d399' : (cardUnlocked ? bCfg.glow : '#78716c');
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      if (owned) {
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(`✓ 已收服 Lv.${owned.lv} · ${owned.star || 1}★`, midX, statusY + 10);
      } else {
        ctx.fillStyle = cardUnlocked ? '#fde047' : '#cbd5e1';
        ctx.fillText(`捕获率 ${Math.round((bCfg.baseCatchRate || 0.25) * 100)}% (金索翻倍)`, midX, statusY + 10);
      }

      // 神兽圣名 + 绝技展示框
      ctx.fillStyle = cardUnlocked ? bCfg.glow : '#d6d3d1';
      ctx.font = 'bold 19px "PingFang SC", serif';
      ctx.fillText(bCfg.name, midX, cy + 184);

      ctx.fillStyle = 'rgba(8, 4, 2, 0.65)';
      App.UI.roundRect(ctx, cx + 10, cy + 198, cardW - 20, 66, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`✦ 绝技【${bCfg.skillName}】`, midX, cy + 213);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.textBaseline = 'alphabetic';
      App.UI.drawWrappedText(ctx, bCfg.skillDesc || '', midX, cy + 232, cardW - 30, 14, 'center');

      // 必掉神兽金装与推荐战力条
      const dropTpl = d.fixedDrop && App.Config.EQUIP_TEMPLATES ? App.Config.EQUIP_TEMPLATES[d.fixedDrop] : null;
      ctx.fillStyle = 'rgba(28, 14, 7, 0.82)';
      App.UI.roundRect(ctx, cx + 10, cy + 272, cardW - 20, 34, 8);
      ctx.fill();
      if (dropTpl) {
        App.Sprites.drawEquipIcon(ctx, dropTpl.id, cx + 15, cy + 276, 26, { radius: 5, border: '#facc15', lineWidth: 1.4 });
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText(`必掉：${dropTpl.name}`, cx + 46, cy + 293, cardW - 60);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText('必掉神兽专属灵装', midX, cy + 293);
      }

      const recPower = App.Config.scaleRecommendedPower
        ? App.Config.scaleRecommendedPower('beast', d.recommendedPower || 30000, d)
        : (d.recommendedPower || 30000);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`推荐战力 ${recPower}`, midX, cy + 324);
      ctx.restore();

      // 底部讨伐按钮
      if (!cardUnlocked) {
        App.UI.drawButton(ctx, cx + 16, cy + 338, cardW - 32, 50, `🔒 主公 Lv.${reqLv} 解锁`, {
          r: 10,
          bg: '#44403c',
          border: '#78716c',
          fontSize: 12.5,
          subText: `当前 Lv.${lordLv} · 推图升级开启`,
        }, () => {
          App.UI.showToast(`主公达到 Lv.${reqLv} 方可讨伐并抓捕【${bCfg.name}】！`, '#fbbf24');
          App.Main.goScene('map');
        });
      } else {
        const costSta = App.State.getStaminaCost(d.staminaCost);
        const hasSta = st.stamina >= costSta;
        const onBeastAct = () => {
          if (!hasSta) {
            App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 军粮体力！', () => {
              App.State.claimAd('stamina');
            });
            return;
          }
          App.Main.startBattle('beast', d.id, { level: d });
        };
        if (hasSta) {
          App.UI.drawButton(ctx, cx + 16, cy + 338, cardW - 32, 50, owned ? '再次讨伐 · 升星夺宝' : '讨伐并抓捕', {
            r: 10,
            grad: [bCfg.color, bCfg.darkColor],
            border: '#fef08a',
            fontSize: 13,
            subText: `消耗 ${costSta} 粮草体力`,
          }, onBeastAct);
        } else {
          App.UI.drawAdButton(ctx, cx + 16, cy + 338, cardW - 32, 50, '免费补粮 +15', {
            r: 10,
            fontSize: 13,
            subText: '恢复军粮后立即讨伐',
          }, onBeastAct);
        }
      }
    });

    // 左右两侧翻页耳标按钮
    App.UI.drawSidePageButtons(ctx, pageIdx, totalPages, (nextP) => {
      pageIdx = nextP;
    }, {
      cy: 318,
      grad: ['#78350f', '#2b1206'],
      border: '#f59e0b',
      arrowColor: '#fef08a',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.beastDungeon = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
