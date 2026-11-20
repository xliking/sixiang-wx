(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const MUTE_STORAGE_KEY = 'sixiang_audio_muted_v1';

  let actx = null;
  let masterGain = null;
  let bgmGain = null;
  let sfxGain = null;
  let echoIn = null;
  let noiseBuf = null;

  let muted = false;
  let unlocked = false;
  let currentTheme = 'map';
  let bgmPausedForResult = false;
  let stepIndex = 0;
  let nextNoteTime = 0;
  // 记录各场景曲目播放进度：从商城/名将营返回首页大地图时无缝续播长卷，不会每次重头只听前几秒！
  const themeStepMemory = {};

  // 防刷屏节流表（毫秒），保证千军混战时音效层次清晰不爆音
  const sfxLastTime = {};
  const SFX_THROTTLE_MS = {
    click: 45,
    bow_shoot: 95,
    fan_cast: 110,
    sword_hit: 85,
    spear_thrust: 90,
    wheel_tick: 32,
    coin: 80,
    upgrade: 120,
    disaster: 600,
  };

  // 半音转频率 (MIDI 69 = A4 = 440Hz)
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // 音符记谱说明：正整数 = 触发该 MIDI 音高；-1 = 延续上一音符长音（气息连绵）；0 = 换气留白
  // ★ 1. 首页九州大地图超长国风交响长卷：《九州山河万里图》（256步 ≈ 96秒完整四章起承转合，绝不短促单调！）
  // 调式：D宫五声雅乐（D=62, E=64, F#=66, A=69, B=71 | 高八度 D=74, E=76, F#=78, A=81, B=83, D6=86）
  const MAP_LEAD_256 = [
    // 【第一章 · 起：晨钟远岫 · 洞箫初吟】(Steps 0..63, ~24秒)
    69, -1, -1, 71, 74, -1, -1, 0,   76, -1, 78, 76, 74, -1, 71, 0,
    69, -1, 66, 69, 71, -1, -1, 0,   69, -1, 66, 64, 62, -1, -1, 0,
    66, -1, 69, 71, 74, -1, 76, 0,   78, -1, 81, 78, 76, -1, -1, 0,
    74, -1, 76, 74, 71, -1, 69, 66,  69, -1, -1, -1, -1, 0,  0,  0,

    // 【第二章 · 承：锦绣山河 · 筝笛和鸣】(Steps 64..127, ~24秒)
    74, -1, 76, 78, 81, -1, 78, 76,  74, -1, 71, 74, 76, -1, -1, 0,
    78, -1, 81, 83, 86, -1, 83, 81,  78, -1, 76, 74, 71, -1, -1, 0,
    69, 71, 74, 76, 78, -1, 76, 74,  71, 74, 76, 78, 81, -1, -1, 0,
    83, -1, 81, 78, 76, 74, 71, 69,  74, -1, -1, -1, -1, 0,  0,  0,

    // 【第三章 · 转：风云际会 · 群雄逐鹿】(Steps 128..191, ~24秒)
    81, -1, -1, 83, 86, -1, 83, 81,  78, -1, 81, 78, 76, -1, 74, 0,
    76, -1, 78, 81, 83, -1, -1, 81,  78, -1, 76, 74, 76, -1, -1, 0,
    81, -1, 78, 76, 74, -1, 76, 78,  81, -1, 83, 86, 83, -1, 81, 0,
    78, -1, 76, 74, 71, -1, 74, 76,  69, -1, -1, -1, -1, 0,  0,  0,

    // 【第四章 · 合：四象归心 · 万古长歌】(Steps 192..255, ~24秒)
    74, -1, 71, 69, 66, -1, 69, 71,  74, -1, 78, 76, 74, -1, -1, 0,
    81, -1, 78, 74, 71, -1, 69, 66,  64, -1, 66, 69, 71, -1, -1, 0,
    74, 76, 78, 81, 78, 76, 74, 71,  69, -1, 71, 74, 69, -1, 66, 0,
    64, -1, 66, 69, 62, -1, -1, -1,  62, -1, -1, -1, 0,  0,  0,  0,
  ];

  const MAP_ARP_256 = [
    // 第一章：古筝流水分解（D -> Bm -> G -> A）
    62, 66, 69, 74, 69, 66, 62, 66,  59, 62, 66, 71, 66, 62, 59, 62,
    55, 59, 62, 67, 62, 59, 55, 59,  57, 61, 64, 69, 64, 61, 57, 64,
    54, 57, 62, 66, 69, 66, 62, 57,  59, 62, 66, 71, 74, 71, 66, 62,
    55, 59, 62, 66, 69, 66, 62, 59,  57, 62, 64, 69, 74, 69, 64, 62,

    // 第二章：双八度灵动轮指琶音（D -> F#m -> Bm -> G -> A -> D）
    62, 69, 74, 78, 74, 69, 66, 69,  66, 69, 73, 78, 73, 69, 66, 69,
    59, 66, 71, 74, 71, 66, 62, 66,  55, 62, 67, 71, 67, 62, 59, 62,
    62, 66, 69, 74, 78, 74, 69, 66,  59, 62, 66, 71, 74, 71, 66, 62,
    55, 59, 62, 67, 57, 61, 64, 69,  62, 66, 69, 74, 78, 74, 69, 66,

    // 第三章：群雄逐鹿叙事律动（Bm -> G -> D -> A -> Em -> F#m -> G -> A）
    59, 66, 71, 66, 59, 66, 74, 66,  55, 62, 67, 62, 55, 62, 71, 62,
    62, 69, 74, 69, 62, 69, 78, 69,  57, 64, 69, 64, 57, 64, 73, 64,
    52, 59, 64, 67, 64, 59, 52, 59,  54, 61, 66, 69, 66, 61, 54, 61,
    55, 62, 67, 71, 67, 62, 55, 62,  57, 64, 69, 74, 73, 69, 64, 57,

    // 第四章：山河归心舒缓长琶音（D -> G -> Em -> A -> Bm -> G -> A -> D）
    62, 66, 69, 74, 69, 66, 64, 62,  55, 59, 62, 69, 66, 62, 59, 55,
    52, 57, 59, 64, 66, 64, 59, 57,  57, 62, 64, 69, 71, 69, 64, 62,
    59, 62, 66, 71, 74, 71, 66, 62,  55, 59, 62, 67, 71, 67, 62, 59,
    57, 61, 64, 69, 62, 66, 69, 74,  62, 0,  69, 0,  74, 0,  66, 0,
  ];

  // 温暖丝弦/古琴低音铺底（每8步=1小节换和弦根音，让背景音乐浑厚连绵不断档）
  const MAP_PAD_32 = [
    50, 59, 55, 57, 54, 59, 55, 57,
    50, 54, 59, 55, 50, 59, 55, 50,
    59, 55, 50, 57, 52, 54, 55, 57,
    50, 55, 52, 57, 59, 55, 57, 50,
  ];

  // ★ 7 首独立原创国风长编曲谱（首页 256 步超长四章交响，其余 6 大场景全部扩充为 64 步四段式完整乐曲！）
  const BGM_THEMES = {
    // 1. 首页九州大地图（256 步 ≈ 96 秒完整四章长曲 + 丝弦铺底 + 古筝刮奏 + 洞箫竹笛琵琶轮奏）
    map: {
      bpm: 80,
      leadVoicesBySection: ['flute', 'guzheng', 'flute', 'flute'],
      arpVoicesBySection: ['guzheng', 'guzheng', 'pipa', 'guzheng'],
      lead: MAP_LEAD_256,
      arp: MAP_ARP_256,
      padEvery8: MAP_PAD_32,
      glissSteps: { 0: 62, 64: 62, 128: 66, 192: 62, 240: 62 },
      chimeMap: {
        0: 86, 16: 81, 32: 86, 48: 88,
        64: 86, 80: 90, 96: 86, 112: 81,
        128: 88, 144: 86, 160: 90, 176: 81,
        192: 86, 208: 83, 224: 81, 248: 86,
      },
      hornMap: {
        128: 59, 144: 55, 160: 62, 176: 57,
      },
      drumBySection: [
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 1, 0, 0],
        [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 0],
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      ],
      drumSoft: true,
    },

    // 2. 城池开战对局：A羽古战曲（64步四段式激昂战歌 142 BPM）
    battle: {
      bpm: 142,
      leadVoice: 'pipa',
      arpVoice: 'pipa',
      lead: [
        69, 69, 72, 74, 76, -1, 79, 76,  74, 72, 69, 72, 74, -1, 69, 0,
        76, 76, 79, 81, 84, -1, 81, 79,  76, 74, 72, 74, 76, -1, -1, 0,
        81, -1, 79, 76, 74, 76, 79, 76,  72, -1, 74, 76, 69, -1, 67, 0,
        69, 72, 74, 76, 79, 81, 79, 76,  74, 76, 72, 69, 69, -1, -1, 0,
      ],
      arp: [
        57, 64, 57, 64, 60, 67, 60, 67,  62, 69, 62, 69, 55, 62, 57, 64,
        57, 64, 69, 64, 60, 67, 72, 67,  62, 69, 74, 69, 64, 71, 76, 71,
        53, 60, 65, 60, 55, 62, 67, 62,  57, 64, 69, 64, 52, 59, 64, 59,
        57, 64, 69, 64, 55, 62, 67, 62,  53, 60, 55, 62, 57, 64, 69, 57,
      ],
      horn: [57, 0, 0, 0, 0, 0, 0, 0, 62, 0, 0, 0, 55, 0, 0, 0],
      drum: [3, 0, 1, 2, 3, 0, 2, 1, 3, 1, 2, 0, 3, 2, 3, 1],
    },

    // 3. 四象神兽副本/秘境BOSS战：E角太古神威（64步史诗四段 136 BPM）
    beast: {
      bpm: 136,
      leadVoice: 'pipa',
      arpVoice: 'guzheng',
      lead: [
        64, -1, 67, 71, 72, 71, 67, 64,  69, -1, 71, 74, 76, -1, 71, 0,
        76, -1, 79, 83, 84, 83, 79, 76,  74, -1, 76, 79, 71, -1, -1, 0,
        72, -1, 76, 79, 81, -1, 79, 76,  74, -1, 71, 67, 69, -1, -1, 0,
        64, 67, 71, 74, 76, 79, 76, 74,  71, 69, 67, 64, 64, -1, -1, 0,
      ],
      arp: [
        52, 59, 64, 59, 52, 59, 64, 59,  55, 62, 67, 62, 57, 64, 59, 64,
        52, 59, 67, 59, 55, 62, 71, 62,  57, 64, 72, 64, 59, 66, 71, 66,
        53, 60, 65, 60, 57, 64, 69, 64,  55, 62, 67, 62, 52, 59, 64, 59,
        52, 59, 64, 67, 55, 62, 67, 71,  57, 64, 55, 62, 52, 59, 64, 52,
      ],
      chime: [76, 0, 0, 0, 79, 0, 0, 0, 81, 0, 0, 0, 83, 0, 0, 0],
      horn: [52, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0],
      drum: [3, 2, 0, 2, 3, 0, 2, 2, 3, 2, 1, 2, 3, 3, 2, 1],
    },

    // 4. 演武场PK：G徵群雄争锋（64步竞技昂扬战曲 138 BPM）
    arena: {
      bpm: 138,
      leadVoice: 'pipa',
      arpVoice: 'guzheng',
      lead: [
        67, 69, 71, 74, 76, 74, 71, 69,  74, -1, 79, 76, 74, 71, 67, 0,
        74, 76, 79, 81, 83, 81, 79, 76,  81, -1, 79, 76, 74, -1, -1, 0,
        76, -1, 74, 71, 69, 71, 74, 76,  79, -1, 76, 74, 71, -1, 69, 0,
        67, 71, 74, 79, 81, 79, 76, 74,  71, 74, 69, 67, 67, -1, -1, 0,
      ],
      arp: [
        55, 62, 67, 62, 57, 64, 69, 64,  59, 66, 71, 66, 55, 62, 67, 62,
        55, 62, 71, 62, 60, 67, 72, 67,  62, 69, 74, 69, 55, 62, 67, 62,
        52, 59, 64, 59, 57, 64, 69, 64,  60, 67, 72, 67, 59, 66, 71, 66,
        55, 62, 67, 71, 60, 67, 62, 69,  55, 62, 57, 62, 55, 62, 67, 55,
      ],
      drum: [3, 0, 2, 0, 3, 1, 2, 0, 3, 0, 2, 1, 3, 2, 1, 2],
    },

    // 5. 天命轮盘抽奖：C宫吉庆欢歌（64步欢快流光 120 BPM）
    wheel: {
      bpm: 120,
      leadVoice: 'guzheng',
      arpVoice: 'guzheng',
      lead: [
        72, 74, 76, 79, 81, 79, 76, 0,   79, 81, 84, 81, 79, 76, 74, 72,
        76, 79, 81, 84, 86, 84, 81, 79,  84, -1, 81, 79, 76, -1, -1, 0,
        81, -1, 79, 76, 74, 76, 79, 81,  76, -1, 74, 72, 69, 72, 74, 0,
        72, 76, 79, 84, 81, 79, 76, 74,  79, 76, 74, 72, 72, -1, -1, 0,
      ],
      arp: [
        60, 67, 72, 67, 65, 69, 72, 69,  67, 71, 74, 71, 60, 64, 67, 72,
        60, 64, 67, 72, 62, 67, 71, 74,  64, 67, 72, 76, 60, 64, 67, 72,
        65, 69, 72, 77, 67, 71, 74, 79,  64, 67, 72, 67, 57, 60, 64, 69,
        60, 64, 67, 72, 65, 69, 67, 71,  60, 67, 64, 67, 60, 67, 72, 60,
      ],
      chime: [84, 0, 0, 0, 88, 0, 0, 0, 91, 0, 0, 0, 84, 0, 0, 0],
      drum: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 2, 0],
      drumSoft: true,
    },

    // 6. 名将营 / 四象兽栏 / 仓库 / 邮件：F宫古琴洞箫雅曲（64步温润悠长 74 BPM）
    camp: {
      bpm: 74,
      leadVoice: 'flute',
      arpVoice: 'guzheng',
      lead: [
        69, -1, 72, -1, 74, 72, 69, 0,   65, -1, 67, 69, 65, -1, -1, 0,
        72, -1, 74, 77, 79, -1, 77, 74,  72, -1, 69, 67, 69, -1, -1, 0,
        77, -1, 74, 72, 69, -1, 72, 74,  67, -1, 69, 72, 65, -1, -1, 0,
        69, -1, 72, 74, 72, 69, 67, 65,  69, -1, 67, 65, 65, -1, -1, 0,
      ],
      arp: [
        53, 57, 60, 65, 50, 57, 62, 65,  53, 57, 60, 69, 48, 55, 60, 65,
        53, 60, 65, 69, 55, 60, 65, 67,  57, 60, 64, 69, 50, 57, 62, 65,
        58, 62, 65, 69, 53, 57, 60, 65,  55, 60, 64, 67, 48, 55, 60, 64,
        53, 57, 60, 65, 58, 62, 55, 60,  53, 57, 60, 65, 53, 0,  60, 0,
      ],
      padEvery8: [53, 50, 53, 48, 53, 55, 57, 50],
      chime: [77, 0, 0, 0, 0, 0, 0, 0, 81, 0, 0, 0, 0, 0, 0, 0],
      drum: [],
    },

    // 7. 铜钱商城 / 福利活动：A宫江南集市丝竹长调（64步轻快愉悦 104 BPM）
    shop: {
      bpm: 104,
      leadVoice: 'guzheng',
      arpVoice: 'pipa',
      lead: [
        69, 71, 73, 76, 78, 76, 73, 0,   76, 73, 71, 69, 71, 73, 69, 0,
        73, 76, 78, 81, 83, 81, 78, 76,  81, -1, 78, 76, 73, -1, -1, 0,
        78, -1, 76, 73, 71, 73, 76, 78,  73, -1, 71, 69, 66, 69, 71, 0,
        69, 73, 76, 81, 78, 76, 73, 71,  73, 71, 69, 66, 69, -1, -1, 0,
      ],
      arp: [
        57, 64, 69, 64, 62, 66, 69, 66,  64, 68, 71, 68, 57, 61, 64, 69,
        57, 61, 64, 69, 59, 64, 68, 71,  61, 64, 69, 73, 57, 61, 64, 69,
        62, 66, 69, 74, 64, 68, 71, 76,  61, 64, 69, 64, 54, 57, 61, 66,
        57, 61, 64, 69, 62, 66, 64, 68,  57, 64, 61, 64, 57, 64, 69, 57,
      ],
      chime: [81, 0, 0, 0, 0, 0, 0, 0, 85, 0, 0, 0, 0, 0, 0, 0],
      drum: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      drumSoft: true,
    },
  };

  function init() {
    if (App.Platform && App.Platform.loadStorage) {
      const saved = App.Platform.loadStorage(MUTE_STORAGE_KEY);
      if (saved && typeof saved.muted === 'boolean') muted = saved.muted;
    }
    // 监听任意首次触摸/点击/按键自动唤醒音频引擎，确保进入首页即可流畅长播背景音乐
    if (typeof document !== 'undefined' && document.addEventListener) {
      const autoUnlock = () => unlock();
      ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((ev) => {
        document.addEventListener(ev, autoUnlock, { passive: true });
      });
    }
  }

  function ensureContext() {
    if (actx) return actx;
    const Ctx =
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
      (typeof wx !== 'undefined' && wx.createWebAudioContext ? wx.createWebAudioContext : null);
    if (!Ctx) return null;

    try {
      actx = new Ctx();
      masterGain = actx.createGain();
      masterGain.gain.value = muted ? 0 : 0.78;

      // 动态防爆音压缩器
      let outNode = actx.destination;
      if (actx.createDynamicsCompressor) {
        const comp = actx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.005;
        comp.release.value = 0.18;
        comp.connect(actx.destination);
        outNode = comp;
      }
      masterGain.connect(outNode);

      bgmGain = actx.createGain();
      bgmGain.gain.value = 0.48;
      bgmGain.connect(masterGain);

      sfxGain = actx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(masterGain);

      // 温润古殿长混响回声总线（让洞箫/古筝/编钟自带悠远山水余韵）
      if (actx.createDelay && actx.createBiquadFilter) {
        echoIn = actx.createGain();
        echoIn.gain.value = 0.32;
        const delay = actx.createDelay(1.0);
        delay.delayTime.value = 0.27;
        const fb = actx.createGain();
        fb.gain.value = 0.30;
        const lp = actx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2100;

        echoIn.connect(delay);
        delay.connect(lp);
        lp.connect(bgmGain);
        lp.connect(fb);
        fb.connect(delay);
      }

      // 预生成 0.5 秒白噪声缓冲（供拨弦指甲擦弦、羽箭破空、羽扇灵风、战鼓皮革声复用）
      const sr = actx.sampleRate || 44100;
      const len = Math.floor(sr * 0.5);
      noiseBuf = actx.createBuffer(1, len, sr);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      nextNoteTime = actx.currentTime + 0.06;
      if (actx.state === 'running') unlocked = true;
    } catch (e) {
      actx = null;
    }
    return actx;
  }

  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      ctx.resume();
    }
    if (!unlocked) {
      unlocked = true;
      nextNoteTime = ctx.currentTime + 0.05;
    }
  }

  function isMuted() {
    return muted;
  }

  function toggleMute() {
    muted = !muted;
    if (App.Platform && App.Platform.saveStorage) {
      App.Platform.saveStorage(MUTE_STORAGE_KEY, { muted });
    }
    const ctx = ensureContext();
    if (ctx && masterGain) {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.78, now, 0.04);
      if (!muted) {
        unlock();
        nextNoteTime = Math.max(nextNoteTime, now + 0.05);
      }
    }
    return muted;
  }

  // ================= 国风古乐器物理合成发声单元 =================

  // 1. 古筝拨弦（指甲触弦瞬态 + 基频微滑音 + 泛音自然长衰减）
  function voiceGuzheng(freq, t, dur, vol, dest) {
    if (!actx) return;
    const out = dest || bgmGain;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.28), t + dur * 0.48);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    if (echoIn && out === bgmGain) g.connect(echoIn);

    const o1 = actx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(freq * 1.007, t);
    o1.frequency.exponentialRampToValueAtTime(freq, t + 0.035);
    o1.connect(g);
    o1.start(t);
    o1.stop(t + dur + 0.02);

    const o2 = actx.createOscillator();
    const g2 = actx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * 2, t);
    g2.gain.setValueAtTime(vol * 0.34, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.45);
    o2.connect(g2);
    g2.connect(out);
    o2.start(t);
    o2.stop(t + dur * 0.48);

    // 拨弦瞬态
    if (noiseBuf && actx.createBiquadFilter) {
      const ns = actx.createBufferSource();
      ns.buffer = noiseBuf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(4200, freq * 3.5);
      const ng = actx.createGain();
      ng.gain.setValueAtTime(vol * 0.25, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
      ns.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      ns.start(t);
      ns.stop(t + 0.025);
    }
  }

  // 1b. 古筝五声流水刮奏（乐章衔接处的国风灵魂华彩）
  function voiceGuzhengGliss(baseMidi, t, vol) {
    if (!actx) return;
    const offsets = [0, 2, 4, 7, 9, 12, 14, 16];
    offsets.forEach((semi, i) => {
      voiceGuzheng(midiToFreq(baseMidi + semi), t + i * 0.055, 1.35, vol * (0.72 + i * 0.035));
    });
  }

  // 2. 琵琶脆弹（木腔共鸣 + 清脆扫弦包络）
  function voicePipa(freq, t, dur, vol, dest) {
    if (!actx) return;
    const out = dest || bgmGain;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.52, dur));
    g.connect(out);
    if (echoIn && out === bgmGain) g.connect(echoIn);

    const osc = actx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 1.01, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.02);

    if (actx.createBiquadFilter) {
      const lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(4800, freq * 5.2), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 1.5), t + 0.18);
      osc.connect(lp);
      lp.connect(g);
    } else {
      osc.connect(g);
    }
    osc.start(t);
    osc.stop(t + Math.min(0.55, dur + 0.02));
  }

  // 3. 竹笛 / 洞箫（柔缓气音起振 + 渐进式腹式颤音，长音连绵悠扬）
  function voiceFlute(freq, t, dur, vol) {
    if (!actx) return;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.16, dur * 0.25));
    g.gain.setValueAtTime(vol * 0.88, t + dur * 0.76);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bgmGain);
    if (echoIn) g.connect(echoIn);

    const osc = actx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.996, t);
    osc.frequency.linearRampToValueAtTime(freq, t + Math.min(0.08, dur * 0.2));

    const osc2 = actx.createOscillator();
    const g2 = actx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, t);
    g2.gain.value = 0.13;
    osc2.connect(g2);
    g2.connect(g);

    // 自然腹式颤音（长音越往后颤音越温润）
    const lfo = actx.createOscillator();
    const lfoGain = actx.createGain();
    lfo.frequency.value = 5.0;
    lfoGain.gain.setValueAtTime(freq * 0.002, t);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.009, t + Math.min(0.45, dur * 0.6));
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(g);
    osc.start(t);
    osc2.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.04);
    osc2.stop(t + dur + 0.04);
    lfo.stop(t + dur + 0.04);
  }

  // 3b. 丝弦合奏长音铺底（古琴/低音胡琴温润和声垫底，消除断奏空隙感）
  function voiceSilkPad(freq, t, dur, vol) {
    if (!actx) return;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.55, dur * 0.30));
    g.gain.setValueAtTime(vol * 0.82, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let target = g;
    if (actx.createBiquadFilter) {
      const lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 540;
      lp.connect(g);
      target = lp;
    }
    g.connect(bgmGain);
    if (echoIn) g.connect(echoIn);

    [1, 1.5].forEach((mult, idx) => {
      const o = actx.createOscillator();
      const subG = actx.createGain();
      o.type = idx === 0 ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(freq * mult, t);
      if (o.detune) o.detune.value = idx === 0 ? -4 : 4;
      subG.gain.value = idx === 0 ? 0.75 : 0.35;
      o.connect(subG);
      subG.connect(target);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  // 4. 青铜编钟 / 玉磬（双泛音金石清响）
  function voiceChime(freq, t, dur, vol, dest) {
    if (!actx) return;
    const out = dest || bgmGain;
    const partials = [1, 2.0, 2.76];
    const weights = [1.0, 0.42, 0.22];
    partials.forEach((mult, idx) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mult, t);
      const d = dur / (1 + idx * 0.65);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * weights[idx], t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(out);
      if (echoIn && out === bgmGain && idx === 0) g.connect(echoIn);
      o.start(t);
      o.stop(t + d + 0.02);
    });
  }

  // 5. 苍凉战角号
  function voiceWarHorn(freq, t, dur, vol, dest) {
    if (!actx) return;
    const out = dest || bgmGain;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.18);
    g.gain.setValueAtTime(vol * 0.85, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lp = actx.createBiquadFilter ? actx.createBiquadFilter() : null;
    if (lp) {
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, t);
      lp.frequency.linearRampToValueAtTime(980, t + 0.25);
      lp.frequency.linearRampToValueAtTime(560, t + dur);
      lp.connect(g);
    }
    g.connect(out);
    if (echoIn && out === bgmGain) g.connect(echoIn);

    [-3.5, 3.5].forEach((detune) => {
      const o = actx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      if (o.detune) o.detune.value = detune;
      o.connect(lp || g);
      o.start(t);
      o.stop(t + dur + 0.03);
    });
  }

  // 6. 牛皮大鼓 / 堂鼓木鱼
  function voiceDrum(level, t, softMode, dest) {
    if (!actx || !level) return;
    const out = dest || bgmGain;
    if (softMode) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(level >= 2 ? 280 : 440, t);
      o.frequency.exponentialRampToValueAtTime(125, t + 0.08);
      g.gain.setValueAtTime(level >= 2 ? 0.11 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.10);
      return;
    }

    const isHeavy = level >= 3;
    const isRim = level === 1;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(isRim ? 260 : (isHeavy ? 132 : 158), t);
    o.frequency.exponentialRampToValueAtTime(isRim ? 115 : (isHeavy ? 44 : 58), t + (isHeavy ? 0.22 : 0.14));
    const vol = isHeavy ? 0.34 : (isRim ? 0.11 : 0.20);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (isHeavy ? 0.26 : 0.16));
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.28);

    if (noiseBuf && actx.createBiquadFilter) {
      const ns = actx.createBufferSource();
      ns.buffer = noiseBuf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isRim ? 1400 : 380;
      const ng = actx.createGain();
      ng.gain.setValueAtTime(vol * 0.42, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      ns.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      ns.start(t);
      ns.stop(t + 0.04);
    }
  }

  // ================= 实时调度 BGM 长卷步进器 =================

  // 计算当前音符后续有多少个连音延音格 (-1)，让洞箫与长弦真正拉出悠长气息！
  function countHoldSteps(arr, pos) {
    let hold = 1;
    const n = arr.length;
    while (pos + hold < n && arr[pos + hold] === -1) {
      hold++;
    }
    return hold;
  }

  function scheduleStep(themeCfg, idx, t, stepDur) {
    const totalLen = (themeCfg.lead && themeCfg.lead.length) || 16;
    const pos = idx % totalLen;
    const cycle = Math.floor(idx / totalLen);
    const section = Math.floor(pos / 64); // 每64步为一章
    const step16 = pos % 16;
    const bar = Math.floor(idx / 16);

    // 1. 丝弦低音和声铺底（每8步=1小节平滑衔接长弦）
    if (themeCfg.padEvery8 && pos % 8 === 0) {
      const padIdx = Math.floor(pos / 8) % themeCfg.padEvery8.length;
      const padMidi = themeCfg.padEvery8[padIdx];
      if (padMidi > 0) {
        voiceSilkPad(midiToFreq(padMidi), t, stepDur * 8.6, 0.085);
      }
    }

    // 2. 乐章转换处的古筝五声流水刮奏
    if (themeCfg.glissSteps && themeCfg.glissSteps[pos]) {
      voiceGuzhengGliss(themeCfg.glissSteps[pos], t, 0.11);
    }

    // 3. 主旋律声部（支持跨步长音 -1 与多乐章音色轮换 + 洞箫古筝双声部叠奏）
    const leadNote = themeCfg.lead && themeCfg.lead[pos];
    if (leadNote && leadNote > 0) {
      const hold = countHoldSteps(themeCfg.lead, pos);
      const f = midiToFreq(leadNote);
      const lVoice = (themeCfg.leadVoicesBySection && themeCfg.leadVoicesBySection[section]) || themeCfg.leadVoice || 'flute';

      if (lVoice === 'flute') {
        voiceFlute(f, t, stepDur * (hold + 0.35), 0.17);
        // 在第二轮循环或第三、四章重点长音处轻叠古筝泛音点缀，层次更丰富
        if (hold >= 3 && (section >= 2 || cycle % 2 === 1)) {
          voiceGuzheng(f, t, stepDur * 2.4, 0.11);
        }
      } else if (lVoice === 'pipa') {
        voicePipa(f, t, stepDur * Math.max(1.25, hold * 0.9), 0.20);
      } else {
        voiceGuzheng(f, t, stepDur * Math.max(1.9, hold + 0.4), 0.20);
        // 第二章古筝主奏时，长音处由高远洞箫柔声应和（筝笛和鸣）
        if (hold >= 2 && themeCfg.leadVoicesBySection) {
          voiceFlute(f, t + 0.02, stepDur * (hold + 0.3), 0.12);
        }
      }
    }

    // 4. 分解伴奏声部（古筝 / 琵琶流水伴奏）
    if (themeCfg.arp && themeCfg.arp.length) {
      const arpNote = themeCfg.arp[pos % themeCfg.arp.length];
      if (arpNote && arpNote > 0) {
        const octVar = (cycle % 2 === 1 && pos % 8 === 4 && arpNote < 72) ? 12 : 0;
        const af = midiToFreq(arpNote + octVar);
        const aVoice = (themeCfg.arpVoicesBySection && themeCfg.arpVoicesBySection[section]) || themeCfg.arpVoice || 'guzheng';
        if (aVoice === 'pipa') {
          voicePipa(af, t, stepDur * 0.98, 0.105);
        } else {
          voiceGuzheng(af, t, stepDur * 1.75, 0.115);
        }
      }
    }

    // 5. 青铜编钟 / 玉磬点睛
    const chimeNote = (themeCfg.chimeMap && themeCfg.chimeMap[pos]) || (themeCfg.chime && themeCfg.chime[step16]);
    if (chimeNote) {
      voiceChime(midiToFreq(chimeNote), t, stepDur * 5.2, 0.105);
    }

    // 6. 远山苍凉号角（第三章风云际会或战场激战）
    if (themeCfg.hornMap && themeCfg.hornMap[pos]) {
      voiceWarHorn(midiToFreq(themeCfg.hornMap[pos]), t, stepDur * 5.5, 0.095);
    } else if (themeCfg.horn && themeCfg.horn[step16] && bar % 2 === 0) {
      voiceWarHorn(midiToFreq(themeCfg.horn[step16]), t, stepDur * 3.6, 0.12);
    }

    // 7. 堂鼓 / 战鼓律动
    const drumArr = (themeCfg.drumBySection && themeCfg.drumBySection[section]) || themeCfg.drum;
    const drumLv = drumArr && drumArr[step16];
    if (drumLv) {
      voiceDrum(drumLv, t, !!themeCfg.drumSoft);
    }
  }

  function update() {
    if (muted || bgmPausedForResult) return;
    if (!actx) ensureContext();
    if (!actx) return;
    if (actx.state === 'running' && !unlocked) unlocked = true;
    if (!unlocked || actx.state === 'suspended') return;

    const themeCfg = BGM_THEMES[currentTheme] || BGM_THEMES.map;
    const stepDur = 60 / themeCfg.bpm / 2; // 八分音符步长
    const now = actx.currentTime;
    if (nextNoteTime < now - 0.2) {
      nextNoteTime = now + 0.04;
    }
    while (nextNoteTime < now + 0.16) {
      scheduleStep(themeCfg, stepIndex, nextNoteTime, stepDur);
      nextNoteTime += stepDur;
      stepIndex++;
    }
  }

  function setSceneBGM(sceneName, params) {
    bgmPausedForResult = false;
    let target = 'map';
    if (sceneName === 'battle') {
      const m = params && params.mode;
      target = m === 'beast' ? 'beast' : (m === 'arena' ? 'arena' : 'battle');
    } else if (sceneName === 'wheel') {
      target = 'wheel';
    } else if (sceneName === 'arena') {
      target = 'arena';
    } else if (sceneName === 'beastDungeon') {
      target = 'beast';
    } else if (sceneName === 'shop' || sceneName === 'activity') {
      target = 'shop';
    } else if (sceneName === 'roster' || sceneName === 'beast' || sceneName === 'warehouse' || sceneName === 'mail') {
      target = 'camp';
    } else {
      target = 'map';
    }

    if (target !== currentTheme) {
      themeStepMemory[currentTheme] = stepIndex;
      currentTheme = target;
      // 战斗场景从起拍鼓点开始；首页大地图与营帐长曲从上次离开的乐章平滑续播！
      stepIndex = (target === 'battle' || target === 'beast' || target === 'arena')
        ? 0
        : (themeStepMemory[target] || 0);
      if (actx) {
        nextNoteTime = actx.currentTime + 0.08;
      }
    }
  }

  // ================= 16 种独立高精度交互与战斗动作音效 =================

  function playNoiseSweep(t, dur, fStart, fEnd, vol, q) {
    if (!actx || !noiseBuf || !actx.createBiquadFilter) return;
    const ns = actx.createBufferSource();
    ns.buffer = noiseBuf;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q || 2.2;
    bp.frequency.setValueAtTime(fStart, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(80, fEnd), t + dur);

    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    ns.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    ns.start(t);
    ns.stop(t + dur + 0.02);
  }

  function playSfx(name, extra) {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();

    const nowMs = Date.now();
    const minGap = SFX_THROTTLE_MS[name] || 0;
    if (minGap > 0 && nowMs - (sfxLastTime[name] || 0) < minGap) return;
    sfxLastTime[name] = nowMs;

    const t = ctx.currentTime + 0.005;

    switch (name) {
      case 'click': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(680, t);
        o.frequency.exponentialRampToValueAtTime(340, t + 0.045);
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.055);
        break;
      }

      case 'battle_start': {
        bgmPausedForResult = false;
        voiceDrum(3, t, false, sfxGain);
        voiceDrum(3, t + 0.22, false, sfxGain);
        voiceDrum(3, t + 0.44, false, sfxGain);
        voiceWarHorn(midiToFreq(57), t + 0.18, 0.95, 0.24, sfxGain);
        voiceWarHorn(midiToFreq(64), t + 0.55, 0.85, 0.22, sfxGain);
        break;
      }

      case 'bow_shoot': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(290, t);
        o.frequency.exponentialRampToValueAtTime(115, t + 0.075);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.09);
        playNoiseSweep(t + 0.01, 0.13, 2800, 950, 0.18, 3.2);
        break;
      }

      case 'fan_cast': {
        playNoiseSweep(t, 0.20, 900, 2600, 0.16, 2.0);
        voiceChime(midiToFreq(79), t + 0.02, 0.35, 0.12, sfxGain);
        voiceChime(midiToFreq(84), t + 0.08, 0.42, 0.11, sfxGain);
        break;
      }

      case 'sword_hit': {
        playNoiseSweep(t, 0.09, 3400, 1100, 0.22, 4.0);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(185, t);
        o.frequency.exponentialRampToValueAtTime(62, t + 0.08);
        g.gain.setValueAtTime(0.20, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.09);
        break;
      }

      case 'spear_thrust': {
        playNoiseSweep(t, 0.11, 1800, 3800, 0.20, 3.6);
        voicePipa(midiToFreq(69), t, 0.12, 0.16, sfxGain);
        break;
      }

      case 'ultimate': {
        voiceDrum(3, t, false, sfxGain);
        playNoiseSweep(t, 0.45, 420, 1800, 0.28, 1.5);
        [62, 69, 74, 78, 86].forEach((m, i) => {
          voiceChime(midiToFreq(m), t + i * 0.045, 0.9, 0.15, sfxGain);
        });
        break;
      }

      case 'wheel_tick': {
        const pitch = 780 + Math.min(420, ((extra && extra.speedRatio) || 0.5) * 360);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(pitch, t);
        o.frequency.exponentialRampToValueAtTime(360, t + 0.028);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.036);
        break;
      }

      case 'wheel_win': {
        [72, 76, 79, 84, 88, 96].forEach((m, i) => {
          voiceChime(midiToFreq(m), t + i * 0.065, 0.95, 0.20, sfxGain);
          if (i % 2 === 0) voiceGuzheng(midiToFreq(m - 12), t + i * 0.065, 0.7, 0.18, sfxGain);
        });
        break;
      }

      case 'chest_open': {
        voiceDrum(2, t, true, sfxGain);
        [74, 78, 81, 86, 90].forEach((m, i) => {
          voiceChime(midiToFreq(m), t + 0.05 + i * 0.055, 0.75, 0.18, sfxGain);
        });
        break;
      }

      case 'coin': {
        voiceChime(midiToFreq(86), t, 0.35, 0.16, sfxGain);
        voiceChime(midiToFreq(93), t + 0.07, 0.45, 0.18, sfxGain);
        break;
      }

      case 'upgrade': {
        [69, 73, 76, 81].forEach((m, i) => {
          voiceGuzheng(midiToFreq(m), t + i * 0.055, 0.55, 0.20, sfxGain);
        });
        break;
      }

      case 'recruit': {
        voiceWarHorn(midiToFreq(62), t, 0.75, 0.20, sfxGain);
        [74, 78, 81, 86].forEach((m, i) => {
          voiceChime(midiToFreq(m), t + 0.08 + i * 0.08, 1.0, 0.20, sfxGain);
        });
        break;
      }

      case 'victory': {
        bgmPausedForResult = true;
        voiceDrum(3, t, false, sfxGain);
        voiceDrum(3, t + 0.18, false, sfxGain);
        voiceWarHorn(midiToFreq(62), t + 0.05, 0.65, 0.22, sfxGain);
        voiceWarHorn(midiToFreq(69), t + 0.42, 0.95, 0.24, sfxGain);
        [74, 78, 81, 86, 90, 98].forEach((m, i) => {
          voiceChime(midiToFreq(m), t + 0.12 + i * 0.09, 1.2, 0.19, sfxGain);
        });
        break;
      }

      case 'defeat': {
        bgmPausedForResult = true;
        voiceChime(midiToFreq(48), t, 1.6, 0.28, sfxGain);
        voiceChime(midiToFreq(55), t + 0.02, 1.4, 0.18, sfxGain);
        playNoiseSweep(t, 0.75, 650, 180, 0.18, 1.2);
        break;
      }

      case 'disaster': {
        playNoiseSweep(t, 0.65, 320, 95, 0.22, 1.1);
        voiceDrum(3, t + 0.05, false, sfxGain);
        break;
      }

      default:
        break;
    }
  }

  init();

  App.Audio = {
    unlock,
    update,
    setSceneBGM,
    playSfx,
    isMuted,
    toggleMute,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
