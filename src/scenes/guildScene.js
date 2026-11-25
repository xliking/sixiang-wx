(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const ROLE = ['成员', '长老', '盟主'];
  const REWARD_NAMES = { gold: '铜钱', soul: '将魂', stamina: '粮草体力', arenaTickets: '演武挑战令', wheelTickets: '抽奖次数', goldRopes: '黄金缚兽索', ropes: '缚兽索' };
  let mine = null;
  let list = [];
  let total = 0;
  let listPage = 1;
  let keyword = '';
  let tab = 'hall';
  let memberPage = 0;
  let boss = null;
  let loading = false;

  async function loadMine() {
    loading = true;
    try {
      const res = await App.API.get('/api/guild/mine');
      if (res && res.ok) {
        mine = res;
        if (!res.guild) await loadList();
      }
    } finally {
      loading = false;
    }
  }

  async function loadList() {
    const res = await App.API.get('/api/guild/list?page=' + listPage + (keyword ? '&keyword=' + encodeURIComponent(keyword) : ''));
    if (res && res.ok) { list = res.list || []; total = res.total || 0; }
  }

  async function loadBoss() {
    const res = await App.API.get('/api/guild/boss');
    if (res && res.ok) boss = res;
  }

  function enter() { tab = 'hall'; memberPage = 0; listPage = 1; keyword = ''; boss = null; loadMine(); }

  function op(path, data) {
    return App.State.act('/api/guild/' + path, data || {}).then((res) => { if (res.ok) loadMine(); return res; });
  }

  function rewardName(r) {
    const n = r.type === 'item' ? ((App.Config.ITEMS[r.id] || {}).name || r.id) : (REWARD_NAMES[r.type] || r.type);
    return n + ' ×' + r.amount;
  }

  function label(ctx, text, x, y, font, color, align, maxW) {
    ctx.save();
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.font = font;
    ctx.fillText(text, x, y, maxW);
    ctx.restore();
  }

  function drawLobby(ctx, W) {
    const cfg = App.Config.GUILD, st = App.State.get();
    label(ctx, '加入联盟 · 与盟友共讨联盟BOSS、兑换联盟商店', 48, 87, 'bold 15.5px "PingFang SC", serif', '#fef08a');
    App.UI.drawButton(ctx, W - 418, 72, 98, 30, keyword ? '清除搜索' : '搜索联盟', { r: 7, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 12 }, () => {
      if (keyword) { keyword = ''; listPage = 1; loadList(); return; }
      App.Platform.promptText('输入联盟名称关键字', (text) => { keyword = String(text || '').trim().slice(0, 8); listPage = 1; loadList(); });
    });
    App.UI.drawButton(ctx, W - 312, 72, 224, 30, `创建联盟（${cfg.createCost || 0} 铜钱）`, { r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12, disabled: st.gold < (cfg.createCost || 0) }, () => {
      App.Platform.promptText('为联盟起个名字（2~8 个字，需审核通过后成立）', (name) => op('create', { name }));
    });

    list.slice(0, 8).forEach((g, i) => {
      const x = 38 + (i % 2) * 446, y = 120 + Math.floor(i / 2) * 98;
      const full = g.memberCount >= g.maxMembers, low = (st.lordLevel || 1) < g.minLordLv;
      App.UI.drawPanel(ctx, x, y, 438, 86, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
      label(ctx, `${g.name}  Lv.${g.level}`, x + 16, y + 26, 'bold 15px "PingFang SC", sans-serif', '#451a03', 'left', 300);
      label(ctx, `盟主：${g.leader}  ·  成员 ${g.memberCount}/${g.maxMembers}  ·  ${g.joinMode === 1 ? '需审批' : '自由加入'}${g.minLordLv > 1 ? ' · Lv.' + g.minLordLv + '+' : ''}`,
        x + 16, y + 58, '12px "PingFang SC", sans-serif', '#92400e', 'left', 324);
      App.UI.drawButton(ctx, x + 348, y + 24, 78, 38, g.applied ? '已申请' : (full ? '已满员' : (g.joinMode === 1 ? '申请' : '加入')), {
        r: 8, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13, disabled: g.applied || full || low,
      }, () => op('join', { id: g.id }));
    });
    if (loading && !list.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 310, '正在寻访天下联盟…');
    } else if (!list.length) {
      label(ctx, keyword ? '没有找到相关联盟' : '天下尚无联盟，创建第一个联盟吧', W / 2, 310, '14px "PingFang SC", sans-serif', '#92400e', 'center');
    }

    const totalPages = Math.max(1, Math.ceil((total || list.length) / 8));
    App.UI.drawSidePageButtons(ctx, listPage - 1, totalPages, (p) => { listPage = p + 1; loadList(); }, {
      cy: 318, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
    });
  }

  function drawPending(ctx, W) {
    const g = mine.guild, cfg = App.Config.GUILD;
    label(ctx, '联盟创建申请 · 审核中', 48, 87, 'bold 15.5px "PingFang SC", serif', '#fef08a');
    App.UI.drawPanel(ctx, W / 2 - 250, 174, 500, 260, { r: 12, bg: '#fff7e0', border: '#a16207', lineWidth: 1.4 });
    label(ctx, `【${g.name}】`, W / 2, 220, 'bold 24px "PingFang SC", serif', '#451a03', 'center', 460);
    label(ctx, '联盟名称正在等待审核', W / 2, 262, 'bold 15px "PingFang SC", sans-serif', '#b45309', 'center');
    label(ctx, '审核通过后联盟正式成立，结果会通过邮件通知你。', W / 2, 294, '12.5px "PingFang SC", sans-serif', '#92400e', 'center');
    label(ctx, `未通过或主动撤回，都会退还 ${cfg.createCost || 0} 铜钱创建费用。`, W / 2, 316, '12.5px "PingFang SC", sans-serif', '#92400e', 'center');
    App.UI.drawButton(ctx, W / 2 - 170, 362, 160, 44, '刷新审核结果', { r: 9, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 14, loading }, () => loadMine());
    App.UI.drawButton(ctx, W / 2 + 10, 362, 160, 44, '撤回申请', { r: 9, grad: ['#dc2626', '#991b1b'], border: '#fecaca', fontSize: 14 }, () => op('leave'));
  }

  function drawHall(ctx, W) {
    const g = mine.guild, cfg = App.Config.GUILD, st = App.State.get();
    const isLeader = mine.role === 2, isElder = mine.role >= 1;
    App.UI.drawPanel(ctx, 36, 118, 438, 402, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    label(ctx, `${g.name}`, 52, 146, 'bold 19px "PingFang SC", serif', '#451a03', 'left', 250);
    label(ctx, `Lv.${g.level}`, 458, 146, 'bold 16px "PingFang SC", serif', '#b45309', 'right');
    const maxed = g.level >= g.maxLevel;
    App.UI.drawBar(ctx, 52, 168, 406, 14, maxed ? 1 : g.exp / Math.max(1, g.expNeed), '#d97706', '#e7d3a7');
    label(ctx, maxed ? '联盟已满级' : `联盟经验 ${g.exp} / ${g.expNeed}`, 255, 175, 'bold 10px "PingFang SC", sans-serif', '#451a03', 'center');
    label(ctx, `盟主：${g.leader}    成员：${g.memberCount} / ${g.maxMembers}    入盟：${g.joinMode === 1 ? '需审批' : '自由加入'}${g.minLordLv > 1 ? '（Lv.' + g.minLordLv + '+）' : ''}`,
      52, 204, '12px "PingFang SC", sans-serif', '#92400e', 'left', 406);
    label(ctx, `我的职位：${ROLE[mine.role]}    累计贡献：${mine.contribution}    可用贡献：${st.guildCoin || 0}`, 52, 228, '12px "PingFang SC", sans-serif', '#92400e', 'left', 406);

    App.UI.drawPanel(ctx, 52, 248, 406, 132, { r: 8, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
    label(ctx, '联盟公告', 64, 268, 'bold 12.5px "PingFang SC", sans-serif', '#7c2d12');
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = '#451a03'; ctx.font = '12.5px "PingFang SC", sans-serif';
    const nextY = App.UI.drawWrappedText(ctx, g.notice || '盟主很懒，还没有写公告。', 64, 294, 382, 19, 'left');
    if (g.pendingNotice) {
      ctx.fillStyle = '#b45309'; ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(('新公告审核中：' + g.pendingNotice).slice(0, 34) + (g.pendingNotice.length > 27 ? '…' : ''), 64, Math.min(362, nextY + 6), 382);
    }
    ctx.restore();
    if (isElder) {
      App.UI.drawButton(ctx, 384, 254, 66, 24, '修改', { r: 6, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 11 }, () => {
        App.Platform.promptText('输入新的联盟公告（最多 60 个字，审核通过后生效）', (text) => op('update', { notice: String(text || '').slice(0, 60) }), { maxLength: 60, defaultValue: g.notice || '' });
      });
    }

    if (isLeader) {
      App.UI.drawButton(ctx, 52, 398, 128, 36, g.joinMode === 1 ? '改为自由加入' : '改为需要审批', { r: 8, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 12 }, () => op('update', { joinMode: g.joinMode === 1 ? 0 : 1 }));
      App.UI.drawButton(ctx, 191, 398, 128, 36, '设置入盟等级', { r: 8, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 12 }, () => {
        App.Platform.promptText('入盟所需的最低主公等级（1~99）', (text) => { const n = Math.floor(Number(text)); if (n >= 1) op('update', { minLordLv: n }); });
      });
    }
    const alone = g.memberCount <= 1;
    App.UI.drawButton(ctx, 330, 398, 128, 36, isLeader ? '解散联盟' : '退出联盟', { r: 8, grad: ['#dc2626', '#991b1b'], border: '#fecaca', fontSize: 12, disabled: isLeader && !alone }, () => {
      App.Platform.promptText(isLeader ? '解散后无法恢复。确认解散请输入：解散' : '确认退出请输入：退出', (text) => {
        if (String(text).trim() === (isLeader ? '解散' : '退出')) op('leave');
        else App.UI.showToast('输入不符，已取消', '#fca5a5');
      });
    });
    label(ctx, isLeader && !alone ? '盟主需先在「成员」里转让盟主之位，或在只剩自己时解散联盟。' : `退出后需等待 ${cfg.rejoinHours || 4} 小时才能加入其他联盟。`,
      52, 464, '11px "PingFang SC", sans-serif', '#a8a29e', 'left', 406);

    // 捐献
    App.UI.drawPanel(ctx, 486, 118, 438, 402, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    const used = st.guildDonate && st.guildDonate.date === todayKey() ? (st.guildDonate.count || 0) : 0;
    const left = Math.max(0, (cfg.donateDailyLimit || 3) - used);
    label(ctx, '联盟捐献', 504, 146, 'bold 15.5px "PingFang SC", serif', '#451a03');
    label(ctx, `今日剩余 ${left} / ${cfg.donateDailyLimit || 3} 次`, 908, 146, '12px "PingFang SC", sans-serif', '#92400e', 'right');
    Object.keys(cfg.donates || {}).slice(0, 3).forEach((id, i) => {
      const d = cfg.donates[id], y = 172 + i * 112;
      const cost = d.gold ? `${d.gold} 铜钱` : `${d.soul} 将魂`;
      const afford = d.gold ? st.gold >= d.gold : st.soul >= (d.soul || 0);
      App.UI.drawPanel(ctx, 502, y, 406, 98, { r: 8, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
      label(ctx, d.name || id, 518, y + 28, 'bold 14.5px "PingFang SC", sans-serif', '#451a03');
      label(ctx, `消耗 ${cost}`, 518, y + 54, '12px "PingFang SC", sans-serif', '#92400e');
      label(ctx, `联盟经验 +${d.exp}  个人贡献 +${d.coin}`, 518, y + 76, '12px "PingFang SC", sans-serif', '#15803d');
      App.UI.drawButton(ctx, 792, y + 28, 100, 42, '捐献', { r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14, disabled: left <= 0 || !afford }, () => op('donate', { type: id }));
    });
  }

  function todayKey() {
    const d = new Date(App.API.now());
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function drawMembers(ctx, W) {
    const members = mine.members || [], per = 10;
    const totalPages = Math.max(1, Math.ceil(members.length / per));
    memberPage = Math.max(0, Math.min(memberPage, totalPages - 1));
    label(ctx, '成员', 60, 126, 'bold 12px "PingFang SC", sans-serif', '#92400e');
    label(ctx, '职位', 300, 126, 'bold 12px "PingFang SC", sans-serif', '#92400e');
    label(ctx, '战力', 400, 126, 'bold 12px "PingFang SC", sans-serif', '#92400e');
    label(ctx, '累计贡献', 500, 126, 'bold 12px "PingFang SC", sans-serif', '#92400e');
    members.slice(memberPage * per, (memberPage + 1) * per).forEach((m, i) => {
      const y = 140 + i * 37;
      App.UI.drawPanel(ctx, 42, y, W - 84, 32, { r: 7, bg: m.me ? '#fde9a8' : '#fff7e0', border: '#c9a66b', lineWidth: 1 });
      label(ctx, `${m.name}  Lv.${m.lv}`, 60, y + 16, 'bold 13px "PingFang SC", sans-serif', '#451a03', 'left', 220);
      label(ctx, ROLE[m.role], 300, y + 16, 'bold 12px "PingFang SC", sans-serif', m.role === 2 ? '#b91c1c' : (m.role === 1 ? '#b45309' : '#57534e'));
      label(ctx, String(m.power), 400, y + 16, '12px "PingFang SC", sans-serif', '#451a03');
      label(ctx, String(m.contribution), 500, y + 16, '12px "PingFang SC", sans-serif', '#451a03');
      if (m.me) return;
      const body = { playerId: m.playerId };
      let bx = W - 56;
      const btn = (text, grad, fn) => { bx -= 74; App.UI.drawButton(ctx, bx, y + 4, 68, 24, text, { r: 6, grad, border: '#fef3c7', fontSize: 11 }, fn); };
      if (mine.role > m.role && mine.role >= 1) btn('请离', ['#dc2626', '#991b1b'], () => op('kick', body));
      if (mine.role === 2) {
        btn('转让盟主', ['#7c3aed', '#5b21b6'], () => {
          App.Platform.promptText(`确认把盟主之位转让给 ${m.name}？请输入：转让`, (text) => { if (String(text).trim() === '转让') op('transfer', body); });
        });
        btn(m.role === 1 ? '撤销长老' : '任命长老', ['#0369a1', '#0c4a6e'], () => op('role', { playerId: m.playerId, elder: m.role !== 1 }));
      }
    });
    App.UI.drawSidePageButtons(ctx, memberPage, totalPages, (p) => { memberPage = p; }, {
      cy: 318, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
    });
  }

  function drawShop(ctx, W) {
    const cfg = App.Config.GUILD, st = App.State.get(), g = mine.guild;
    const bought = st.guildShop && st.guildShop.date === todayKey() ? st.guildShop : {};
    label(ctx, `可用联盟贡献：${st.guildCoin || 0}（捐献、讨伐联盟BOSS可获得）`, 44, 130, 'bold 13px "PingFang SC", sans-serif', '#7c2d12');
    (cfg.shop || []).slice(0, 8).forEach((it, i) => {
      const x = 38 + (i % 4) * 224, y = 148 + Math.floor(i / 4) * 184;
      const left = Math.max(0, (it.dailyLimit || 1) - (bought[it.id] || 0));
      const lvLock = g.level < (it.guildLv || 1);
      App.UI.drawPanel(ctx, x, y, 212, 172, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
      if (it.reward.type === 'item') {
        App.Sprites.drawEquipIcon(ctx, it.reward.id, x + 14, y + 16, 62, { radius: 8 });
      } else {
        ctx.save(); ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(x + 45, y + 47, 29, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        label(ctx, (REWARD_NAMES[it.reward.type] || '奖').slice(-1), x + 45, y + 48, 'bold 23px "PingFang SC", serif', '#fef08a', 'center');
      }
      label(ctx, rewardName(it.reward), x + 86, y + 32, 'bold 13px "PingFang SC", sans-serif', '#451a03', 'left', 118);
      label(ctx, `今日可换 ${left} / ${it.dailyLimit || 1}`, x + 86, y + 58, '11.5px "PingFang SC", sans-serif', '#92400e');
      label(ctx, `价格：${it.price} 贡献`, x + 16, y + 104, 'bold 12.5px "PingFang SC", sans-serif', '#b45309');
      App.UI.drawButton(ctx, x + 14, y + 122, 184, 36, lvLock ? `联盟 Lv.${it.guildLv} 开放` : (left > 0 ? '兑换' : '今日已换完'), {
        r: 8, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13, disabled: lvLock || left <= 0 || (st.guildCoin || 0) < it.price,
      }, () => App.State.act('/api/guild/shop/buy', { id: it.id }, { color: '#fde047' }));
    });
  }

  function drawBoss(ctx, W) {
    if (!boss) return App.UI.drawPanelLoading(ctx, W / 2, 300, '正在集结盟友…');
    const WB = App.Scenes.worldBoss;
    WB.drawBossCard(ctx, boss, 36, 118, 324, 402, {
      active: true, statusText: boss.hp > 0 ? '每日一只，盟友合力讨伐' : '今日已讨伐成功，明日再战',
      mode: 'guildboss', backScene: 'guild', reload: loadBoss,
    });
    WB.drawBoard(ctx, boss, 370, 118, 288, 402, '今日盟内伤害榜');
    App.UI.drawPanel(ctx, 668, 118, 256, 402, { r: 10, bg: '#2c150e', border: '#b45309', lineWidth: 1.4 });
    label(ctx, '讨伐奖励', 684, 144, 'bold 14px "PingFang SC", serif', '#fef08a');
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = '#e7cfa8'; ctx.font = '12.5px "PingFang SC", sans-serif';
    let y = App.UI.drawWrappedText(ctx, '每次讨伐：按造成的伤害获得联盟贡献，并为联盟增加经验。', 684, 174, 226, 20, 'left') + 14;
    ctx.fillStyle = '#fde047';
    y = App.UI.drawWrappedText(ctx, '击杀奖励（全体成员，邮件发放）：', 684, y, 226, 20, 'left');
    ctx.fillStyle = '#e7cfa8';
    App.UI.drawWrappedText(ctx, (boss.killRewards || []).join(' · '), 684, y + 4, 226, 20, 'left');
    ctx.restore();
    const gbSubCnt = (App.API && App.API.getSubscribeQuota) ? App.API.getSubscribeQuota('boss_rank') : 0;
    App.UI.drawButton(ctx, 684, 464, 224, 40, gbSubCnt > 0 ? `已订当日结算通知 (${gbSubCnt}次)` : '订阅当日排名结算通知', {
      r: 8, grad: gbSubCnt > 0 ? ['#15803d', '#166534'] : ['#b45309', '#78350f'], border: '#fde047', fontSize: 12,
    }, () => {
      if (App.API && App.API.subscribeNotice) App.API.subscribeNotice('boss_rank');
    });
  }

  function drawApplies(ctx, W) {
    const applies = mine.applies || [];
    applies.slice(0, 10).forEach((a, i) => {
      const y = 122 + i * 39;
      App.UI.drawPanel(ctx, 42, y, W - 84, 34, { r: 7, bg: '#fff7e0', border: '#c9a66b', lineWidth: 1 });
      label(ctx, `${a.name}  Lv.${a.lv}`, 60, y + 17, 'bold 13px "PingFang SC", sans-serif', '#451a03', 'left', 260);
      label(ctx, `战力 ${a.power}`, 340, y + 17, '12px "PingFang SC", sans-serif', '#92400e');
      App.UI.drawButton(ctx, W - 210, y + 4.5, 70, 25, '同意', { r: 6, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 12 }, () => op('apply/handle', { applyId: a.applyId, accept: true }));
      App.UI.drawButton(ctx, W - 130, y + 4.5, 70, 25, '拒绝', { r: 6, grad: ['#dc2626', '#991b1b'], border: '#fecaca', fontSize: 12 }, () => op('apply/handle', { applyId: a.applyId, accept: false }));
    });
    if (!applies.length) label(ctx, '暂时没有入盟申请', W / 2, 310, '14px "PingFang SC", sans-serif', '#92400e', 'center');
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const dark = mine && mine.guild && tab === 'boss';
    ctx.fillStyle = dark ? '#180b07' : '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: dark ? '#2c150e' : '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    if (!mine) {
      App.UI.drawPanelLoading(ctx, W / 2, 300, '正在前往联盟大营…');
    } else if (!mine.guild) {
      drawLobby(ctx, W);
    } else if (mine.guild.status !== 1) {
      drawPending(ctx, W);
    } else {
      const tabs = [['hall', '联盟大厅'], ['members', '成员'], ['shop', '联盟商店'], ['boss', '联盟BOSS']];
      if (mine.role >= 1) tabs.push(['applies', '入盟审批' + ((mine.applies || []).length ? `(${mine.applies.length})` : '')]);
      tabs.forEach(([id, text], i) => {
        App.UI.drawButton(ctx, 44 + i * 118, 72, 110, 30, text, { r: 7, grad: tab === id ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'], border: tab === id ? '#fef08a' : '#a16207', fontSize: 12.5 }, () => {
          tab = id;
          if (id === 'boss') loadBoss();
          else loadMine();
        });
      });
      if (tab === 'members') drawMembers(ctx, W);
      else if (tab === 'shop') drawShop(ctx, W);
      else if (tab === 'boss') drawBoss(ctx, W);
      else if (tab === 'applies' && mine.role >= 1) drawApplies(ctx, W);
      else drawHall(ctx, W);
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.guild = {
    enter() {
      if (tab === 'boss' && mine && mine.guild) { loadBoss(); loadMine(); return; }
      enter();
    },
    render,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
