/**
 * 《四象三国志》微信小游戏后端服务 (Node.js 零依赖原生服务)
 * 功能：
 * 1. 微信 wx.login code 换取 openid 登录与用户建档 (/api/auth/wx-login)
 * 2. 主公等级(Lv.1~50)、主公经验、15级解锁神兽校验、通关装备/战马发放 (/api/battle/settle)
 * 3. 用户全量存档云端持久化 (/api/user/sync)
 * 4. 演武场真实玩家阵容池匹配 (/api/arena/opponents)
 * 5. 同时托管前端静态资源，浏览器直接访问 http://localhost:3001 即可同源联调
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'data', 'users.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('loadDB error:', e);
  }
  return { users: {} };
}

function saveDB(db) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('saveDB error:', e);
  }
}

// 主公升级所需经验曲线：通关前14~15关恰好升至 Lv.15 解锁抓捕四象神兽！
function getExpForNextLevel(lv) {
  return Math.round(80 + (lv - 1) * 35);
}

function addLordExpServer(user, expGain) {
  user.lordLevel = user.lordLevel || 1;
  user.lordExp = (user.lordExp || 0) + expGain;
  let leveledUp = false;
  while (user.lordLevel < 60) {
    const need = getExpForNextLevel(user.lordLevel);
    if (user.lordExp >= need) {
      user.lordExp -= need;
      user.lordLevel += 1;
      leveledUp = true;
    } else {
      break;
    }
  }
  return { lordLevel: user.lordLevel, lordExp: user.lordExp, nextExp: getExpForNextLevel(user.lordLevel), leveledUp };
}

function resolveWechatOpenId(code, clientUid) {
  return new Promise((resolve) => {
    if (WX_APPID && WX_SECRET && code && !code.startsWith('mock_')) {
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
      https.get(url, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.openid) return resolve(data.openid);
          } catch (e) {}
          resolve(clientUid || ('wx_dev_' + Date.now()));
        });
      }).on('error', () => resolve(clientUid || ('wx_dev_' + Date.now())));
    } else {
      resolve(clientUid || ('wx_user_' + Date.now()));
    }
  });
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. 微信登录 & 获取主公云端档案
  if (pathname === '/api/auth/wx-login' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const openid = await resolveWechatOpenId(body.code, body.clientUid);
    const db = loadDB();
    if (!db.users[openid]) {
      db.users[openid] = {
        openid,
        nickname: body.nickname || ('主公_' + openid.slice(-4)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lordLevel: 1,
        lordExp: 0,
        saveData: null,
      };
      saveDB(db);
    }
    const u = db.users[openid];
    return sendJson(res, 200, {
      ok: true,
      openid,
      lordLevel: u.lordLevel || 1,
      lordExp: u.lordExp || 0,
      nextExp: getExpForNextLevel(u.lordLevel || 1),
      saveData: u.saveData,
    });
  }

  // 2. 同步用户全量存档到后端（记录主公等级、阵容、装备、神兽）
  if (pathname === '/api/user/sync' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const openid = body.openid;
    if (!openid) return sendJson(res, 400, { ok: false, msg: 'missing openid' });
    const db = loadDB();
    const u = db.users[openid] || { openid, createdAt: Date.now() };
    if (body.saveData) {
      u.saveData = body.saveData;
      u.lordLevel = body.saveData.lordLevel || u.lordLevel || 1;
      u.lordExp = body.saveData.lordExp || u.lordExp || 0;
      u.power = body.power || 0;
      u.factionId = body.saveData.factionId || u.factionId;
    }
    u.updatedAt = Date.now();
    db.users[openid] = u;
    saveDB(db);
    return sendJson(res, 200, {
      ok: true,
      lordLevel: u.lordLevel,
      lordExp: u.lordExp,
      nextExp: getExpForNextLevel(u.lordLevel),
    });
  }

  // 3. 关卡结算接口：发放主公经验、校验15级抓捕神兽权限
  if (pathname === '/api/battle/settle' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const openid = body.openid;
    const db = loadDB();
    const u = db.users[openid];
    if (!u) return sendJson(res, 404, { ok: false, msg: 'user not found' });

    if (body.mode === 'beast' && (u.lordLevel || 1) < 15) {
      return sendJson(res, 403, { ok: false, msg: '主公等级需达到 15 级方可挑战并抓捕四象神兽！' });
    }

    const expGain = Number(body.expGain || 60);
    const lvRes = addLordExpServer(u, expGain);
    if (u.saveData) {
      u.saveData.lordLevel = lvRes.lordLevel;
      u.saveData.lordExp = lvRes.lordExp;
    }
    u.updatedAt = Date.now();
    saveDB(db);
    return sendJson(res, 200, Object.assign({ ok: true, expGain }, lvRes));
  }

  // 4. 演武场真实玩家池查询
  if (pathname === '/api/arena/opponents' && req.method === 'GET') {
    const myOpenid = urlObj.searchParams.get('openid') || '';
    const db = loadDB();
    const realPlayers = Object.values(db.users)
      .filter((u) => u.openid !== myOpenid && u.saveData && u.saveData.deployIds && u.saveData.deployIds.length > 0)
      .slice(0, 5)
      .map((u, idx) => ({
        playerName: u.nickname || ('微信主公_' + u.openid.slice(-4)),
        faction: u.saveData.factionId || 'shu',
        title: `Lv.${u.lordLevel || 1} 真实玩家`,
        lv: Math.max(1, u.lordLevel || 1),
        power: u.power || 4200,
        generals: u.saveData.deployIds,
        beast: u.saveData.activeBeastId || null,
        rank: 120 + idx * 45,
        rewardGold: 360 + idx * 100,
        rewardSoul: 28 + idx * 8,
      }));
    return sendJson(res, 200, { ok: true, players: realPlayers });
  }

  // 5. 静态文件托管（方便直接浏览器打开 http://localhost:3001）
  let relPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);
  if (filePath.startsWith(ROOT_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    sendJson(res, 404, { ok: false, msg: 'Not Found' });
  }
});

server.listen(PORT, () => {
  console.log(`[四象三国志 Server] 后端服务已启动: http://localhost:${PORT}`);
});
