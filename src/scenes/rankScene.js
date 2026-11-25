(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 风云榜：战力 / 等级 / 关卡 / 天梯 / 演武场 / 联盟，榜单由服务端生成（每分钟刷新）
  const TABS = [
    { id: 'power', label: '战力榜', unit: '战力' },
    { id: 'level', label: '等级榜', unit: '主公等级' },
    { id: 'stage', label: '征战榜', unit: '通关关卡' },
    { id: 'tower', label: '天梯榜', unit: '铜雀层数' },
    { id: 'arena', label: '演武榜', unit: '战力' },
    { id: 'guild', label: '联盟榜', unit: '成员' },
  ];
  const PER = 8;
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
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 74, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    TABS.forEach((t, i) => {
      App.UI.drawButton(ctx, 36 + i * 106, 80, 98, 32, t.label, { r: 8, grad: tab === t.id ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'], border: tab === t.id ? '#fef08a' : '#a16207', fontSize: 13 }, () => {
        tab = t.id; page = 0; if (!data[t.id]) load();
      });
    });
    App.UI.drawButton(ctx, W - 108, 79, 70, 34, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));

    const meta = TABS.find((t) => t.id === tab), res = data[tab];
    const list = (res && res.list) || [];
    const isGuild = tab === 'guild';

    // 表头
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#92400e'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('名次', 78, 136);
    ctx.textAlign = 'left'; ctx.fillText(isGuild ? '联盟' : '主公', 150, 136);
    ctx.fillText(isGuild ? '盟主' : '阵营', 420, 136);
    ctx.fillText('等级', 560, 136);
    ctx.textAlign = 'right'; ctx.fillText(meta.unit, W - 70, 136);
    ctx.restore();

    const maxPage = Math.max(0, Math.ceil(list.length / PER) - 1);
    page = Math.min(page, maxPage);
    list.slice(page * PER, (page + 1) * PER).forEach((row, i) => {
      const y = 148 + i * 32;
      const top3 = row.rank <= 3;
      App.UI.drawPanel(ctx, 40, y, W - 80, 28, { r: 7, bg: top3 ? '#fde9a8' : '#fff7e0', border: top3 ? '#d97706' : '#c9a66b', lineWidth: 1 });
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = top3 ? '#b45309' : '#451a03'; ctx.font = `bold ${top3 ? 15 : 13}px "PingFang SC", sans-serif`;
      ctx.fillText(String(row.rank), 78, y + 14);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(row.name + (row.npc ? '（系统军团）' : ''), 150, y + 14, 250);
      ctx.fillStyle = '#92400e'; ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? (row.leader || '') : ((C.FACTIONS[row.faction] || {}).name || '-'), 420, y + 14, 130);
      ctx.fillText('Lv.' + (row.lv || 1), 560, y + 14);
      ctx.textAlign = 'right'; ctx.fillStyle = '#b45309'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? row.value + ' 人' : String(row.value), W - 70, y + 14);
      ctx.restore();
    });
    if (loading && !list.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 280, '正在誊录风云榜…');
    } else if (!list.length) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText(isGuild ? '还没有联盟，去创建第一个吧' : '榜上暂时无人', W / 2, 280); ctx.restore();
    }

    // 底部：我的名次 + 翻页
    const me = res && res.me;
    if (me) {
      ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7c2d12'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      const text = isGuild
        ? (me.value !== undefined ? `我的联盟：${me.name}（Lv.${me.lv} · ${me.value} 人）` : '我还没有加入联盟')
        : `我的名次：${me.rank ? '第 ' + me.rank + ' 名' : '未上榜'}  ·  ${meta.unit} ${me.value || 0}`;
      ctx.fillText(text, 44, 444, 420);
      ctx.restore();
    }
    App.UI.drawPagination(ctx, W - 400, 430, 360, 28, page, maxPage + 1, (p) => { page = p; });
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.rank = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
