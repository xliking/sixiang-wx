(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const TABS = [
    { id: 'power', label: '战力榜', unit: '战力' },
    { id: 'level', label: '等级榜', unit: '主公等级' },
    { id: 'stage', label: '征战榜', unit: '通关关卡' },
    { id: 'tower', label: '天梯榜', unit: '铜雀层数' },
    { id: 'arena', label: '演武榜', unit: '战力' },
    { id: 'guild', label: '联盟榜', unit: '成员' },
  ];
  const PER = 10;
  let tab = 'power';
  let page = 0;
  let data = {};
  let loading = false;

  async function load() {
    const t = tab;
    loading = true;
    try {
      const res = await App.API.get('/api/rank/list?type=' + t);
      if (res && res.ok) data[t] = res;
      else if (res && res.msg) App.UI.showToast(res.msg, '#f87171');
    } finally {
      loading = false;
    }
  }

  function enter() { tab = 'power'; page = 0; data = {}; load(); }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const C = App.Config;
    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高风云榜大画框（y=58..532，左右两侧耳标翻页，右上角 ✕ 关闭）
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    TABS.forEach((t, i) => {
      App.UI.drawButton(ctx, 44 + i * 108, 72, 100, 30, t.label, {
        r: 7,
        grad: tab === t.id ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'],
        border: tab === t.id ? '#fef08a' : '#a16207',
        fontSize: 12.5,
      }, () => {
        tab = t.id; page = 0; if (!data[t.id]) load();
      });
    });
    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    const meta = TABS.find((t) => t.id === tab), res = data[tab];
    const list = (res && res.list) || [];
    const isGuild = tab === 'guild';

    // 表头
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#92400e'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('名次', 82, 124);
    ctx.textAlign = 'left'; ctx.fillText(isGuild ? '联盟' : '主公', 156, 124);
    ctx.fillText(isGuild ? '盟主' : '阵营', 430, 124);
    ctx.fillText('等级', 575, 124);
    ctx.textAlign = 'right'; ctx.fillText(meta.unit, W - 74, 124);
    ctx.restore();

    const totalPages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.max(0, Math.min(page, totalPages - 1));
    list.slice(page * PER, (page + 1) * PER).forEach((row, i) => {
      const y = 138 + i * 34;
      const top3 = row.rank <= 3;
      App.UI.drawPanel(ctx, 42, y, W - 84, 30, { r: 7, bg: top3 ? '#fde9a8' : '#fff7e0', border: top3 ? '#d97706' : '#c9a66b', lineWidth: 1 });
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = top3 ? '#b45309' : '#451a03'; ctx.font = `bold ${top3 ? 15 : 13}px "PingFang SC", sans-serif`;
      ctx.fillText(String(row.rank), 82, y + 15);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(row.name + (row.npc ? '（系统军团）' : ''), 156, y + 15, 250);
      ctx.fillStyle = '#92400e'; ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? (row.leader || '') : ((C.FACTIONS[row.faction] || {}).name || '-'), 430, y + 15, 130);
      ctx.fillText('Lv.' + (row.lv || 1), 575, y + 15);
      ctx.textAlign = 'right'; ctx.fillStyle = '#b45309'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? row.value + ' 人' : String(row.value), W - 74, y + 15);
      ctx.restore();
    });

    if (loading && !list.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 300, '正在誊录风云榜…');
    } else if (!list.length) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? '还没有联盟，去创建第一个吧' : '榜上暂时无人', W / 2, 300); ctx.restore();
    }

    // 底部个人名次胶囊条
    const me = res && res.me;
    if (me) {
      App.UI.drawPanel(ctx, 42, 484, W - 84, 36, { r: 8, bg: '#451a03', border: '#d4a34b', lineWidth: 1.4 });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      const text = isGuild
        ? (me.value !== undefined ? `我的联盟：${me.name}（Lv.${me.lv} · ${me.value} 人）` : '我还没有加入联盟')
        : `我的名次：${me.rank ? '第 ' + me.rank + ' 名' : '未上榜'}  ·  ${meta.unit} ${me.value || 0}`;
      ctx.fillText(text, W / 2, 502);
      ctx.restore();
    }

    App.UI.drawSidePageButtons(ctx, page, totalPages, (p) => { page = p; }, {
      cy: 312, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.rank = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
