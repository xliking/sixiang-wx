# 《四象三国志》微信小游戏客户端

**本工程只有界面和战斗演出代码，不含任何游戏数据和图片，必须连接后端 `../xcx_game_server` 才能运行。**

- 武将、装备、套装、道具、关卡、数值：启动时从后端拉取（`src/api.js` → `App.Config.load`，容器在 `src/config.js`）
- 图片：全部来自后端资源库（`src/assets.js`），按 key 取图，用到时才加载
- 存档与玩法逻辑：全在服务端。`App.State.xxx()` 的操作都是调后端接口，返回 Promise（`src/state/gameState.js`）

## 运行
1. 启动后端（见 `../xcx_game_server/README.md`）
2. 浏览器：用任意静态服务打开本目录的 `index.html`（如 `python3 -m http.server 3001`）；微信：用开发者工具导入本目录
3. 上线前把 `src/api.js` 的 `API_BASE` 改成 HTTPS 域名，并加入微信 request / downloadFile 合法域名

## 社交玩法
- 功能开启：后台「功能开启」配置各入口的主公等级。`App.Main.goScene` 按 `main.js` 里的 `SCENE_FEATURE` 统一拦截，地图入口用 `drawFeatureBadge` 显示「Lv.N开」
- 演武场天梯（`arenaScene`）、风云榜（`rankScene`）、世界 BOSS（`worldBossScene`）、联盟（`guildScene`，含联盟 BOSS）、邀请好友（`inviteScene`）
- 世界 / 联盟 BOSS 复用魔将战的演出：`level.raid` 存在时 BOSS 血量取服务端剩余值，限时结束、BOSS 倒下或我军覆没都按本场伤害上报
- 四个新入口的图标 key 为 `icon_rank` / `icon_worldboss` / `icon_guild` / `icon_invite`（现有图标是用游戏内已有原画加铜环边框合成的），可在后台「资源管理」替换
- 联盟名称、公告由玩家填写，需后台「联盟审核」通过后才生效；创建后进入「审核中」页面，可撤回

## 开发约定
- 不要在客户端新增配置文件、图片，或写死道具 / 装备 / 武将的 id 和数值；新增内容在后台「数值配置」「资源管理」里做
- 不要在客户端直接改 `App.State.get()` 的数据，也不要在客户端掷骰或发奖；新玩法在后端加接口，客户端用 `App.State.act('/api/xxx', 参数)` 调用
- 图片 key 约定：`general_<id>` / `eq_<id>` / `item_<id>` / `beast_<id>`
# sixiang-wx
