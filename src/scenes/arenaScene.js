(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 演武场天梯：全服唯一名次，击败名次靠前的对手即与其互换名次；没有玩家占据的名次由系统军团驻守
  // 同时支持按主公 ID 或名称搜索玩家进行好友切磋（不消耗挑战令、不发奖励、不互换名次）
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

  // 对手与名次都由服务端生成并保存，客户端只展示
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
    ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const x = W / 2 - 280, y = 84, w = 560, h = 380;
    App.UI.drawPanel(ctx, x, y, w, h, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, x + 10, y + 10, w - 20, 40);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('演武战报（最近 20 场）', x + w / 2, y + 30);
    const logs = (info && info.logs) || [];
    ctx.textAlign = 'left'; ctx.font = '12.5px "PingFang SC", sans-serif';
    logs.slice(0, 11).forEach((l, i) => {
      const ry = y + 70 + i * 26;
      let text;
      if (l.attack) text = l.win ? `你击败了【${l.name}】` + (l.to < l.from ? `，名次 ${l.from} → ${l.to}` : '') : `你挑战【${l.name}】失利`;
      else text = l.win ? `【${l.name}】前来挑战，被你击退` : `【${l.name}】击败了你` + (l.to !== l.from ? `，名次 ${l.from} → ${l.to}` : '');
      ctx.fillStyle = '#92400e'; ctx.fillText(fmtTime(l.t), x + 24, ry);
      ctx.fillStyle = l.win ? '#15803d' : '#b91c1c'; ctx.fillText(text, x + 118, ry, w - 142);
    });
    if (!logs.length) { ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.fillText('还没有战报，去挑战一场吧', x + w / 2, y + 180); }
    ctx.restore();
    App.UI.drawButton(ctx, x + w / 2 - 60, y + h - 50, 120, 36, '关闭', { r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13 }, () => { showLogs = false; });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 64, W - 28, 408, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 28, 78, W - 56, 54, { r: 10, bg: '#5c2c16', border: '#d4a34b' });

    const ranked = info && info.rank < 9999;
    const inSearch = !!searchKeyword;
    const searchPages = Math.max(1, Math.ceil(searchMatches.length / 3));
    if (searchPage >= searchPages) searchPage = 0;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15.5px "PingFang SC", serif';
    if (inSearch) {
      ctx.fillText(`好友切磋 · 搜索「${searchKeyword}」（共 ${searchMatches.length} 人）`, 42, 102, 340);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(
        searchPages > 1
          ? `切磋演武不耗挑战令 · 不互换名次 · 第 ${searchPage + 1}/${searchPages} 页`
          : '切磋演武不消耗挑战令 · 不发放奖励 · 不互换天梯名次',
        42, 122, 340
      );
    } else {
      ctx.fillText(ranked ? `演武场天梯 · 第 ${info.rank} 名 · ${info.title}` : '演武场天梯', 42, 102, 340);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(ranked
        ? `历史最高第 ${info.bestRank || info.rank} 名 · ${info.wins} 胜 ${info.losses} 负 · 战力 ${App.State.getTeamPower()} · 挑战令 ${st.arenaTickets}`
        : '击败名次靠前的对手即可夺取其名次', 42, 122, 340);
    }
    ctx.restore();

    if (inSearch) {
      App.UI.drawButton(ctx, 392, 88, 98, 34, '← 返回天梯', {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 12,
      }, () => {
        searchKeyword = '';
        searchMatches = [];
        searchPage = 0;
      });
      App.UI.drawButton(ctx, 496, 88, 104, 34, '重新搜索', {
        r: 8, icon: 'search', grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 12, loading, loadingText: '查找中',
      }, openSearchPrompt);
    } else {
      App.UI.drawButton(ctx, 392, 88, 98, 34, '搜ID/主公', {
        r: 8, icon: 'search', grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 11.5, loading: false,
      }, openSearchPrompt);
      const claimed = !info || info.rewardClaimed;
      App.UI.drawButton(ctx, 496, 88, 104, 34, claimed ? '今日已领奖' : '领排名奖励', {
        r: 8, grad: ['#15803d', '#166534'], border: '#bbf7d0', fontSize: 11.5, disabled: claimed,
      }, () => {
        App.State.arenaReward().then((res) => { if (res.ok && res.arena) info = res.arena; });
      });
    }

    App.UI.drawButton(ctx, 606, 88, 62, 34, '战报', { r: 8, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 12 }, () => { showLogs = true; });
    if (inSearch && searchPages > 1) {
      App.UI.drawButton(ctx, 674, 88, 92, 34, `换页 ${searchPage + 1}/${searchPages}`, {
        r: 8, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 11.5,
      }, () => { searchPage = (searchPage + 1) % searchPages; });
    } else {
      App.UI.drawButton(ctx, 674, 88, 92, 34, '换一批对手', {
        r: 8, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 11.5, loading: loading && !inSearch, loadingText: '匹配中',
      }, () => refresh(true));
    }
    App.UI.drawAdButton(ctx, 772, 88, 152, 34, '挑战令 +3', { r: 8, fontSize: 11.5 }, () => {
      App.Platform.showRewardedAd('arena_ticket', '观看激励视频，免费领取演武场挑战令 +3！', () => {
        App.State.claimAd('arena_ticket');
      });
    });

    const cardW = 290;
    const cardH = 304;
    const displayList = inSearch
      ? searchMatches.slice(searchPage * 3, searchPage * 3 + 3)
      : matches.slice(0, 3);

    if (loading && !displayList.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 295, inSearch ? '正在查找主公军团…' : '正在搜寻天梯对手…');
    } else if (!displayList.length && info) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.fillText(info.rank === 1 ? '你已登顶天梯榜首，静候各路豪杰前来挑战！' : '暂时没有可挑战的对手，请稍后再试', W / 2, 295);
      ctx.restore();
    }
    displayList.forEach((m, idx) => {
      const cx = 28 + idx * (cardW + 17);
      const cy = 146;
      const isSpar = !!m.spar;
      const hasRank = m.rank > 0 && m.rank < 9999;

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, { r: 12, bg: '#e8d4a6', border: '#9a3412', lineWidth: 2 });
      App.UI.drawWoodHeader(ctx, cx + 8, cy + 8, cardW - 16, 48);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15px "PingFang SC", sans-serif';
      ctx.fillText(hasRank ? `第 ${m.rank} 名 · ${m.playerName}` : `未入榜 · ${m.playerName}`, cx + 18, cy + 30, cardW - 92);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      const subLine = m.isPlayer && m.playerId
        ? `${m.title} · ID:${m.playerId} · 战力 ${m.power}`
        : `${m.title}   军团战力：${m.power}`;
      ctx.fillText(subLine, cx + 18, cy + 48, cardW - 36);
      ctx.textAlign = 'right';
      ctx.fillStyle = isSpar ? '#fde047' : (m.isPlayer ? '#86efac' : '#d6d3d1');
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(isSpar ? '好友切磋' : (m.isPlayer ? '玩家' : '系统军团'), cx + cardW - 18, cy + 30);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`对方防守阵容（Lv.${m.lv}）：`, cx + 14, cy + 78);
      ctx.restore();

      (m.generals || []).slice(0, 5).forEach((gid, gIdx) => {
        const px = cx + 12 + gIdx * 54;
        App.Portraits.drawGeneralPortrait(ctx, gid, px, cy + 88, 50, { radius: 7, lineWidth: 1.6 });
        ctx.save();
        ctx.fillStyle = '#451a03';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((App.Config.GENERALS[gid] || {}).name || '', px + 25, cy + 152, 52);
        ctx.restore();
      });

      ctx.save();
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      const bName = m.beast && App.Config.BEASTS[m.beast] ? App.Config.BEASTS[m.beast].name : '无守护神兽';
      ctx.fillText(`守护神兽：${bName}`, cx + 14, cy + 182);
      if (isSpar) {
        ctx.fillStyle = '#b45309';
        ctx.fillText('好友切磋：免挑战令 · 不计名次与胜负奖励', cx + 14, cy + 206, cardW - 28);
      } else {
        ctx.fillStyle = '#15803d';
        ctx.fillText(`胜利：夺取第 ${m.rank} 名 · 铜钱+${m.rewardGold} 将魂+${m.rewardSoul}`, cx + 14, cy + 206, cardW - 28);
      }
      ctx.restore();

      const btnTitle = isSpar ? '发起切磋' : (st.arenaTickets > 0 ? '发起挑战' : '挑战令不足');
      const btnSub = isSpar ? '免费试阵 · 不变天梯名次' : (st.arenaTickets > 0 ? '消耗1张挑战令' : '点击上方看广告领取');
      App.UI.drawButton(ctx, cx + 28, cy + 236, cardW - 56, 48, btnTitle, {
        r: 10,
        grad: isSpar ? ['#c2410c', '#7c2d12'] : ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 15,
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

    App.Scenes.map.drawBottomNav(ctx, 'arena');
    if (showLogs) drawLogs(ctx, W, H);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.arena = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
