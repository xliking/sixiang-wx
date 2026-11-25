(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let matches = [];
  let info = null;
  let loading = false;
  let showLogs = false;
  let searchKeyword = '';
  let searchMatches = [];
  let searchPage = 0;
  let returningFromSpar = false;

  function enter() {
    showLogs = false;
    if (returningFromSpar && searchKeyword) {
      returningFromSpar = false;
      if (!info) refresh(false);
      return;
    }
    returningFromSpar = false;
    searchKeyword = '';
    searchMatches = [];
    searchPage = 0;
    refresh(false);
  }

  async function refresh(isManual) {
    if (loading) return;
    loading = true;
    try {
      const res = await App.API.fetchArena(!!isManual);
      if (res && res.ok) {
        matches = res.matches || [];
        info = res.arena || info;
        if (isManual) {
          searchKeyword = '';
          searchMatches = [];
          searchPage = 0;
          App.UI.showToast('已换一批天梯对手', '#fef08a');
        }
      } else if (res && res.msg) {
        App.UI.showToast(res.msg, '#f87171');
      }
    } finally {
      loading = false;
    }
  }

  async function doSearch(rawKw) {
    const kw = String(rawKw || '').trim().slice(0, 20);
    if (!kw || loading) return;
    loading = true;
    try {
      const res = await App.API.searchArena(kw);
      if (res && res.ok) {
        const list = res.matches || [];
        if (!list.length) {
          App.UI.showToast(`未找到「${kw}」对应的主公，请核对 ID 或名号`, '#fbbf24');
          return;
        }
        searchKeyword = res.keyword || kw;
        searchMatches = list;
        searchPage = 0;
        App.UI.showToast(`已找到 ${list.length} 位主公，可免费发起好友切磋`, '#86efac');
      } else if (res && res.msg) {
        App.UI.showToast(res.msg, '#f87171');
      }
    } finally {
      loading = false;
    }
  }

  function openSearchPrompt() {
    App.Platform.promptText('输入要搜索的主公 ID（如 100001）或主公名称：', (txt) => {
      doSearch(txt);
    }, { maxLength: 20, defaultValue: searchKeyword || '' });
  }

  function fmtTime(t) {
    const d = new Date(t);
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getMonth() + 1}-${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function drawLogs(ctx, W, H) {
    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const x = W / 2 - 280, y = 76, w = 560, h = 400;
    App.UI.drawPanel(ctx, x, y, w, h, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, x + 10, y + 10, w - 20, 42);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('演武战报（最近 20 场）', x + w / 2, y + 31);
    const logs = (info && info.logs) || [];
    ctx.textAlign = 'left'; ctx.font = '12.5px "PingFang SC", sans-serif';
    logs.slice(0, 12).forEach((l, i) => {
      const ry = y + 72 + i * 26;
      let text;
      if (l.attack) text = l.win ? `你击败了【${l.name}】` + (l.to < l.from ? `，名次 ${l.from} → ${l.to}` : '') : `你挑战【${l.name}】失利`;
      else text = l.win ? `【${l.name}】前来挑战，被你击退` : `【${l.name}】击败了你` + (l.to !== l.from ? `，名次 ${l.from} → ${l.to}` : '');
      ctx.fillStyle = '#92400e'; ctx.fillText(fmtTime(l.t), x + 24, ry);
      ctx.fillStyle = l.win ? '#15803d' : '#b91c1c'; ctx.fillText(text, x + 118, ry, w - 142);
    });
    if (!logs.length) { ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.fillText('还没有战报，去挑战一场吧', x + w / 2, y + 200); }
    ctx.restore();
    App.UI.drawCloseButton(ctx, x + w - 46, y + 15, 32, () => { showLogs = false; });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高演武场大画板（y=58..532，移除底部返回条与多余我方战力文字）
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 48, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.6 });

    const ranked = info && info.rank < 9999;
    const inSearch = !!searchKeyword;
    const searchPages = Math.max(1, Math.ceil(searchMatches.length / 3));
    if (searchPage >= searchPages) searchPage = 0;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15.5px "PingFang SC", serif';
    if (inSearch) {
      ctx.fillText(`好友切磋 · 搜索「${searchKeyword}」（${searchMatches.length}人）`, 48, 86, 316);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText('免挑战令 · 不互换天梯名次', 48, 105, 316);
    } else {
      ctx.fillText(ranked ? `演武场 · 第 ${info.rank} 名（${info.title}）` : '演武场天梯', 48, 86, 316);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(ranked
        ? `最高第 ${info.bestRank || info.rank} 名 · ${info.wins}胜${info.losses}负 · 挑战令 ${st.arenaTickets}`
        : `击败前排对手夺取名次 · 挑战令 ${st.arenaTickets}`, 48, 105, 316);
    }
    ctx.restore();

    if (inSearch) {
      App.UI.drawButton(ctx, 374, 74, 92, 32, '← 回天梯', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
      }, () => {
        searchKeyword = '';
        searchMatches = [];
        searchPage = 0;
      });
      App.UI.drawButton(ctx, 472, 74, 96, 32, '重新搜索', {
        r: 8, icon: 'search', grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 11.5, loading, loadingText: '查找中',
      }, openSearchPrompt);
    } else {
      App.UI.drawButton(ctx, 374, 74, 94, 32, '搜ID/主公', {
        r: 8, icon: 'search', grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 11, loading: false,
      }, openSearchPrompt);
      const claimed = !info || info.rewardClaimed;
      App.UI.drawButton(ctx, 474, 74, 98, 32, claimed ? '今日已领奖' : '领排名奖励', {
        r: 8, grad: ['#15803d', '#166534'], border: '#bbf7d0', fontSize: 11, disabled: claimed,
      }, () => {
        App.State.arenaReward().then((res) => { if (res.ok && res.arena) info = res.arena; });
      });
    }

    App.UI.drawButton(ctx, 578, 74, 58, 32, '战报', { r: 8, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 11.5 }, () => { showLogs = true; });
    App.UI.drawButton(ctx, 642, 74, 92, 32, '换一批对手', {
      r: 8, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 11, loading: loading && !inSearch, loadingText: '匹配中', disabled: inSearch,
    }, () => refresh(true));

    App.UI.drawAdButton(ctx, 740, 74, 136, 32, '挑战令 +3', { r: 8, fontSize: 11 }, () => {
      App.Platform.showRewardedAd('arena_ticket', '观看激励视频，免费领取演武场挑战令 +3！', () => {
        App.State.claimAd('arena_ticket');
      });
    });

    App.UI.drawCloseButton(ctx, W - 74, 74, 32, () => App.Main.goScene('map'));

    const cardW = 288;
    const cardH = 396;
    const displayList = inSearch
      ? searchMatches.slice(searchPage * 3, searchPage * 3 + 3)
      : matches.slice(0, 3);

    if (loading && !displayList.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 310, inSearch ? '正在查找主公军团…' : '正在搜寻天梯对手…');
    } else if (!displayList.length && info) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.fillText(info.rank === 1 ? '你已登顶天梯榜首，静候各路豪杰前来挑战！' : '暂时没有可挑战的对手，请稍后再试', W / 2, 310);
      ctx.restore();
    }
    displayList.forEach((m, idx) => {
      const cx = 38 + idx * (cardW + 10);
      const cy = 124;
      const isSpar = !!m.spar;
      const hasRank = m.rank > 0 && m.rank < 9999;

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, { r: 12, bg: '#ead8ad', border: '#9a3412', lineWidth: 2 });
      App.UI.drawWoodHeader(ctx, cx + 8, cy + 8, cardW - 16, 54);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15.5px "PingFang SC", sans-serif';
      ctx.fillText(hasRank ? `第 ${m.rank} 名 · ${m.playerName}` : `未入榜 · ${m.playerName}`, cx + 18, cy + 31, cardW - 92);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      const subLine = m.isPlayer && m.playerId
        ? `${m.title} · ID:${m.playerId} · 战力 ${m.power}`
        : `${m.title}   军团战力：${m.power}`;
      ctx.fillText(subLine, cx + 18, cy + 51, cardW - 36);
      ctx.textAlign = 'right';
      ctx.fillStyle = isSpar ? '#fde047' : (m.isPlayer ? '#86efac' : '#d6d3d1');
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(isSpar ? '好友切磋' : (m.isPlayer ? '玩家' : '系统军团'), cx + cardW - 18, cy + 31);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`防守阵容（Lv.${m.lv}）：`, cx + 14, cy + 88);
      ctx.restore();

      (m.generals || []).slice(0, 5).forEach((gid, gIdx) => {
        const px = cx + 13 + gIdx * 53;
        App.Portraits.drawGeneralPortrait(ctx, gid, px, cy + 102, 50, { radius: 8, lineWidth: 1.8 });
        ctx.save();
        ctx.fillStyle = '#451a03';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((App.Config.GENERALS[gid] || {}).name || '', px + 25, cy + 168, 52);
        ctx.restore();
      });

      const bCfg = m.beast && App.Config.BEASTS[m.beast] ? App.Config.BEASTS[m.beast] : null;
      App.UI.drawPanel(ctx, cx + 14, cy + 186, cardW - 28, 56, { r: 8, bg: 'rgba(69, 26, 3, 0.12)', border: 'rgba(154, 52, 18, 0.35)', lineWidth: 1 });
      if (bCfg) {
        App.Portraits.drawBeastPortrait(ctx, bCfg.id, cx + 22, cy + 193, 42, { radius: 8, border: bCfg.glow, lineWidth: 1.6 });
      }
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(bCfg ? `守护神兽：${bCfg.name}` : '守护神兽：暂未任命上阵', cx + (bCfg ? 72 : 24), cy + 219);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      if (isSpar) {
        ctx.fillStyle = '#b45309';
        ctx.fillText('好友切磋：免挑战令 · 不计名次与胜负奖励', cx + cardW / 2, cy + 274, cardW - 28);
      } else {
        ctx.fillStyle = '#15803d';
        ctx.fillText(`胜利：夺取第 ${m.rank} 名 · 铜钱+${m.rewardGold} 将魂+${m.rewardSoul}`, cx + cardW / 2, cy + 274, cardW - 28);
      }
      ctx.restore();

      const btnTitle = isSpar ? '发起切磋' : (st.arenaTickets > 0 ? '发起挑战' : '挑战令不足');
      const btnSub = isSpar ? '免费试阵 · 不变天梯名次' : (st.arenaTickets > 0 ? '消耗 1 张挑战令' : '点击上方看广告领取');
      App.UI.drawButton(ctx, cx + 24, cy + 306, cardW - 48, 54, btnTitle, {
        r: 11,
        grad: isSpar ? ['#c2410c', '#7c2d12'] : ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 15.5,
        subText: btnSub,
        disabled: !isSpar && st.arenaTickets <= 0,
      }, () => {
        if (isSpar) returningFromSpar = true;
        App.Main.startBattle('arena', m.id, {
          arenaMatch: m,
          level: { biome: 'plains', battleKey: (App.Config.ARENA && App.Config.ARENA.battleKey) || 'bg_battle_chibi', order: 8, lordExp: isSpar ? 0 : 140 },
        }).then((res) => {
          if (!res.ok) {
            returningFromSpar = false;
            if (!isSpar) refresh(false);
          }
        });
      });
    });

    if (inSearch && searchPages > 1) {
      App.UI.drawSidePageButtons(ctx, searchPage, searchPages, (p) => { searchPage = p; }, {
        cy: 322, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
      });
    }

    if (showLogs) drawLogs(ctx, W, H);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.arena = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
