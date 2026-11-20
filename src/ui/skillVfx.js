(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 离屏高清法阵纹理缓存（256x256 透明底抗锯齿预烘焙，彻底告别粗糙多边形与JPG黑框，且保证60帧丝滑！）
  const sealCache = {};
  const MAX_SEAL_CACHE = 96;
  let sealCacheCount = 0;

  function hashStr(str) {
    const s = String(str || 'sixiang');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seeded(seed, idx) {
    const x = Math.sin((seed % 9973) * 12.9898 + idx * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
  function easeOutBack(t) {
    const x = Math.max(0, Math.min(1, t));
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ================= 30 大国风古典高定配色与意象前缀表（绝无刺眼荧光撞色！） =================
  const PREFIX_THEMES = {
    '太白': { c1: '#ca8a04', c2: '#fde047', c3: '#f8fafc', core: '#ffffff', dark: '#1e1b18', seal: 5, sky: 'star_crown', pType: 'star' },
    '鬼神': { c1: '#991b1b', c2: '#ef4444', c3: '#f59e0b', core: '#fef2f2', dark: '#180606', seal: 7, sky: 'blood_moon', pType: 'ember' },
    '七星': { c1: '#0284c7', c2: '#38bdf8', c3: '#fde047', core: '#f0f9ff', dark: '#081426', seal: 1, sky: 'dipper', pType: 'star' },
    '无双': { c1: '#b91c1c', c2: '#f97316', c3: '#fde047', core: '#fffbeb', dark: '#1c0a05', seal: 7, sky: 'sun_halo', pType: 'ember' },
    '八荒': { c1: '#92400e', c2: '#f59e0b', c3: '#fef08a', core: '#fffbeb', dark: '#1c1208', seal: 9, sky: 'ink_peaks', pType: 'gold_ink' },
    '乾坤': { c1: '#0d9488', c2: '#2dd4bf', c3: '#facc15', core: '#f0fdfa', dark: '#071c1a', seal: 0, sky: 'taiji_dome', pType: 'talisman' },
    '九天': { c1: '#6d28d9', c2: '#c084fc', c3: '#fde047', core: '#faf5ff', dark: '#140926', seal: 1, sky: 'star_crown', pType: 'star' },
    '玄冥': { c1: '#0369a1', c2: '#38bdf8', c3: '#bae6fd', core: '#f8fafc', dark: '#061524', seal: 3, sky: 'frost_aurora', pType: 'crystal' },
    '裂地': { c1: '#9a3412', c2: '#fb923c', c3: '#fde047', core: '#fff7ed', dark: '#1c0d06', seal: 11, sky: 'ink_peaks', pType: 'ember' },
    '紫电': { c1: '#7e22ce', c2: '#d8b4fe', c3: '#67e8f9', core: '#ffffff', dark: '#130724', seal: 6, sky: 'storm_cloud', pType: 'spark' },
    '流火': { c1: '#dc2626', c2: '#fb923c', c3: '#fde047', core: '#fffbeb', dark: '#210905', seal: 2, sky: 'fire_clouds', pType: 'ember' },
    '苍穹': { c1: '#1d4ed8', c2: '#60a5fa', c3: '#e0f2fe', core: '#ffffff', dark: '#09152b', seal: 1, sky: 'dipper', pType: 'star' },
    '贪狼': { c1: '#be123c', c2: '#fb7185', c3: '#cbd5e1', core: '#fff1f2', dark: '#1f0710', seal: 7, sky: 'blood_moon', pType: 'feather' },
    '盘龙': { c1: '#047857', c2: '#34d399', c3: '#fde047', core: '#ecfdf5', dark: '#061f17', seal: 8, sky: 'dragon_mist', pType: 'pearl' },
    '赤焰': { c1: '#b91c1c', c2: '#ef4444', c3: '#fbbf24', core: '#fefce8', dark: '#240808', seal: 2, sky: 'fire_clouds', pType: 'ember' },
    '天罡': { c1: '#0f766e', c2: '#5eead4', c3: '#fde047', core: '#ffffff', dark: '#071d1c', seal: 5, sky: 'talisman_ring', pType: 'star' },
    '朱雀': { c1: '#c2410c', c2: '#fb923c', c3: '#fef08a', core: '#fff7ed', dark: '#240c04', seal: 2, sky: 'fire_clouds', pType: 'feather' },
    '青霜': { c1: '#0e7490', c2: '#22d3ee', c3: '#cffafe', core: '#ffffff', dark: '#061b22', seal: 3, sky: 'frost_aurora', pType: 'crystal' },
    '惊鸿': { c1: '#be185d', c2: '#f472b6', c3: '#fde68a', core: '#fff1f2', dark: '#210815', seal: 10, sky: 'full_moon', pType: 'petal' },
    '霸王': { c1: '#a16207', c2: '#facc15', c3: '#fca5a5', core: '#fefce8', dark: '#1f1405', seal: 4, sky: 'sun_halo', pType: 'gold_ink' },
    '阴阳': { c1: '#334155', c2: '#94a3b8', c3: '#fde047', core: '#ffffff', dark: '#0f172a', seal: 0, sky: 'taiji_dome', pType: 'talisman' },
    '猛虎': { c1: '#b45309', c2: '#fbbf24', c3: '#f1f5f9', core: '#ffffff', dark: '#1f1206', seal: 11, sky: 'sun_halo', pType: 'spark' },
    '地煞': { c1: '#4c1d95', c2: '#a78bfa', c3: '#fbbf24', core: '#f5f3ff', dark: '#110821', seal: 9, sky: 'storm_cloud', pType: 'talisman' },
    '狂澜': { c1: '#0369a1', c2: '#06b6d4', c3: '#a5f3fc', core: '#f0f9ff', dark: '#051824', seal: 8, sky: 'dragon_mist', pType: 'pearl' },
    '六合': { c1: '#0f766e', c2: '#38bdf8', c3: '#fde68a', core: '#f8fafc', dark: '#071a21', seal: 3, sky: 'taiji_dome', pType: 'leaf' },
    '破军': { c1: '#991b1b', c2: '#f87171', c3: '#e2e8f0', core: '#ffffff', dark: '#1c0909', seal: 5, sky: 'star_crown', pType: 'spark' },
    '奔雷': { c1: '#4338ca', c2: '#818cf8', c3: '#fde047', core: '#ffffff', dark: '#0d0b26', seal: 6, sky: 'storm_cloud', pType: 'spark' },
    '焚天': { c1: '#dc2626', c2: '#f59e0b', c3: '#fef08a', core: '#ffffff', dark: '#240904', seal: 11, sky: 'sun_halo', pType: 'ember' },
    '寒冰': { c1: '#0284c7', c2: '#7dd3fc', c3: '#e0f2fe', core: '#ffffff', dark: '#061626', seal: 3, sky: 'frost_aurora', pType: 'crystal' },
    '幽冥': { c1: '#581c87', c2: '#c084fc', c3: '#5eead4', core: '#faf5ff', dark: '#0e051a', seal: 9, sky: 'blood_moon', pType: 'talisman' },
  };

  // 28 种中段核心动作映射
  const MIDDLE_ACTION_MAP = {
    '凝霜': 'frost_lotus',
    '冰封': 'glacier_prism',
    '天罚': 'heaven_pillars',
    '伏魔': 'demon_seal_steles',
    '诛邪': 'talisman_sword_judgment',
    '斩月': 'moon_triple_crescent',
    '刀罡': 'colossal_guandao',
    '横扫': 'sweeping_halberd_wave',
    '惊雷': 'thunder_drum_tempest',
    '穿云': 'kirin_bow_volley',
    '贯日': 'sun_piercer_arrow',
    '坠星': 'astral_starfall',
    '碎星': 'shattering_constellation',
    '追魂': 'soul_reaper_chains',
    '夺魄': 'twin_shadow_chakrams',
    '枪芒': 'seven_star_spears',
    '燎原': 'wildfire_lotus_sea',
    '焚城': 'meteor_fire_pillars',
    '灭世': 'eclipse_nova',
    '剑雨': 'imperial_sword_rain',
    '戟影': 'fangtian_cross_rift',
    '破军': 'cavalry_phalanx_charge',
    '狂岚': 'twin_jade_tornadoes',
    '覆海': 'tsunami_water_dragon',
    '泣血': 'crimson_blossom_storm',
    '裂空': 'dimensional_rift_lances',
    '断岳': 'mountain_crag_hammer',
    '震山': 'bronze_cauldron_quake',
  };

  // 30 位历史核心名将 + 4 大圣兽 专属传世定制演出配置（一将一典故！）
  const HERO_PRESETS = {
    lvbu:          { pal: '鬼神', action: 'fangtian_cross_rift', suffix: '斩', seal: 7, sky: 'blood_moon', pType: 'ember', extra: 'dragon_halberd' },
    guanyu:        { pal: '盘龙', action: 'colossal_guandao', suffix: '斩', seal: 8, sky: 'dragon_mist', pType: 'leaf', extra: 'coiling_dragon' },
    zhaoyun:       { pal: '苍穹', action: 'seven_star_spears', suffix: '闪', seal: 5, sky: 'dipper', pType: 'star', extra: 'coiling_dragon' },
    zhangfei:      { pal: '猛虎', action: 'mountain_crag_hammer', suffix: '啸', seal: 7, sky: 'ink_peaks', pType: 'spark', extra: 'tiger_roar' },
    machao:        { pal: '太白', action: 'cavalry_phalanx_charge', suffix: '破', seal: 5, sky: 'storm_cloud', pType: 'spark', extra: 'spear_lightning' },
    huangzhong:    { pal: '焚天', action: 'sun_piercer_arrow', suffix: '爆', seal: 11, sky: 'sun_halo', pType: 'feather', extra: 'phoenix_glide' },
    zhugeliang:    { pal: '乾坤', action: 'thunder_drum_tempest', suffix: '阵', seal: 0, sky: 'dipper', pType: 'talisman', extra: 'bagua_beam' },
    pangtong:      { pal: '朱雀', action: 'wildfire_lotus_sea', suffix: '劫', seal: 2, sky: 'fire_clouds', pType: 'feather', extra: 'phoenix_glide' },
    huangyueying:  { pal: '天罡', action: 'eclipse_nova', suffix: '诀', seal: 9, sky: 'talisman_ring', pType: 'star' },
    liubei:        { pal: '盘龙', action: 'twin_taiji_swords', suffix: '舞', seal: 10, sky: 'sun_halo', pType: 'petal' },
    caocao:        { pal: '霸王', action: 'imperial_sword_rain', suffix: '印', seal: 4, sky: 'star_crown', pType: 'gold_ink' },
    simayi:        { pal: '幽冥', action: 'astral_starfall', suffix: '劫', seal: 1, sky: 'blood_moon', pType: 'talisman', extra: 'tiger_roar' },
    guojia:        { pal: '玄冥', action: 'frost_lotus', suffix: '阵', seal: 3, sky: 'frost_aurora', pType: 'crystal' },
    zhenji:        { pal: '青霜', action: 'glacier_prism', suffix: '舞', seal: 10, sky: 'full_moon', pType: 'crystal' },
    zhangliao:     { pal: '紫电', action: 'cavalry_phalanx_charge', suffix: '闪', seal: 6, sky: 'storm_cloud', pType: 'spark' },
    dianwei:       { pal: '裂地', action: 'sweeping_halberd_wave', suffix: '破', seal: 7, sky: 'fire_clouds', pType: 'ember' },
    xuchu:         { pal: '猛虎', action: 'mountain_crag_hammer', suffix: '击', seal: 11, sky: 'sun_halo', pType: 'ember', extra: 'tiger_roar' },
    xiahoudun:     { pal: '破军', action: 'moon_triple_crescent', suffix: '杀', seal: 7, sky: 'blood_moon', pType: 'spark' },
    sunquan:       { pal: '狂澜', action: 'tsunami_water_dragon', suffix: '印', seal: 4, sky: 'sun_halo', pType: 'gold_ink', extra: 'tiger_roar' },
    zhouyu:        { pal: '赤焰', action: 'meteor_fire_pillars', suffix: '阵', seal: 2, sky: 'fire_clouds', pType: 'petal', extra: 'phoenix_glide' },
    luxun:         { pal: '流火', action: 'wildfire_lotus_sea', suffix: '爆', seal: 8, sky: 'fire_clouds', pType: 'ember', extra: 'coiling_dragon' },
    ganning:       { pal: '狂澜', action: 'tsunami_water_dragon', suffix: '斩', seal: 8, sky: 'dragon_mist', pType: 'pearl' },
    taishici:      { pal: '青霜', action: 'kirin_bow_volley', suffix: '破', seal: 5, sky: 'star_crown', pType: 'star' },
    huanggai:      { pal: '焚天', action: 'meteor_fire_pillars', suffix: '击', seal: 11, sky: 'fire_clouds', pType: 'ember' },
    xiaoqiao:      { pal: '惊鸿', action: 'moonlit_blossom_dance', suffix: '舞', seal: 10, sky: 'full_moon', pType: 'petal' },
    sunshangxiang: { pal: '赤焰', action: 'kirin_bow_volley', suffix: '闪', seal: 10, sky: 'sun_halo', pType: 'feather' },
    diaochan:      { pal: '惊鸿', action: 'moonlit_blossom_dance', suffix: '诀', seal: 10, sky: 'full_moon', pType: 'petal' },
    zhangjiao:     { pal: '奔雷', action: 'thunder_drum_tempest', suffix: '罚', seal: 6, sky: 'talisman_ring', pType: 'talisman' },
    dongzhuo:      { pal: '幽冥', action: 'demon_seal_steles', suffix: '煞', seal: 9, sky: 'blood_moon', pType: 'ember' },
    huaxiong:      { pal: '鬼神', action: 'colossal_guandao', suffix: '杀', seal: 7, sky: 'blood_moon', pType: 'ember' },
    // 四象神兽专属圣技
    beast_qinglong:{ pal: '盘龙', action: 'tsunami_water_dragon', suffix: '啸', seal: 8, sky: 'storm_cloud', pType: 'spark', extra: 'coiling_dragon' },
    beast_baihu:   { pal: '太白', action: 'fangtian_cross_rift', suffix: '杀', seal: 7, sky: 'star_crown', pType: 'spark', extra: 'tiger_roar' },
    beast_zhuque:  { pal: '朱雀', action: 'meteor_fire_pillars', suffix: '舞', seal: 2, sky: 'fire_clouds', pType: 'feather', extra: 'phoenix_glide' },
    beast_xuanwu:  { pal: '玄冥', action: 'glacier_prism', suffix: '印', seal: 3, sky: 'frost_aurora', pType: 'crystal' },
  };

  const ALL_ACTIONS = Object.values(MIDDLE_ACTION_MAP);
  const ALL_SUFFIXES = ['罚', '劫', '斩', '闪', '破', '啸', '爆', '杀', '舞', '诀', '印', '阵', '岚', '击'];

  /**
   * ★ 为全部 800 位武将（及 4 大神兽）解析出唯一、语义精准、五层复合的高精特效蓝图！
   */
  function resolveSkillProfile(fx) {
    const gid = fx.generalId || (fx.beastId ? 'beast_' + fx.beastId : '');
    const sName = String(fx.skillName || '');
    const h = hashStr(gid + '|' + sName);

    if (HERO_PRESETS[gid]) {
      const pre = HERO_PRESETS[gid];
      const pal = PREFIX_THEMES[pre.pal] || PREFIX_THEMES['无双'];
      return {
        seed: h,
        pal,
        sealId: pre.seal,
        skyId: pre.sky,
        action: pre.action,
        suffix: pre.suffix,
        pType: pre.pType,
        extra: pre.extra || null,
        variant: h % 7,
      };
    }

    // 解析关卡名将 5 字绝技名：前2字(神意调色盘+法阵+天象) + 中2字(核心实体招式) + 末1字(终结收势)
    const p2 = sName.slice(0, 2);
    const m2 = sName.slice(2, 4);
    const s1 = sName.slice(4, 5);

    let pal = PREFIX_THEMES[p2];
    if (!pal) {
      // 语义关键字兜底识别（后台自定义新技能名也能精准匹配元素意境！）
      if (/[冰霜雪寒凝冻洛]/.test(sName) || fx.element === 'ice') pal = PREFIX_THEMES['玄冥'];
      else if (/[火炎焚赤燎烈阳]/.test(sName) || fx.element === 'fire') pal = PREFIX_THEMES['赤焰'];
      else if (/[雷电霆震苍]/.test(sName) || fx.element === 'thunder') pal = PREFIX_THEMES['紫电'];
      else if (/[风岚飓青翠]/.test(sName)) pal = PREFIX_THEMES['盘龙'];
      else if (/[花月舞香桃洛倾]/.test(sName) || fx.element === 'heal_petal') pal = PREFIX_THEMES['惊鸿'];
      else if (/[幽冥鬼魔毒魂煞]/.test(sName) || fx.element === 'shadow') pal = PREFIX_THEMES['幽冥'];
      else if (/[水浪涛海江潮]/.test(sName)) pal = PREFIX_THEMES['狂澜'];
      else pal = PREFIX_THEMES['霸王'];
    }

    let action = MIDDLE_ACTION_MAP[m2];
    if (!action) {
      if (/[箭弓射羽]/.test(sName)) action = 'kirin_bow_volley';
      else if (/[剑]/.test(sName)) action = 'imperial_sword_rain';
      else if (/[枪矛]/.test(sName)) action = 'seven_star_spears';
      else if (/[戟]/.test(sName)) action = 'fangtian_cross_rift';
      else if (/[刀斩]/.test(sName)) action = 'colossal_guandao';
      else if (/[锤岳山石]/.test(sName)) action = 'mountain_crag_hammer';
      else if (/[骑马踏]/.test(sName)) action = 'cavalry_phalanx_charge';
      else if (/[冰霜雪]/.test(sName)) action = 'frost_lotus';
      else if (/[火炎焚]/.test(sName)) action = 'meteor_fire_pillars';
      else if (/[雷电]/.test(sName)) action = 'thunder_drum_tempest';
      else action = ALL_ACTIONS[h % ALL_ACTIONS.length];
    }

    const suffix = ALL_SUFFIXES.indexOf(s1) >= 0 ? s1 : ALL_SUFFIXES[(h >>> 4) % ALL_SUFFIXES.length];
    // 结合武将唯一编号注入图腾副灵（如前缀盘龙自动召唤游龙、朱雀伴飞火凤、猛虎贪狼浮现兽魂！）
    let extra = null;
    if (p2 === '盘龙') extra = 'coiling_dragon';
    else if (p2 === '朱雀' || p2 === '惊鸿') extra = 'phoenix_glide';
    else if (p2 === '猛虎' || p2 === '贪狼') extra = 'tiger_roar';
    else if (p2 === '乾坤' || p2 === '阴阳') extra = 'bagua_beam';

    return {
      seed: h,
      pal,
      sealId: (pal.seal + (h % 3 === 0 ? 0 : 0)) % 12,
      skyId: pal.sky,
      action,
      suffix,
      pType: pal.pType,
      extra,
      variant: h % 9, // 同一招式在数量/倾角/旋向/武器细节上的专属微调，确保800将绝不雷同
    };
  }

  // ================= 12 种离屏高精度国风古典法阵预烘焙 =================

  function createOffscreenCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    if (typeof wx !== 'undefined' && wx.createOffscreenCanvas) {
      return wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
    }
    return null;
  }

  function getSealCanvas(sealId, c1, c2, c3) {
    const key = `${sealId}_${c1}_${c2}`;
    if (sealCache[key]) return sealCache[key];

    const sz = 256;
    const cvs = createOffscreenCanvas(sz, sz);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;

    if (sealCacheCount >= MAX_SEAL_CACHE) {
      const firstKey = Object.keys(sealCache)[0];
      if (firstKey) { delete sealCache[firstKey]; sealCacheCount--; }
    }

    const cx = sz / 2, cy = sz / 2, R = 114;
    g.save();
    g.translate(cx, cy);

    // 柔和辉光底晕
    const rg = g.createRadialGradient(0, 0, 8, 0, 0, R + 10);
    rg.addColorStop(0, c2);
    rg.addColorStop(0.55, c1);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.24;
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, R + 10, 0, Math.PI * 2); g.fill();

    // 双层精密外环 + 36 天罡刻度线
    g.globalAlpha = 0.92;
    g.strokeStyle = c3;
    g.lineWidth = 2.2;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = c2;
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, R - 9, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.56, 0, Math.PI * 2); g.stroke();

    for (let i = 0; i < 36; i++) {
      const a = (Math.PI * 2 * i) / 36;
      const inner = i % 3 === 0 ? R - 15 : R - 9;
      g.strokeStyle = i % 3 === 0 ? c3 : c2;
      g.lineWidth = i % 3 === 0 ? 1.8 : 1.0;
      g.beginPath();
      g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      g.stroke();
    }

    // 12 大独立古法阵内芯纹样
    const sid = sealId % 12;
    if (sid === 0) {
      // 0. 先天太极八卦阵（真实八组三爻卦象 + 阴阳鱼眼）
      const trigrams = [
        [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1],
        [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0],
      ];
      for (let i = 0; i < 8; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 8);
        const tri = trigrams[i];
        g.strokeStyle = c3;
        g.lineWidth = 2.6;
        for (let row = 0; row < 3; row++) {
          const yy = -R * 0.66 - row * 6.5;
          if (tri[row]) {
            g.beginPath(); g.moveTo(-13, yy); g.lineTo(13, yy); g.stroke();
          } else {
            g.beginPath();
            g.moveTo(-13, yy); g.lineTo(-3, yy);
            g.moveTo(3, yy); g.lineTo(13, yy);
            g.stroke();
          }
        }
        g.restore();
      }
      // 中央太极双鱼环
      g.strokeStyle = c3; g.lineWidth = 2.2;
      g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, -17, 17, -Math.PI / 2, Math.PI / 2); g.arc(0, 17, 17, -Math.PI / 2, Math.PI / 2, true); g.stroke();
      g.fillStyle = c3;
      g.beginPath(); g.arc(0, -17, 4.5, 0, Math.PI * 2); g.arc(0, 17, 4.5, 0, Math.PI * 2); g.fill();
    } else if (sid === 1) {
      // 1. 二十八宿浑天星盘阵
      g.strokeStyle = c2; g.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        for (let i = 0; i <= 7; i++) {
          const a = (Math.PI * 2 * ((i * 3) % 7)) / 7 + k * 0.45;
          const px = Math.cos(a) * (R * 0.80), py = Math.sin(a) * (R * 0.80);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const a = (Math.PI * 2 * i) / 14;
        g.fillStyle = i % 2 === 0 ? c3 : c2;
        g.beginPath(); g.arc(Math.cos(a) * (R * 0.80), Math.sin(a) * (R * 0.80), 3.6, 0, Math.PI * 2); g.fill();
      }
    } else if (sid === 2) {
      // 2. 十二品红莲业火曼陀罗阵
      for (let layer = 0; layer < 2; layer++) {
        const petals = 12;
        const rad = layer === 0 ? R * 0.84 : R * 0.52;
        g.strokeStyle = layer === 0 ? c3 : c2;
        g.lineWidth = 2.0;
        for (let i = 0; i < petals; i++) {
          g.save();
          g.rotate((Math.PI * 2 * i) / petals + layer * (Math.PI / petals));
          g.beginPath();
          g.moveTo(0, -16);
          g.quadraticCurveTo(16, -rad * 0.58, 0, -rad);
          g.quadraticCurveTo(-16, -rad * 0.58, 0, -16);
          g.stroke();
          g.restore();
        }
      }
    } else if (sid === 3) {
      // 3. 六合寒晶雪花棱镜阵
      g.strokeStyle = c3; g.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 6);
        g.beginPath();
        g.moveTo(0, 0); g.lineTo(0, -R * 0.86);
        g.moveTo(0, -R * 0.45); g.lineTo(-16, -R * 0.62);
        g.moveTo(0, -R * 0.45); g.lineTo(16, -R * 0.62);
        g.moveTo(0, -R * 0.68); g.lineTo(-11, -R * 0.80);
        g.moveTo(0, -R * 0.68); g.lineTo(11, -R * 0.80);
        g.stroke();
        g.restore();
      }
      g.strokeStyle = c2; g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
        if (i === 0) g.moveTo(Math.cos(a) * 52, Math.sin(a) * 52);
        else g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
      }
      g.stroke();
    } else if (sid === 4) {
      // 4. 传国玉玺方圆帝印阵
      const sq = R * 0.58;
      g.strokeStyle = c3; g.lineWidth = 2.6;
      g.strokeRect(-sq, -sq, sq * 2, sq * 2);
      g.strokeStyle = c2; g.lineWidth = 1.5;
      g.strokeRect(-sq + 8, -sq + 8, (sq - 8) * 2, (sq - 8) * 2);
      // 篆书回纹骨架
      for (let k = -1; k <= 1; k += 2) {
        g.beginPath();
        g.moveTo(k * 18, -sq + 14); g.lineTo(k * 18, sq - 14);
        g.moveTo(-sq + 14, k * 18); g.lineTo(sq - 14, k * 18);
        g.stroke();
      }
    } else if (sid === 5) {
      // 5. 天罡二十四剑轮阵
      for (let i = 0; i < 16; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 16);
        g.strokeStyle = i % 2 === 0 ? c3 : c2;
        g.lineWidth = 1.8;
        g.beginPath();
        g.moveTo(0, -34); g.lineTo(-4, -R * 0.72); g.lineTo(0, -R * 0.86); g.lineTo(4, -R * 0.72); g.closePath();
        g.stroke();
        g.restore();
      }
    } else if (sid === 6) {
      // 6. 五雷天师敕令五芒雷纹阵
      g.strokeStyle = c3; g.lineWidth = 2.3;
      g.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (Math.PI * 4 * i) / 5;
        const px = Math.cos(a) * (R * 0.82), py = Math.sin(a) * (R * 0.82);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    } else if (sid === 7) {
      // 7. 鬼神修罗八方月牙戟阵
      for (let i = 0; i < 8; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 8);
        g.strokeStyle = c3; g.lineWidth = 2.2;
        g.beginPath();
        g.arc(0, -R * 0.62, 22, -Math.PI * 0.8, -Math.PI * 0.2);
        g.moveTo(0, -24); g.lineTo(0, -R * 0.86);
        g.stroke();
        g.restore();
      }
    } else if (sid === 8) {
      // 8. 苍龙盘云漩涡图腾阵
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 6);
        g.strokeStyle = i % 2 === 0 ? c3 : c2;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(12, 0);
        g.bezierCurveTo(38, -28, 68, -42, 0, -R * 0.84);
        g.stroke();
        g.restore();
      }
    } else if (sid === 9) {
      // 9. 奇门遁甲九宫洛书阵
      g.strokeStyle = c3; g.lineWidth = 2.0;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        g.beginPath();
        g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
        g.lineTo(Math.cos(a) * (R * 0.84), Math.sin(a) * (R * 0.84));
        g.stroke();
      }
      g.strokeRect(-42, -42, 84, 84);
    } else if (sid === 10) {
      // 10. 洛神花钿双月阵
      for (let i = 0; i < 8; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 8);
        g.strokeStyle = c3; g.lineWidth = 2.0;
        g.beginPath();
        g.arc(0, -R * 0.56, 22, Math.PI * 0.9, Math.PI * 2.1);
        g.stroke();
        g.restore();
      }
    } else {
      // 11. 金乌耀日十二芒星阵
      g.strokeStyle = c3; g.lineWidth = 2.1;
      for (let i = 0; i < 12; i++) {
        g.save();
        g.rotate((Math.PI * 2 * i) / 12);
        g.beginPath();
        g.moveTo(-7, -36); g.lineTo(0, -R * 0.88); g.lineTo(7, -36);
        g.stroke();
        g.restore();
      }
    }

    g.restore();
    sealCache[key] = cvs;
    sealCacheCount++;
    return cvs;
  }

  // ================= 高精细神兵与圣兽图腾绘制原语 =================

  // 1. 精雕传世宝剑（立体双面剑脊、黄金吞口剑格、缠绳剑柄、流苏剑穗）
  function drawOrnateSword(ctx, len, pal) {
    // 剑刃外发光
    ctx.save();
    ctx.shadowColor = pal.c2;
    ctx.shadowBlur = 12;
    const bGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    bGrad.addColorStop(0, pal.c2);
    bGrad.addColorStop(0.5, pal.core);
    bGrad.addColorStop(1, pal.c1);
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.moveTo(0, len * 0.18);
    ctx.lineTo(-7.5, 0);
    ctx.lineTo(-5.2, -len * 0.72);
    ctx.lineTo(5.2, -len * 0.72);
    ctx.lineTo(7.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 剑脊寒光血槽线
    ctx.strokeStyle = pal.core;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, len * 0.14);
    ctx.lineTo(0, -len * 0.70);
    ctx.stroke();

    // 黄金凤翼吞口剑格
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.68);
    ctx.lineTo(-17, -len * 0.76);
    ctx.lineTo(-11, -len * 0.80);
    ctx.lineTo(0, -len * 0.75);
    ctx.lineTo(11, -len * 0.80);
    ctx.lineTo(17, -len * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 剑柄与剑首玉环
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-3, -len * 0.96, 6, len * 0.20);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -len * 0.99, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. 精雕方天画戟（中锋利矛 + 黄金龙头吞口 + 左右双月牙利刃 + 飘扬红缨）
  function drawOrnateHalberd(ctx, len, dualSide, pal) {
    // 镌金玄铁长杆
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, len * 0.18); ctx.lineTo(0, -len * 0.78); ctx.stroke();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, len * 0.18); ctx.lineTo(0, -len * 0.78); ctx.stroke();

    // 飘扬朱红缨穗
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.2;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.56);
      ctx.quadraticCurveTo(k * 24, -len * 0.50, k * 32, -len * 0.38);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = pal.c2;
    ctx.shadowBlur = 16;
    // 中锋破天枪尖
    ctx.fillStyle = pal.core;
    ctx.strokeStyle = pal.c2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(-8, -len * 0.74);
    ctx.lineTo(0, -len * 0.68);
    ctx.lineTo(8, -len * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 月牙侧耳刃
    const sides = dualSide ? [-1, 1] : [1];
    sides.forEach((dir) => {
      ctx.fillStyle = pal.core;
      ctx.strokeStyle = pal.c3;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(dir * 6, -len * 0.72);
      ctx.quadraticCurveTo(dir * 42, -len * 0.84, dir * 34, -len * 0.94);
      ctx.quadraticCurveTo(dir * 52, -len * 0.70, dir * 34, -len * 0.46);
      ctx.quadraticCurveTo(dir * 40, -len * 0.56, dir * 6, -len * 0.60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();

    // 黄金龙首吞口箍
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -len * 0.66, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 精雕青龙偃月刀 / 霸刀（宽厚弧形刀背锯齿 + 冷艳刀锋高光 + 龙首吞口）
  function drawOrnateGuandao(ctx, len, pal) {
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 7.5;
    ctx.beginPath(); ctx.moveTo(0, len * 0.20); ctx.lineTo(0, -len * 0.58); ctx.stroke();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, len * 0.20); ctx.lineTo(0, -len * 0.58); ctx.stroke();

    ctx.save();
    ctx.shadowColor = pal.c2;
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(-8, -len, 44, -len * 0.55);
    g.addColorStop(0, pal.c1);
    g.addColorStop(0.55, pal.c2);
    g.addColorStop(1, pal.core);
    ctx.fillStyle = g;
    ctx.strokeStyle = pal.core;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-4, -len * 0.56);
    ctx.lineTo(-6, -len * 0.90);
    ctx.quadraticCurveTo(8, -len * 1.04, 28, -len * 0.98);
    ctx.quadraticCurveTo(50, -len * 0.78, 30, -len * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 黄金吞口与红缨
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(0, -len * 0.56, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-4, -len * 0.54); ctx.quadraticCurveTo(-28, -len * 0.48, -36, -len * 0.34); ctx.stroke();
  }

  // 4. 精雕游龙圣灵（24节动态蜿蜒龙躯 + 龙鳞高光 + 龙角龙须 + 戏珠）
  function drawCoilingDragon(ctx, cx, cy, scale, p, facing, pal) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(facing * scale, scale);
    ctx.globalCompositeOperation = 'lighter';

    const segs = 24;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; // 0 = 尾 -> 1 = 龙头
      const px = -180 + t * 340;
      const py = Math.sin(t * Math.PI * 3.2 - p * 12) * (34 * (1 - t * 0.25)) - Math.sin(t * Math.PI) * 32;
      pts.push({ x: px, y: py, r: 4 + Math.sin(t * Math.PI) * 14 + (t > 0.85 ? 6 : 0) });
    }

    // 龙身外层辉光与立体鳞节
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      ctx.fillStyle = i % 2 === 0 ? pal.c2 : pal.c1;
      ctx.globalAlpha = 0.42 + (i / segs) * 0.45;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
      // 背鳍金芒
      if (i % 2 === 1 && i < segs - 1) {
        ctx.strokeStyle = pal.c3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - pt.r * 0.6);
        ctx.lineTo(pt.x - 8, pt.y - pt.r * 1.55);
        ctx.stroke();
      }
    }

    // 龙脊流光亮线
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = pal.core;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    pts.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();

    // 威严龙首 + 鹿角 + 飘逸龙须 + 龙珠
    const head = pts[pts.length - 1];
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.moveTo(26, -2); ctx.lineTo(4, -15); ctx.lineTo(-10, -8); ctx.lineTo(-8, 10); ctx.lineTo(18, 8);
    ctx.closePath(); ctx.fill();
    // 龙角与长须
    ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-2, -12); ctx.lineTo(-22, -28); ctx.lineTo(-14, -18);
    ctx.moveTo(20, -2); ctx.quadraticCurveTo(38, -18, 48, -8);
    ctx.moveTo(18, 6); ctx.quadraticCurveTo(36, 20, 46, 12);
    ctx.stroke();
    // 璀璨龙珠
    ctx.fillStyle = pal.c3;
    ctx.beginPath(); ctx.arc(38, -1, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(38, -1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // 5. 精雕涅槃火凤 / 冰凰展翅（双翼各10根流光翎羽 + 凤冠 + 三缕修长尾羽飘带）
  function drawSoaringPhoenix(ctx, cx, cy, scale, p, facing, pal) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(facing * scale, scale);
    ctx.globalCompositeOperation = 'lighter';

    const flap = Math.sin(p * 18) * 0.24;
    // 三道修长凤尾流光丝带
    for (let t = -1; t <= 1; t++) {
      ctx.strokeStyle = t === 0 ? pal.c3 : pal.c2;
      ctx.lineWidth = t === 0 ? 4 : 2.6;
      ctx.beginPath();
      ctx.moveTo(-12, t * 4);
      ctx.bezierCurveTo(-58, t * 24 + Math.sin(p * 14 + t) * 18, -115, -t * 22, -165, t * 18);
      ctx.stroke();
    }

    // 上下华丽展翼（多层渐变飞羽）
    [-1, 1].forEach((wingDir) => {
      ctx.save();
      ctx.rotate(wingDir * (0.28 + flap));
      for (let f = 0; f < 9; f++) {
        const ang = wingDir * (-0.25 - f * 0.13);
        const fLen = 88 - f * 6.5;
        ctx.save();
        ctx.rotate(ang);
        ctx.fillStyle = f % 2 === 0 ? pal.c2 : pal.c3;
        ctx.globalAlpha = 0.78 - f * 0.05;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(fLen * 0.45, wingDir * -10, fLen, wingDir * -24);
        ctx.quadraticCurveTo(fLen * 0.55, wingDir * 2, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });

    // 凤躯与高昂凤冠
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.ellipse(6, 0, 24, 9, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, -4); ctx.lineTo(40, -2); ctx.lineTo(26, 4); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(20, -6); ctx.quadraticCurveTo(8, -24, -8, -22);
    ctx.stroke();
    ctx.restore();
  }

  // 6. 猛虎 / 贪狼裂空兽魂 + 五道撕天金爪痕
  function drawTigerClawSpirit(ctx, cx, cy, p, facing, pal) {
    ctx.save();
    ctx.translate(cx, cy - 38);
    ctx.scale(facing, 1);
    ctx.globalCompositeOperation = 'lighter';

    // 兽王咆哮音波震环
    for (let r = 0; r < 3; r++) {
      const rp = (p * 1.8 - r * 0.18);
      if (rp > 0 && rp < 1) {
        ctx.globalAlpha = (1 - rp) * 0.75;
        ctx.strokeStyle = r === 0 ? pal.core : pal.c3;
        ctx.lineWidth = 3.5 * (1 - rp);
        ctx.beginPath();
        ctx.arc(0, -10, 28 + rp * 125, -0.9, 0.9);
        ctx.stroke();
      }
    }

    // 五道凌厉弯弧撕裂爪芒
    const slashP = Math.min(1, p * 2.6);
    for (let k = -2; k <= 2; k++) {
      ctx.globalAlpha = 0.92;
      ctx.strokeStyle = Math.abs(k) <= 1 ? pal.core : pal.c2;
      ctx.lineWidth = (5.5 - Math.abs(k)) * (1 - p * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const sy = k * 18 - 32;
      ctx.moveTo(-68, sy - 24);
      ctx.quadraticCurveTo(12, sy - 8, -68 + 168 * slashP, sy + 42 * slashP);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ================= 天幕异象层（10种恢弘背景意境） =================

  function drawSkyPhenomenon(ctx, skyId, vx, vw, cx, cy, p, alpha, pal) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.78;
    ctx.globalCompositeOperation = 'lighter';

    if (skyId === 'dipper') {
      // 北斗七星连珠天象（精确勺状七星 + 星轨连线 + 垂天星柱）
      const stars = [
        [-135, 58], [-88, 66], [-46, 82], [-6, 98],
        [14, 134], [76, 138], [108, 96],
      ];
      const ox = vx + vw * 0.5;
      ctx.strokeStyle = pal.c2;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      stars.forEach((s, i) => { if (i === 0) ctx.moveTo(ox + s[0], s[1]); else ctx.lineTo(ox + s[0], s[1]); });
      ctx.stroke();
      stars.forEach((s, i) => {
        const sx = ox + s[0], sy = s[1];
        const pulse = 5 + Math.sin(p * 16 + i) * 2;
        ctx.fillStyle = pal.c3;
        ctx.beginPath(); ctx.arc(sx, sy, pulse * 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (skyId === 'full_moon' || skyId === 'blood_moon') {
      // 皎洁洛神满月 / 修罗血月凌空
      const mx = cx, my = 86;
      const isBlood = skyId === 'blood_moon';
      const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 68);
      mg.addColorStop(0, isBlood ? '#fecaca' : '#fffbeb');
      mg.addColorStop(0.52, isBlood ? '#dc2626' : pal.c2);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, 68, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isBlood ? '#ef4444' : '#fef9c3';
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath(); ctx.arc(mx, my, 32, 0, Math.PI * 2); ctx.fill();
    } else if (skyId === 'sun_halo' || skyId === 'star_crown') {
      // 帝王金乌日冕 / 紫薇星冠
      const mx = cx, my = 84;
      ctx.translate(mx, my);
      ctx.rotate(p * 0.9);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.fillStyle = i % 2 === 0 ? pal.c3 : pal.c2;
        ctx.globalAlpha = alpha * 0.42;
        ctx.beginPath();
        ctx.moveTo(-5, -18); ctx.lineTo(0, -64); ctx.lineTo(5, -18);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
    } else if (skyId === 'talisman_ring') {
      // 天师敕令悬浮金符环
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + p * 2.2;
        const tx = cx + Math.cos(a) * 115;
        const ty = 95 + Math.sin(a) * 22;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.4;
        ctx.fillRect(-7, -15, 14, 30);
        ctx.strokeRect(-7, -15, 14, 30);
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(-3, 0); ctx.lineTo(3, 4); ctx.lineTo(0, 11);
        ctx.stroke();
        ctx.restore();
      }
    } else if (skyId === 'storm_cloud' || skyId === 'fire_clouds' || skyId === 'frost_aurora') {
      // 天顶压境雷云 / 赤壁火云 / 北冥极光帷幕
      const cg = ctx.createLinearGradient(vx, 36, vx, 128);
      cg.addColorStop(0, pal.c1);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha * 0.34;
      ctx.fillStyle = cg;
      ctx.fillRect(vx, 36, vw, 92);
    }
    ctx.restore();
  }

  // ================= 20+ 种高精细主招式核心演出 =================

  function drawMainAction(ctx, prof, fx, vx, vw, p, alpha, facing) {
    const pal = prof.pal;
    const x = fx.x, y = fx.y;
    const v = prof.variant;
    const isFull = !!fx.isFullscreen;
    const spanW = isFull ? vw - 120 : 320;
    const leftX = isFull ? vx + 60 : x - 160;

    ctx.save();

    switch (prof.action) {
      case 'imperial_sword_rain':
      case 'talisman_sword_judgment': {
        // 【万剑归宗 · 天罡圣剑阵】：空中巨型母剑悬浮 + 20~28柄精细飞剑带流光尾迹贯落！
        const count = (isFull ? 22 : 14) + (v % 5) * 2;
        // 苍穹母剑镇压
        ctx.save();
        ctx.translate(isFull ? vx + vw / 2 : x, 108 + Math.sin(p * 8) * 6);
        ctx.globalAlpha = alpha * 0.92;
        ctx.scale(1.45, 1.45);
        drawOrnateSword(ctx, 78, pal);
        ctx.restore();

        for (let i = 0; i < count; i++) {
          const delay = ((i * 37 + v * 13) % 100) / 185;
          const sp = (p - delay) / 0.44;
          if (sp < 0 || sp > 1.25) continue;
          const f = easeOutCubic(Math.min(1, sp));
          const tx = leftX + ((i * 131 + prof.seed) % spanW);
          const ty = 205 + ((i * 47 + v * 19) % 165);
          const slant = prof.action === 'talisman_sword_judgment' ? 0 : -55 * facing;
          const sx = tx + slant * (1 - f);
          const sy = 42 + (ty - 42) * f;

          ctx.save();
          ctx.globalAlpha = alpha * (sp > 1 ? Math.max(0, 1 - (sp - 1) * 4) : 1);
          ctx.translate(sx, sy);
          ctx.rotate(Math.atan2(ty - 42, -slant) - Math.PI / 2);
          // 剑气拖尾光带
          ctx.globalCompositeOperation = 'lighter';
          const tg = ctx.createLinearGradient(0, 0, 0, -90);
          tg.addColorStop(0, pal.c2);
          tg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = tg;
          ctx.fillRect(-5, -90, 10, 85);
          drawOrnateSword(ctx, 48, pal);
          ctx.restore();

          if (sp >= 0.92) {
            const rp = (sp - 0.92) / 0.33;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = alpha * Math.max(0, 1 - rp);
            ctx.strokeStyle = pal.c3;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(tx, ty, 24 * rp + 6, 9 * rp + 3, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
        }
        break;
      }

      case 'fangtian_cross_rift':
      case 'sweeping_halberd_wave': {
        // 【无双画戟 · 十方裂天斩】：精雕方天画戟凌空重劈 + 十字空间裂痕 + 8道冲天血金罡柱
        const swingP = easeOutCubic(Math.min(1, p * 2.3));
        const ang = (-1.55 + swingP * 1.98) * facing;

        // 挥砍双层流光月牙刀弧残影
        ctx.save();
        ctx.translate(x - 24 * facing, y - 48);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.72;
        for (let k = 0; k < 2; k++) {
          ctx.strokeStyle = k === 0 ? pal.c2 : pal.core;
          ctx.lineWidth = k === 0 ? 22 : 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, 168 - k * 8, -1.5 * facing, (-1.5 + swingP * 1.95) * facing, facing < 0);
          ctx.stroke();
        }
        ctx.rotate(ang);
        ctx.scale(facing, 1);
        ctx.globalAlpha = alpha;
        drawOrnateHalberd(ctx, 198, prof.action === 'fangtian_cross_rift', pal);
        ctx.restore();

        // 落地瞬间爆发十字裂空戟芒
        if (p > 0.28) {
          const cp = Math.min(1, (p - 0.28) / 0.55);
          ctx.save();
          ctx.translate(x + 24 * facing, y - 24);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * (1 - cp * 0.45);
          [-0.42, 0.42].forEach((ca) => {
            ctx.save();
            ctx.rotate(ca);
            const len = 175 * easeOutCubic(cp);
            ctx.fillStyle = pal.c2;
            ctx.beginPath();
            ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -14, len, 0); ctx.quadraticCurveTo(0, 14, -len, 0);
            ctx.fill();
            ctx.fillStyle = pal.core;
            ctx.beginPath();
            ctx.moveTo(-len * 0.85, 0); ctx.quadraticCurveTo(0, -5, len * 0.85, 0); ctx.quadraticCurveTo(0, 5, -len * 0.85, 0);
            ctx.fill();
            ctx.restore();
          });
          ctx.restore();
        }
        break;
      }

      case 'colossal_guandao':
      case 'moon_triple_crescent': {
        // 【偃月神刀 / 孤月三叠斩】：斩月专属悬空弯月刀轮，刀罡专属青龙偃月重劈 + 3道破空弯月刀气波！
        const swingP = easeOutCubic(Math.min(1, p * 2.5));
        if (prof.action === 'moon_triple_crescent') {
          ctx.save();
          ctx.translate(x - 18 * facing, y - 82);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = pal.c3;
          ctx.beginPath();
          ctx.arc(0, 0, 46, -Math.PI * 0.75, Math.PI * 0.75);
          ctx.quadraticCurveTo(18, 0, 46 * Math.cos(-Math.PI * 0.75), 46 * Math.sin(-Math.PI * 0.75));
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(x - 36 * facing, y - 42);
          ctx.rotate((-1.4 + swingP * 1.8) * facing);
          ctx.scale(facing, 1);
          ctx.globalAlpha = alpha;
          drawOrnateGuandao(ctx, 186, pal);
          ctx.restore();
        }

        // 三叠破空弯月刀罡
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let w = 0; w < 3; w++) {
          const wp = (p - 0.14 - w * 0.10) / 0.65;
          if (wp <= 0 || wp > 1) continue;
          const wx = x + (wp * 260 - w * 32) * facing;
          const wy = y - 46;
          const h = 76 + w * 18;
          ctx.save();
          ctx.translate(wx, wy);
          ctx.scale(facing, 1);
          ctx.globalAlpha = alpha * (1 - wp * 0.55);
          ctx.fillStyle = w === 0 ? pal.core : pal.c2;
          ctx.beginPath();
          ctx.moveTo(-12, -h);
          ctx.quadraticCurveTo(56, 0, -12, h);
          ctx.quadraticCurveTo(24, 0, -12, -h);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        break;
      }

      case 'seven_star_spears': {
        // 【七进七出 · 流星银龙枪网】：7~11道交叉寒星枪影瞬闪穿梭 + 枪尖寒芒十字星闪！
        const slashes = 8 + (v % 4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < slashes; i++) {
          const delay = i * 0.065;
          const sp = (p - delay) / 0.36;
          if (sp < 0 || sp > 1) continue;
          const ang = ((i * 2.39996) % (Math.PI * 2));
          const dist = 165;
          const cx0 = x + Math.cos(ang + Math.PI) * dist;
          const cy0 = (y - 36) + Math.sin(ang + Math.PI) * dist * 0.58;
          const cx1 = x + Math.cos(ang) * dist;
          const cy1 = (y - 36) + Math.sin(ang) * dist * 0.58;
          const headX = cx0 + (cx1 - cx0) * easeOutCubic(sp);
          const headY = cy0 + (cy1 - cy0) * easeOutCubic(sp);

          const lg = ctx.createLinearGradient(cx0, cy0, headX, headY);
          lg.addColorStop(0, 'rgba(0,0,0,0)');
          lg.addColorStop(0.6, pal.c2);
          lg.addColorStop(1, pal.core);
          ctx.strokeStyle = lg;
          ctx.lineWidth = 7 * (1 - sp * 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(headX, headY); ctx.stroke();

          // 枪尖寒星十字芒
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(headX, headY, 5.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        break;
      }

      case 'kirin_bow_volley':
      case 'sun_piercer_arrow': {
        // 【百步穿杨 · 麒麟神弓贯日箭雨】：半空浮现巨型雕花麒麟宝弓满月开弦 + 巨型凤翎主箭 + 36支流星羽箭！
        const bowX = (fx.casterX || (x - 220 * facing)) + 20 * facing;
        const bowY = y - 78;
        const pull = p < 0.28 ? easeOutCubic(p / 0.28) : Math.max(0, 1 - (p - 0.28) * 5);

        // 巨型鎏金麒麟神弓虚影
        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.scale(facing, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.88;
        ctx.strokeStyle = pal.c3;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-8, -76);
        ctx.bezierCurveTo(38, -42, 38, 42, -8, 76);
        ctx.stroke();
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -76);
        ctx.lineTo(-8 - pull * 34, 0);
        ctx.lineTo(-8, 76);
        ctx.stroke();
        ctx.restore();

        // 贯日主神箭破空激射（带3圈音爆金环！）
        if (p >= 0.22 && prof.action === 'sun_piercer_arrow') {
          const mp = Math.min(1, (p - 0.22) / 0.46);
          const ax = bowX + mp * 480 * facing;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * (1 - mp * 0.25);
          const ag = ctx.createLinearGradient(ax, bowY + 26, ax - 190 * facing, bowY + 26);
          ag.addColorStop(0, pal.core);
          ag.addColorStop(0.4, pal.c2);
          ag.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = ag;
          ctx.lineWidth = 16;
          ctx.beginPath(); ctx.moveTo(ax - 190 * facing, bowY + 26); ctx.lineTo(ax, bowY + 26); ctx.stroke();
          for (let r = 0; r < 3; r++) {
            ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.ellipse(ax - r * 48 * facing, bowY + 26, 8, 28 - r * 5, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
        }

        // 漫天精细雕翎流星箭雨
        const total = 30 + (v % 5) * 3;
        for (let i = 0; i < total; i++) {
          const delay = 0.12 + ((i * 29) % 100) / 210;
          const ap = (p - delay) / 0.42;
          if (ap < 0 || ap > 1.1) continue;
          const f = Math.min(1, ap);
          const tx = leftX + ((i * 107 + prof.seed) % spanW);
          const ty = 198 + ((i * 59) % 175);
          const sx = tx - 175 * facing;
          const sy = 15;
          const cxA = sx + (tx - sx) * f, cyA = sy + (ty - sy) * f;

          ctx.save();
          ctx.globalAlpha = alpha * (ap > 1 ? 1 - (ap - 1) * 9 : 1);
          ctx.translate(cxA, cyA);
          ctx.rotate(Math.atan2(ty - sy, tx - sx));
          ctx.strokeStyle = pal.c2; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(8, 0); ctx.stroke();
          ctx.fillStyle = pal.core;
          ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = pal.c3;
          ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-32, -4.5); ctx.lineTo(-28, 0); ctx.lineTo(-32, 4.5); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;
      }

      case 'thunder_drum_tempest':
      case 'heaven_pillars': {
        // 【九霄雷霆 · 分叉紫电神雷网】：真实分形枝状闪电劈落 + 地表跳跃电弧网 + 天罚圣光柱！
        const bolts = (isFull ? 8 : 5) + (v % 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < bolts; b++) {
          const bx = leftX + (b + 0.5) * (spanW / bolts);
          const by = 212 + ((b * 67 + prof.seed) % 150);
          const flick = Math.sin(p * 46 + b * 2.3) > -0.55 ? 1 : 0.3;
          ctx.globalAlpha = alpha * flick;

          if (prof.action === 'heaven_pillars') {
            const pg = ctx.createLinearGradient(bx - 22, 0, bx + 22, 0);
            pg.addColorStop(0, 'rgba(0,0,0,0)');
            pg.addColorStop(0.5, pal.c2);
            pg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pg;
            ctx.fillRect(bx - 22, 36, 44, by - 36);
          }

          // 主雷干 + 侧分叉枝状雷弧
          const frameSeed = Math.floor(p * 26) + b * 17;
          const drawBolt = (x0, y0, x1, y1, segs, wLine) => {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            for (let s = 1; s <= segs; s++) {
              const t = s / segs;
              const jx = s === segs ? 0 : (seeded(frameSeed, s * 7 + b) - 0.5) * 38;
              const nx = x0 + (x1 - x0) * t + jx;
              const ny = y0 + (y1 - y0) * t;
              ctx.lineTo(nx, ny);
            }
            ctx.strokeStyle = pal.c2; ctx.lineWidth = wLine * 2.4; ctx.stroke();
            ctx.strokeStyle = pal.core; ctx.lineWidth = wLine * 0.9; ctx.stroke();
          };
          drawBolt(bx + (b % 2 === 0 ? -18 : 18), 32, bx, by, 8, 3.2);
          drawBolt(bx + 6, 110, bx + (b % 2 === 0 ? 48 : -48), 195, 4, 1.6);

          // 落雷点炸裂电环
          ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.ellipse(bx, by, 34, 12, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'frost_lotus':
      case 'glacier_prism': {
        // 【洛神冰莲 · 六合寒晶破】：中央绽放12瓣立体剔透冰莲 + 四周层叠多切面钻石冰棱破土而出！
        ctx.save();
        const bloom = easeOutBack(Math.min(1, p * 1.9));
        // 中央盛放立体冰晶莲花
        ctx.save();
        ctx.translate(x, y - 16);
        ctx.globalCompositeOperation = 'lighter';
        for (let layer = 0; layer < 2; layer++) {
          const petals = layer === 0 ? 10 : 8;
          for (let i = 0; i < petals; i++) {
            const ang = (Math.PI * 2 * i) / petals + layer * 0.3 + p * 0.4;
            const len = (layer === 0 ? 92 : 62) * bloom;
            const px = Math.cos(ang) * len;
            const py = Math.sin(ang) * len * 0.45 - (layer === 1 ? 18 : 6);
            ctx.fillStyle = layer === 0 ? pal.c2 : pal.core;
            ctx.globalAlpha = alpha * (layer === 0 ? 0.55 : 0.82);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(px * 0.5 - py * 0.25, py * 0.5 - 16, px, py);
            ctx.quadraticCurveTo(px * 0.5 + py * 0.25, py * 0.5 + 8, 0, 0);
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
          }
        }
        ctx.restore();

        // 多切面折光冰棱柱阵
        const spikes = (isFull ? 10 : 6) + (v % 3);
        for (let i = 0; i < spikes; i++) {
          const sp = easeOutBack(Math.max(0, Math.min(1, (p - i * 0.04) * 3.0)));
          if (sp <= 0) continue;
          const ix = leftX + (i + 0.5) * (spanW / spikes);
          const iy = 220 + ((i * 53 + prof.seed) % 140);
          const ih = (78 + (i % 3) * 26) * sp;
          const iw = 18 + (i % 2) * 6;
          const tilt = ((i % 3) - 1) * 10;

          ctx.globalAlpha = alpha * 0.92;
          // 冰晶左暗切面与右亮切面（真实3D宝石质感！）
          ctx.fillStyle = pal.c1;
          ctx.beginPath();
          ctx.moveTo(ix - iw, iy); ctx.lineTo(ix + tilt, iy - ih); ctx.lineTo(ix + tilt * 0.2, iy + 6);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = pal.c3;
          ctx.beginPath();
          ctx.moveTo(ix + iw, iy); ctx.lineTo(ix + tilt, iy - ih); ctx.lineTo(ix + tilt * 0.2, iy + 6);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ix + tilt, iy - ih); ctx.lineTo(ix + tilt * 0.2, iy + 6); ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'meteor_fire_pillars':
      case 'wildfire_lotus_sea':
      case 'astral_starfall':
      case 'shattering_constellation': {
        // 【赤壁天火陨星 / 七百里火海冲天柱】：带多层流焰彗尾的陨星俯冲 + 螺旋上升烈焰龙卷火柱！
        const count = (isFull ? 8 : 5) + (v % 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < count; i++) {
          const delay = i * 0.065;
          const mp = (p - delay) / 0.58;
          if (mp < 0 || mp > 1.3) continue;
          const tx = leftX + ((i * 139 + prof.seed) % spanW);
          const ty = 208 + ((i * 61 + v * 17) % 155);
          const sx = tx - 210 * facing;
          const sy = -45;

          if (mp < 0.62 && prof.action !== 'wildfire_lotus_sea') {
            const f = mp / 0.62;
            const cxM = sx + (tx - sx) * f, cyM = sy + (ty - sy) * f;
            const tg = ctx.createLinearGradient(cxM, cyM, cxM - (tx - sx) * 0.34, cyM - (ty - sy) * 0.34);
            tg.addColorStop(0, pal.core);
            tg.addColorStop(0.35, pal.c2);
            tg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.strokeStyle = tg; ctx.lineWidth = 22; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cxM, cyM); ctx.lineTo(cxM - (tx - sx) * 0.32, cyM - (ty - sy) * 0.32); ctx.stroke();
            ctx.fillStyle = pal.core;
            ctx.beginPath(); ctx.arc(cxM, cyM, 12, 0, Math.PI * 2); ctx.fill();
          } else {
            // 轰击地面升腾螺旋火柱 / 星辰光柱！
            const ep = prof.action === 'wildfire_lotus_sea' ? Math.min(1, mp) : (mp - 0.62) / 0.68;
            const colH = (145 + (i % 3) * 32) * Math.sin(Math.min(1, ep) * Math.PI * 0.85);
            ctx.globalAlpha = alpha * Math.max(0, 1 - ep * 0.85);
            const pg = ctx.createLinearGradient(tx, ty, tx, ty - colH);
            pg.addColorStop(0, pal.core);
            pg.addColorStop(0.45, pal.c2);
            pg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.moveTo(tx - 26, ty);
            ctx.quadraticCurveTo(tx - 14, ty - colH * 0.6, tx, ty - colH);
            ctx.quadraticCurveTo(tx + 14, ty - colH * 0.6, tx + 26, ty);
            ctx.closePath();
            ctx.fill();
            // 螺旋盘绕火带
            ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let h = 0; h <= colH; h += 12) {
              const wx = tx + Math.sin(h * 0.08 - p * 18 + i) * 20 * (1 - h / (colH + 10));
              if (h === 0) ctx.moveTo(wx, ty - h); else ctx.lineTo(wx, ty - h);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
        break;
      }

      case 'tsunami_water_dragon': {
        // 【沧海覆海怒涛 · 锦帆水龙卷】：浮世绘/国画卷浪白头巨浪奔涌 + 苍龙跃海！
        const travel = easeOutCubic(p) * 320 * facing;
        ctx.save();
        for (let w = 0; w < 3; w++) {
          const wx = (x - 140 * facing) + travel - w * 68 * facing;
          const wy = y + 8 - w * 14;
          const wh = 86 - w * 14;
          ctx.save();
          ctx.translate(wx, wy);
          ctx.scale(facing, 1);
          ctx.globalAlpha = alpha * (0.85 - w * 0.18);
          const wg = ctx.createLinearGradient(0, 0, 0, -wh);
          wg.addColorStop(0, pal.c1);
          wg.addColorStop(0.7, pal.c2);
          wg.addColorStop(1, pal.c3);
          ctx.fillStyle = wg;
          ctx.beginPath();
          ctx.moveTo(-95, 0);
          ctx.quadraticCurveTo(-20, -wh * 0.35, 22, -wh);
          ctx.quadraticCurveTo(58, -wh * 0.92, 42, -wh * 0.52);
          ctx.quadraticCurveTo(22, -wh * 0.62, 34, 0);
          ctx.closePath();
          ctx.fill();
          // 浪尖雪白飞沫勾边
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-30, -wh * 0.42); ctx.quadraticCurveTo(22, -wh, 42, -wh * 0.52);
          ctx.stroke();
          ctx.restore();
        }
        drawCoilingDragon(ctx, x + travel * 0.35, y - 56, 0.85, p, facing, pal);
        ctx.restore();
        break;
      }

      case 'twin_jade_tornadoes': {
        // 【双龙狂岚 · 翡翠刀刃风暴】：两座交错行进的立体流光风卷 + 环绕真空风刃月牙！
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        [-1, 1].forEach((dir, idx) => {
          const tx = x + dir * 56 + Math.sin(p * 8 + idx * 3) * 34 + (p - 0.3) * 85 * facing;
          for (let i = 0; i < 16; i++) {
            const t = i / 15;
            const ly = y + 4 - t * 195;
            const rx = 14 + t * 56;
            const rot = p * 22 * dir + i * 0.65;
            ctx.globalAlpha = alpha * (0.35 + (1 - Math.abs(t - 0.5)) * 0.55);
            ctx.strokeStyle = i % 2 === 0 ? pal.core : pal.c2;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.ellipse(tx + Math.sin(p * 14 + t * 4) * 10, ly, rx, 7 + t * 14, 0, rot, rot + Math.PI * 1.4);
            ctx.stroke();
          }
        });
        ctx.restore();
        break;
      }

      case 'moonlit_blossom_dance':
      case 'crimson_blossom_storm':
      case 'twin_taiji_swords': {
        // 【倾城飞花流绸舞 / 仁德双股剑太极旋】：飘逸双彩绫罗丝带螺旋飞舞 + 双剑/花刃环绕！
        ctx.save();
        ctx.translate(x, y - 44);
        ctx.globalCompositeOperation = 'lighter';
        for (let s = 0; s < 3; s++) {
          ctx.strokeStyle = s === 0 ? pal.core : (s === 1 ? pal.c2 : pal.c3);
          ctx.lineWidth = s === 0 ? 5 : 3;
          ctx.globalAlpha = alpha * 0.85;
          ctx.beginPath();
          for (let a = 0; a <= 36; a++) {
            const t = a / 36;
            const ang = t * Math.PI * 4 + p * 12 + (s * Math.PI * 2) / 3;
            const rad = 22 + t * 138;
            const px = Math.cos(ang) * rad;
            const py = Math.sin(ang) * rad * 0.44 - Math.sin(t * Math.PI) * 38;
            if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        if (prof.action === 'twin_taiji_swords') {
          for (let k = 0; k < 2; k++) {
            const a = p * 10 + k * Math.PI;
            ctx.save();
            ctx.translate(Math.cos(a) * 86, Math.sin(a) * 36);
            ctx.rotate(a + Math.PI / 2);
            drawOrnateSword(ctx, 64, pal);
            ctx.restore();
          }
        }
        ctx.restore();
        break;
      }

      case 'mountain_crag_hammer':
      case 'bronze_cauldron_quake': {
        // 【碎岳金瓜神锤 / 传国九鼎镇九州】：断岳挥动长柄金瓜重锤劈砸，震山降下双耳三足青铜巨鼎 + 熔岩裂地碎岩！
        const drop = Math.min(1, p * 3.4);
        const dropY = y - 12 - (1 - easeOutCubic(drop)) * 185;

        ctx.save();
        ctx.translate(x, dropY);
        ctx.globalAlpha = alpha;
        const hg = ctx.createLinearGradient(-34, -68, 34, 0);
        hg.addColorStop(0, pal.c3);
        hg.addColorStop(0.5, pal.c2);
        hg.addColorStop(1, pal.c1);
        ctx.fillStyle = hg;
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 2.4;

        if (prof.action === 'mountain_crag_hammer') {
          // 长柄八棱碎岳金瓜重锤
          ctx.strokeStyle = '#78350f'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(0, -168); ctx.stroke();
          ctx.strokeStyle = pal.core; ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(0, -38, 32, 36, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath(); ctx.moveTo(k * 13, -70); ctx.lineTo(k * 13, -6); ctx.stroke();
          }
        } else {
          // 双耳三足传国青铜神鼎
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(-36, -64, 72, 46, 12) : ctx.rect(-36, -64, 72, 46);
          ctx.fill(); ctx.stroke();
          // 双立耳 + 三鼎足
          ctx.strokeRect(-30, -80, 14, 16);
          ctx.strokeRect(16, -80, 14, 16);
          [-22, 0, 22].forEach((lx) => {
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(lx, -18); ctx.lineTo(lx * 1.15, 4); ctx.stroke();
          });
        }
        ctx.restore();

        // 大地龟裂熔岩纹 + 抛飞立体碎岩
        if (p >= 0.25) {
          const qp = (p - 0.25) / 0.75;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let f = 0; f < 6; f++) {
            const fa = (Math.PI * 2 * f) / 6 + 0.25;
            const flen = (95 + (f % 2) * 55) * easeOutCubic(qp);
            ctx.strokeStyle = pal.c2; ctx.lineWidth = 5 * (1 - qp * 0.5);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(fa) * flen * 0.5, y + Math.sin(fa) * flen * 0.22 - 5);
            ctx.lineTo(x + Math.cos(fa) * flen, y + Math.sin(fa) * flen * 0.42);
            ctx.stroke();
          }
          ctx.restore();

          for (let r = 0; r < 12; r++) {
            const vxR = (seeded(prof.seed, r) - 0.5) * 280;
            const vyR = -150 - seeded(prof.seed, r + 20) * 110;
            const rx = x + vxR * qp;
            const ry = y + vyR * qp + 240 * qp * qp;
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(qp * 8 + r);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#44403c';
            ctx.strokeStyle = pal.c3; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-8, -6); ctx.lineTo(6, -9); ctx.lineTo(10, 4); ctx.lineTo(-4, 8);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
          }
        }
        break;
      }

      case 'cavalry_phalanx_charge': {
        // 【西凉神威铁骑踏】：5骑金戈幻影楔形冲锋 + 马蹄烈焰星火 + 破空银枪寒芒！
        const cavSpr = App.Assets && (App.Assets.get('unit_gen_heavy') || App.Assets.get('unit_gen_silver'));
        const startX = (fx.casterX || (x - 210 * facing)) - 60 * facing;
        const travel = 520 * easeOutCubic(p) * facing;
        for (let c = 0; c < 5; c++) {
          const hx = startX + travel - Math.abs(c - 2) * 44 * facing;
          const hy = Math.max(195, Math.min(390, y + (c - 2) * 32));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const tg = ctx.createLinearGradient(hx, hy - 28, hx - 135 * facing, hy - 28);
          tg.addColorStop(0, pal.c2);
          tg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = tg;
          ctx.globalAlpha = alpha * 0.72;
          ctx.fillRect(facing > 0 ? hx - 135 : hx, hy - 52, 135, 42);
          // 冲锋枪尖破风锥
          ctx.fillStyle = pal.core;
          ctx.beginPath();
          ctx.moveTo(hx + 56 * facing, hy - 34);
          ctx.lineTo(hx + 10 * facing, hy - 44);
          ctx.lineTo(hx + 10 * facing, hy - 24);
          ctx.closePath();
          ctx.fill();
          if (cavSpr) {
            ctx.translate(hx, hy);
            ctx.scale(facing, 1);
            ctx.globalAlpha = alpha * 0.9;
            ctx.drawImage(cavSpr, -44, -82, 88, 88);
          }
          ctx.restore();
        }
        break;
      }

      case 'demon_seal_steles':
      case 'soul_reaper_chains':
      case 'twin_shadow_chakrams': {
        // 【八方镇魔金碑锁魂阵 / 夺魄日月轮】：8座雕花古篆镇魔石碑从天镇落 + 符文金索收拢绞杀！
        const cnt = 6 + (v % 3);
        const contract = p < 0.4 ? 1 : Math.max(0.35, 1 - (p - 0.4) * 1.1);
        const pts = [];
        for (let i = 0; i < cnt; i++) {
          const a = (Math.PI * 2 * i) / cnt + p * 1.2;
          pts.push({ px: x + Math.cos(a) * 145 * contract, py: y + Math.sin(a) * 58 * contract });
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.6;
        for (let i = 0; i < cnt; i++) {
          const pA = pts[i], pB = pts[(i + 2) % cnt];
          ctx.beginPath(); ctx.moveTo(pA.px, pA.py - 34); ctx.lineTo(pB.px, pB.py - 34); ctx.stroke();
        }
        ctx.restore();

        pts.forEach((pt, idx) => {
          const dropOff = p < 0.2 ? -(1 - p / 0.2) * 140 : 0;
          ctx.save();
          ctx.translate(pt.px, pt.py + dropOff);
          ctx.globalAlpha = alpha;
          if (prof.action === 'twin_shadow_chakrams') {
            ctx.rotate(p * 20 + idx);
            ctx.strokeStyle = pal.core; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, -28, 22, 0, Math.PI * 2); ctx.stroke();
            for (let b = 0; b < 6; b++) {
              const ba = (Math.PI * 2 * b) / 6;
              ctx.fillStyle = pal.c2;
              ctx.beginPath();
              ctx.moveTo(Math.cos(ba) * 22, -28 + Math.sin(ba) * 22);
              ctx.lineTo(Math.cos(ba + 0.3) * 32, -28 + Math.sin(ba + 0.3) * 32);
              ctx.lineTo(Math.cos(ba + 0.5) * 22, -28 + Math.sin(ba + 0.5) * 22);
              ctx.fill();
            }
          } else {
            ctx.fillStyle = pal.dark;
            ctx.strokeStyle = pal.c3; ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(-11, 0); ctx.lineTo(-9, -62); ctx.lineTo(0, -76); ctx.lineTo(9, -62); ctx.lineTo(11, 0);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = pal.core; ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(0, -56); ctx.lineTo(0, -14);
            ctx.moveTo(-5, -42); ctx.lineTo(5, -42);
            ctx.moveTo(-5, -26); ctx.lineTo(5, -26);
            ctx.stroke();
          }
          ctx.restore();
        });
        break;
      }

      case 'dimensional_rift_lances': {
        // 【裂空次元痕】：半空撕裂锯齿状发光空间裂缝 + 9道晶棱虚空光枪激射！
        ctx.save();
        ctx.translate(x, y - 68);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pal.dark;
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-110, -28); ctx.lineTo(-42, -8); ctx.lineTo(-12, -34);
        ctx.lineTo(38, 6); ctx.lineTo(112, -18);
        ctx.lineTo(44, 24); ctx.lineTo(-8, -6); ctx.lineTo(-48, 18);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        for (let i = 0; i < 9; i++) {
          const lp = Math.max(0, Math.min(1, (p - i * 0.04) * 2.4));
          const ang = -0.9 + i * 0.22 + (facing < 0 ? Math.PI : 0);
          const d = lp * 165;
          ctx.strokeStyle = i % 2 === 0 ? pal.c3 : pal.c2;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * d, Math.sin(ang) * d * 0.65 + 24);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      default: {
        // 【灭世日蚀奇点 / 裂空次元枪】：半空凝聚黑金日蚀法球 + 12道破界能量光矛放射轰击！
        const cyE = y - 58;
        const rad = p < 0.35 ? easeOutBack(p / 0.35) * 42 : 42 * (1 + (p - 0.35) * 0.4);
        ctx.save();
        ctx.translate(x, cyE);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 * i) / 12 + p * 1.6;
          const beamL = p > 0.25 ? easeOutCubic((p - 0.25) / 0.75) * 195 : 24;
          ctx.strokeStyle = i % 2 === 0 ? pal.core : pal.c2;
          ctx.lineWidth = i % 2 === 0 ? 5 : 2.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.lineTo(Math.cos(a) * beamL, Math.sin(a) * beamL * 0.68);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(x, cyE);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pal.dark;
        ctx.strokeStyle = pal.c3;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(0, 0, rad * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
    }

    // ★ 附加圣兽/神意副图腾层（盘龙腾飞 / 朱雀翔空 / 白虎怒爪 / 八卦天光）
    if (prof.extra === 'coiling_dragon') {
      drawCoilingDragon(ctx, x, y - 54, 0.92, p, facing, pal);
    } else if (prof.extra === 'phoenix_glide') {
      const px = (x - 160 * facing) + easeOutCubic(p) * 320 * facing;
      drawSoaringPhoenix(ctx, px, y - 92 - Math.sin(p * Math.PI) * 28, 0.95, p, facing, pal);
    } else if (prof.extra === 'tiger_roar') {
      drawTigerClawSpirit(ctx, x, y, p, facing, pal);
    } else if (prof.extra === 'bagua_beam') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.55;
      const bg = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.5, pal.c3);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(x - 36, 36, 72, y - 36);
      ctx.restore();
    }

    ctx.restore();
  }

  // ================= 14 种末字终结收势华彩层 =================

  function drawSuffixFinisher(ctx, suffix, x, y, vx, vw, isFull, p, alpha, pal) {
    if (p < 0.30) return;
    const fp = (p - 0.30) / 0.70; // 0 -> 1
    const cx = isFull ? vx + vw / 2 : x;
    const cy = y - 32;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * Math.max(0, 1 - fp * 0.85);

    if (suffix === '印') {
      // 从天盖落巨型鎏金玉玺方印纹
      const sc = 0.65 + easeOutBack(Math.min(1, fp * 2.2)) * 0.55;
      ctx.translate(cx, cy + 28);
      ctx.scale(sc, sc * 0.45);
      ctx.strokeStyle = pal.c3; ctx.lineWidth = 4;
      ctx.strokeRect(-95, -95, 190, 190);
      ctx.strokeRect(-78, -78, 156, 156);
    } else if (suffix === '斩' || suffix === '闪' || suffix === '杀') {
      // 横贯视野的一闪次元白金刀线！
      const wLine = (1 - fp) * (suffix === '闪' ? 14 : 9);
      if (wLine > 0.5) {
        ctx.translate(cx, cy);
        ctx.rotate(suffix === '杀' ? -0.28 : -0.12);
        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.moveTo(-260, 0); ctx.quadraticCurveTo(0, -wLine, 260, 0); ctx.quadraticCurveTo(0, wLine, -260, 0);
        ctx.fill();
      }
    } else if (suffix === '啸' || suffix === '爆' || suffix === '击' || suffix === '破') {
      // 多重立体冲击气浪穹顶环
      for (let r = 0; r < 3; r++) {
        const rp = Math.max(0, fp - r * 0.14);
        if (rp <= 0 || rp >= 1) continue;
        ctx.strokeStyle = r === 0 ? pal.core : pal.c2;
        ctx.lineWidth = (4.5 - r) * (1 - rp);
        ctx.beginPath();
        ctx.ellipse(cx, y, 40 + rp * 195, 16 + rp * 68, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (suffix === '诀' || suffix === '罚' || suffix === '劫') {
      // 冲天敕令金柱与环绕篆符光点
      const colW = 54 * (1 - fp);
      const lg = ctx.createLinearGradient(cx - colW, 0, cx + colW, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0)');
      lg.addColorStop(0.5, pal.core);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(cx - colW, 38, colW * 2, y - 34);
    }
    ctx.restore();
  }

  // ================= 8 种精致具象微粒子层（花瓣/冰晶/金翎/灵符/星芒/火烬/竹叶/灵珠） =================

  function drawMicroParticles(ctx, prof, x, y, vx, vw, isFull, p, alpha) {
    const pal = prof.pal;
    const pType = prof.pType || 'star';
    const count = isFull ? 44 : 28;
    const span = isFull ? vw - 80 : 280;
    const baseLeft = isFull ? vx + 40 : x - 140;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < count; i++) {
      const r1 = seeded(prof.seed, i * 3 + 1);
      const r2 = seeded(prof.seed, i * 3 + 2);
      const r3 = seeded(prof.seed, i * 3 + 3);
      const px = baseLeft + r1 * span + Math.sin(p * 6 + i) * 26;
      const startY = y + 12 - r2 * 145;
      const py = pType === 'petal' || pType === 'leaf' || pType === 'crystal'
        ? startY + p * 65 - 35
        : startY - p * (85 + r3 * 75);
      const sz = 3.5 + r3 * 4.5;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p * 7 * (r1 > 0.5 ? 1 : -1) + i);
      ctx.globalAlpha = alpha * (0.45 + 0.5 * Math.sin(p * Math.PI));
      ctx.fillStyle = i % 2 === 0 ? pal.core : pal.c3;
      ctx.strokeStyle = pal.c2;

      if (pType === 'petal') {
        // 桃红/落英五瓣花瓣翻转飘落
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p * 9 + i)));
        ctx.fillStyle = i % 3 === 0 ? '#fda4af' : pal.c3;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.4);
        ctx.quadraticCurveTo(sz * 1.2, -sz * 0.3, 0, sz * 1.4);
        ctx.quadraticCurveTo(-sz * 1.2, -sz * 0.3, 0, -sz * 1.4);
        ctx.fill();
      } else if (pType === 'crystal') {
        // 菱形折射冰晶雪片
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.6); ctx.lineTo(sz, 0); ctx.lineTo(0, sz * 1.6); ctx.lineTo(-sz, 0);
        ctx.closePath(); ctx.fill();
      } else if (pType === 'feather') {
        // 鎏金神翎细羽
        ctx.beginPath();
        ctx.moveTo(-sz * 1.8, 0);
        ctx.quadraticCurveTo(0, -sz * 0.8, sz * 1.8, 0);
        ctx.quadraticCurveTo(0, sz * 0.5, -sz * 1.8, 0);
        ctx.fill();
      } else if (pType === 'talisman') {
        // 微缩飘浮天师灵符
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-sz * 0.65, -sz * 1.3, sz * 1.3, sz * 2.6);
      } else if (pType === 'leaf') {
        // 青锋竹叶
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.moveTo(-sz * 1.7, 0); ctx.quadraticCurveTo(0, -sz * 0.7, sz * 1.7, 0); ctx.quadraticCurveTo(0, sz * 0.7, -sz * 1.7, 0);
        ctx.fill();
      } else {
        // 四芒寒星璀璨光点
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.7); ctx.lineTo(sz * 0.38, -sz * 0.38);
        ctx.lineTo(sz * 1.7, 0); ctx.lineTo(sz * 0.38, sz * 0.38);
        ctx.lineTo(0, sz * 1.7); ctx.lineTo(-sz * 0.38, sz * 0.38);
        ctx.lineTo(-sz * 1.7, 0); ctx.lineTo(-sz * 0.38, -sz * 0.38);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ================= 招式水墨金卷书法铭牌 =================

  function drawSkillCalligraphy(ctx, fx, prof, vx, vw, p) {
    if (!fx.skillName || p > 0.82) return;
    const pal = prof.pal;
    const a = p < 0.14 ? p / 0.14 : Math.max(0, 1 - (p - 0.50) / 0.32);
    const tx = fx.isFullscreen ? (vx + vw / 2) : fx.x;
    const ty = fx.isFullscreen ? (148 - p * 14) : Math.max(88, fx.y - 126 - p * 18);

    ctx.save();
    ctx.globalAlpha = Math.min(1, a);

    // 水墨鎏金底衬横卷条
    const label = fx.casterName ? `${fx.casterName} · ${fx.skillName}` : `${fx.skillName}`;
    const boxW = Math.max(156, label.length * 19 + 46);
    const bg = ctx.createLinearGradient(tx - boxW / 2, ty, tx + boxW / 2, ty);
    bg.addColorStop(0, 'rgba(15, 8, 4, 0)');
    bg.addColorStop(0.2, 'rgba(20, 10, 5, 0.84)');
    bg.addColorStop(0.8, 'rgba(20, 10, 5, 0.84)');
    bg.addColorStop(1, 'rgba(15, 8, 4, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(tx - boxW / 2, ty - 19, boxW, 30);

    ctx.strokeStyle = pal.c3;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx - boxW * 0.38, ty - 19); ctx.lineTo(tx + boxW * 0.38, ty - 19);
    ctx.moveTo(tx - boxW * 0.38, ty + 11); ctx.lineTo(tx + boxW * 0.38, ty + 11);
    ctx.stroke();

    // 朱砂小篆红印【绝】
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(tx - boxW * 0.36, ty - 13, 16, 16);
    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 10px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('绝', tx - boxW * 0.36 + 8, ty - 1);

    // 招式鎏金书法大字
    ctx.font = `bold ${fx.isFullscreen ? 20 : 17}px "STKaiti", "KaiTi", "PingFang SC", serif`;
    ctx.strokeStyle = '#090402';
    ctx.lineWidth = 4.5;
    ctx.strokeText(`【${label}】`, tx + 8, ty + 2);
    ctx.fillStyle = pal.c3;
    ctx.fillText(`【${label}】`, tx + 8, ty + 2);
    ctx.restore();
  }

  // ================= 统一入口：五层国风高精度绝技渲染器 =================

  function render(ctx, fx, viewX, viewW) {
    const p = Math.max(0, Math.min(1, 1 - fx.life / fx.maxLife));
    const burst = p < 0.09 ? (p / 0.09) : 1;
    const fade = p < 0.68 ? 1 : Math.max(0, 1 - (p - 0.68) / 0.32);
    const alpha = Math.max(0, burst * fade);
    if (alpha <= 0.005) return;

    const facing = fx.facing || 1;
    const vx = typeof viewX === 'number' ? viewX : Math.max(0, fx.x - 480);
    const vw = viewW || 960;
    const prof = fx._cachedProfile || (fx._cachedProfile = resolveSkillProfile(fx));
    const pal = prof.pal;

    ctx.save();

    // 第 0 层：电影级大招压暗聚焦氛围幕（让流光刀气与粒子在黄沙草地上清晰夺目！）
    const dimAlpha = (fx.isFullscreen ? 0.24 : 0.13) * Math.sin(p * Math.PI);
    if (dimAlpha > 0.01) {
      ctx.fillStyle = `rgba(10, 6, 4, ${dimAlpha.toFixed(3)})`;
      ctx.fillRect(vx, 42, vw, 378);
    }

    // 第 1 层：地表透视双层反向旋转古法阵（256px 抗锯齿离屏预烘焙）
    const sealCvs = getSealCanvas(prof.sealId, pal.c1, pal.c2, pal.c3);
    if (sealCvs) {
      const sealScale = easeOutBack(Math.min(1, p * 3.2)) * (fx.isFullscreen ? 1.85 : 1.32);
      const sx = fx.isFullscreen ? (vx + vw / 2) : fx.x;
      const sy = fx.y + 6;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(sealScale, sealScale * 0.38);
      ctx.globalCompositeOperation = 'lighter';
      // 外阵顺时针旋转
      ctx.save();
      ctx.rotate(p * 2.4);
      ctx.globalAlpha = alpha * 0.88;
      ctx.drawImage(sealCvs, -128, -128, 256, 256);
      ctx.restore();
      // 内阵逆时针叠旋
      ctx.save();
      ctx.scale(0.62, 0.62);
      ctx.rotate(-p * 3.8);
      ctx.globalAlpha = alpha * 0.62;
      ctx.drawImage(sealCvs, -128, -128, 256, 256);
      ctx.restore();
      ctx.restore();
    }

    // 第 2 层：天幕星宿/明月/雷云/敕令异象层
    drawSkyPhenomenon(ctx, prof.skyId, vx, vw, fx.isFullscreen ? vx + vw / 2 : fx.x, fx.y, p, alpha, pal);

    // 第 3 层：高精细神兵/圣兽/元素主招式动作层
    drawMainAction(ctx, prof, fx, vx, vw, p, alpha, facing);

    // 第 4 层：末字专属终结收势爆发层
    drawSuffixFinisher(ctx, prof.suffix, fx.x, fx.y, vx, vw, !!fx.isFullscreen, p, alpha, pal);

    // 第 5 层：具象国风微粒子飘舞层 + 水墨书法招式铭牌
    drawMicroParticles(ctx, prof, fx.x, fx.y, vx, vw, !!fx.isFullscreen, p, alpha);
    drawSkillCalligraphy(ctx, fx, prof, vx, vw, p);

    ctx.restore();
  }

  App.SkillVFX = {
    render,
    resolveSkillProfile,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
