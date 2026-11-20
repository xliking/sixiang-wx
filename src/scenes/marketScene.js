(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 坊市：玩家摆摊。上架的物品由服务端托管，成交后卖家通过邮件收到铜钱（扣手续费）
  let tab = 'browse';
  let list = [];
  let total = 0;
  let page = 1;
  let sellPage = 0;

  async function load() {
    const res = await App.API.get(tab === 'mine' ? '/api/market/mine' : '/api/market/list?page=' + page);
    if (res && res.ok) { list = res.list || []; total = res.total || list.length; }
  }

  function enter() { tab = 'browse'; page = 1; list = []; load(); }

  function nameOf(l) {
    if (l.kind === 'item') return ((App.Config.ITEMS[l.itemId] || {}).name || l.itemId) + ' ×' + l.count;
    const e = l.equip || {};
    return ((App.Config.EQUIP_TEMPLATES[l.itemId] || {}).name || l.itemId) + ` +${e.enhance || 0}` + (e.star ? ` ${e.star}★` : '') + (e.advance ? ` ${e.advance}阶` : '');
  }

  function drawIcon(ctx, kind, id, x, y, size) {
    if (kind === 'equip') return App.Sprites.drawEquipIcon(ctx, id, x, y, size, { radius: 7 });
    const img = App.Assets.get((App.Config.ITEMS[id] || {}).imgKey);
    ctx.save();
    ctx.fillStyle = '#3b2112'; App.UI.roundRect(ctx, x, y, size, size, 7); ctx.fill();
    if (img) { App.UI.roundRect(ctx, x, y, size, size, 7); ctx.clip(); ctx.drawImage(img, x, y, size, size); }
    ctx.restore();
  }

  function sell(kind, id, label) {
    const cfg = App.Config.MARKET;
    App.Platform.promptText(kind === 'item' ? `出售【${label}】：输入「数量 总价」，如 3 900（只填一个数字则卖 1 个）` : `出售【${label}】：输入售价（铜钱）`, (text) => {
      const nums = String(text || '').trim().split(/[\s,，*x×]+/).map(Number).filter((n) => n > 0);
      if (!nums.length) return App.UI.showToast('请输入正确的价格', '#f87171');
      const count = kind === 'item' && nums.length > 1 ? Math.floor(nums[0]) : 1;
      const price = Math.floor(nums[nums.length - 1]);
      App.State.act('/api/market/sell', { kind, id, count, price }).then((res) => { if (res.ok && cfg) sellPage = 0; });
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config, cfg = C.MARKET;
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 74, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    [['browse', '逛坊市'], ['mine', '我的摊位'], ['sell', '摆摊上架']].forEach(([id, label], i) => {
      App.UI.drawButton(ctx, 36 + i * 118, 80, 110, 32, label, { r: 8, grad: tab === id ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'], border: tab === id ? '#fef08a' : '#a16207', fontSize: 13 }, () => {
        tab = id; page = 1; list = []; if (id !== 'sell') load();
      });
    });
    ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fde68a'; ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`成交手续费 ${Math.round((cfg.taxRate || 0) * 100)}% · 最多同时上架 ${cfg.maxListings || 8} 件`, W - 120, 96); ctx.restore();
    App.UI.drawButton(ctx, W - 108, 79, 70, 34, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));

    if (tab === 'sell') {
      const goods = C.ITEM_IDS.filter((id) => (st.items[id] || 0) > 0).map((id) => ({ kind: 'item', id, icon: id, label: C.ITEMS[id].name, sub: '持有 ' + st.items[id] }))
        .concat(st.inventory.filter((e) => !e.equippedBy && !e.equippedByBeast && C.EQUIP_TEMPLATES[e.tplId]).map((e) => ({ kind: 'equip', id: e.uid, icon: e.tplId, label: C.EQUIP_TEMPLATES[e.tplId].name, sub: `+${e.enhance || 0} ${e.star || 0}★ ${e.advance || 0}阶` })));
      const per = 20, maxP = Math.max(0, Math.ceil(goods.length / per) - 1);
      sellPage = Math.min(sellPage, maxP);
      goods.slice(sellPage * per, (sellPage + 1) * per).forEach((g, i) => {
        const x = 30 + (i % 10) * 90, y = 130 + Math.floor(i / 10) * 140;
        App.UI.drawPanel(ctx, x, y, 84, 130, { r: 9, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
        drawIcon(ctx, g.kind, g.icon, x + 12, y + 8, 60);
        ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#451a03'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(g.label.slice(0, 6), x + 42, y + 84);
        ctx.fillStyle = '#92400e'; ctx.font = '10px "PingFang SC", sans-serif'; ctx.fillText(g.sub, x + 42, y + 99);
        ctx.fillStyle = '#b45309'; ctx.fillText('点击上架', x + 42, y + 118); ctx.restore();
        App.UI.addHit(x, y, 84, 130, () => sell(g.kind, g.id, g.label));
      });
      if (!goods.length) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = '14px "PingFang SC", sans-serif'; ctx.fillText('仓库里没有可出售的道具或闲置装备', W / 2, 290); ctx.restore(); }
      if (maxP > 0) {
        App.UI.drawButton(ctx, W / 2 - 110, 426, 90, 30, '上一页', { r: 6, fontSize: 11, disabled: sellPage <= 0 }, () => { sellPage -= 1; });
        App.UI.drawButton(ctx, W / 2 + 20, 426, 90, 30, '下一页', { r: 6, fontSize: 11, disabled: sellPage >= maxP }, () => { sellPage += 1; });
      }
    } else {
      const STATUS = ['出售中', '已售出', '已下架'];
      list.slice(0, 12).forEach((l, i) => {
        const x = 30 + (i % 2) * 452, y = 128 + Math.floor(i / 2) * 49;
        App.UI.drawPanel(ctx, x, y, 446, 44, { r: 8, bg: '#fff7e0', border: '#a16207', lineWidth: 1 });
        drawIcon(ctx, l.kind, l.itemId, x + 6, y + 4, 36);
        ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#451a03'; ctx.font = 'bold 12.5px "PingFang SC", sans-serif'; ctx.fillText(nameOf(l), x + 50, y + 15);
        ctx.fillStyle = '#92400e'; ctx.font = '10.5px "PingFang SC", sans-serif'; ctx.fillText(tab === 'mine' ? STATUS[l.status] || '' : '摊主：' + l.seller, x + 50, y + 32);
        ctx.textAlign = 'right'; ctx.fillStyle = '#b45309'; ctx.font = 'bold 13px "PingFang SC", sans-serif'; ctx.fillText(l.price + ' 铜钱', x + 356, y + 22);
        ctx.restore();
        if (tab === 'browse') {
          App.UI.drawButton(ctx, x + 366, y + 7, 72, 30, '购买', { r: 7, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 12, disabled: st.gold < l.price }, () => App.State.act('/api/market/buy', { id: l.id }).then(load));
        } else if (l.status === 0) {
          App.UI.drawButton(ctx, x + 366, y + 7, 72, 30, '下架', { r: 7, grad: ['#dc2626', '#991b1b'], border: '#fecaca', fontSize: 12 }, () => App.State.act('/api/market/cancel', { id: l.id }).then(load));
        }
      });
      if (!list.length) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = '14px "PingFang SC", sans-serif'; ctx.fillText(tab === 'mine' ? '你还没有摆过摊' : '坊市暂时没有货物，去摆第一个摊吧', W / 2, 290); ctx.restore(); }
      if (tab === 'browse' && total > 12) {
        App.UI.drawButton(ctx, W / 2 - 110, 430, 90, 28, '上一页', { r: 6, fontSize: 11, disabled: page <= 1 }, () => { page -= 1; load(); });
        App.UI.drawButton(ctx, W / 2 + 20, 430, 90, 28, '下一页', { r: 6, fontSize: 11, disabled: page * 12 >= total }, () => { page += 1; load(); });
      }
    }
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.market = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
