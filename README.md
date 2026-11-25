# 角色图鉴 · Charafind

> 「这个角色出自哪部作品？」——把一个角色名，变成一部作品的全员名单。

一个面向二次元观众的角色 / 作品索引站：搜角色能查清 TA 出自哪部动漫或游戏，进作品能一次看完全员，
另外还有热度排行榜、点赞收藏、楼中楼评论，以及一套分级审核的管理后台。

因为云服务有 Origin 白名单（详见 [为什么部署到 GitHub Pages 时是只读演示版](#五为什么部署到-github-pages-时是只读演示版)），
项目有两个形态：

| 形态 | 地址 | 说明 |
| --- | --- | --- |
| **静态演示版**（GitHub Pages） | https://yunna6.github.io/charafind/ | 全部浏览功能可用，数据为构建时的只读快照 |
| **完整版**（可登录互动） | https://charafind.app.workbuddy.host/?sharecode=QJ7XR3VUWS | 登录、点赞、收藏、评论、投稿、审核、管理台 |

源码仓库：https://github.com/yunna6/charafind

---

## 一、快速运行

环境：Node.js ≥ 18（推荐 20）、npm。

```bash
npm install
npm run dev          # http://localhost:5173
```

完整版（连真实云服务）就是上面这条命令，`src/cloud.ts` 里已内置云端公开配置，开箱即连。

```bash
npm run build        # 生产构建，产物在 dist/
npm run preview      # 本地预览构建产物
```

只读演示版（GitHub Pages 那种形态）：

```bash
# 子路径要跟仓库名一致；Windows Git Bash 需要 MSYS_NO_PATHCONV=1 防止路径被改写
VITE_DEMO=1 BASE_PATH=/charafind/ npm run build
```

| 环境变量 | 作用 |
| --- | --- |
| `VITE_DEMO=1` | 切到只读快照数据层，不连云服务 |
| `BASE_PATH` | 构建的公共路径。GitHub Pages 项目站点填 `/<仓库名>/`，根域名站点填 `/` |
| `PORT` | dev / preview 端口，默认 5173 |

### 发布到 GitHub Pages

推到 `main` 分支即自动构建发布，工作流见 `.github/workflows/deploy.yml`：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；
2. push 到 `main`，或手动运行 `Deploy to GitHub Pages` 工作流；
3. 首次发布后地址为 `https://yunna6.github.io/charafind/`（本项目已按此配置）。

工作流会自动判断子路径（仓库名形如 `<用户名>.github.io` 时用根路径），并以 `VITE_DEMO=1` 构建。

### 更新演示版的数据快照

演示版的数据是打包进站点的 JSON，线上数据变了要重新抓一次：

```bash
npm run snapshot     # 重新抓 public/demo/snapshot.json
git commit -am "chore: 更新演示快照"
```

---

## 二、功能清单

**浏览**

- 全站搜索：角色名、日文名、声优、标签、作品名都能命中，也可按作品平铺全员
- 作品页：封面、年份、制作公司、简介、标签、全员角色
- 角色页：头像、日 / 中名、定位、CV、生日、台词、简介、标签、所属作品
- 首页「此刻最热」：按热度 / 点赞 / 收藏横向滑动展板 + 轮播推荐
- 排行榜：热度 / 点赞 / 收藏三种口径，第一名（含并列）戴金冠
- 明暗双主题，跟随系统并可手动切换，选择持久化

**互动**（完整版）

- 邮箱验证码登录
- 点赞 / 收藏（幂等：重复点击不报错，多标签页状态不错乱）
- 评论与楼中楼回复：任意用户可以在别人的评论下接着回，回复带 `@昵称` 粉色前缀与缩进竖线
- 举报评论
- 投稿角色 / 作品，进入审核队列

**管理台**（完整版）

- 顶部待办横幅：有活是红条，无活是绿勾；导航上带数字红点，手机端收成纯红点
- 待审队列（次级管理员投票）/ 待终审队列（主管理员）
- 举报队列：删除或忽略
- 管理员申请队列与团队管理
- 角色换图、改文案、上下架（仅主管理员）

### 管理员是怎么产生的（分级审核）

主管理员唯一，普通用户申请，次级管理员双审：

```
普通用户提交申请（理由 8–300 字）
        │
        ▼
主管理员审批 ──拒绝──→ 24 小时内不能重申
        │
      通过
        ▼
   成为次级管理员（moderator）
```

投稿审核走两票制：

- **主管理员（super）**：一票上架 / 一票驳回即删除
- **次级管理员（moderator）**：只记票，`拒绝 ≥ 2` 直接删除；`通过 ≥ 2` 进入待终审
- 只有 1 名次级管理员时，一票即视为投满
- 禁止审核自己的投稿（数据库层面 `42501` 拒绝）
- 终审通过即上架，作品一起转为 official；投稿留下的空壳作品会被清理

规则全部写在 PostgreSQL 函数里（`review_submission`、`apply_admin`、`review_admin_application` 等），
前端只负责展示票况，绕不过去。

---

## 三、技术栈

- **React 19** + **TypeScript 5.9** + **Vite 7**
- 手写 CSS（约 2600 行，CSS 变量做明暗双主题），无 UI 框架、无 Tailwind
- 自建 hash 路由（`#/`、`#/work/:id`、`#/character/:id`、`#/rank`、`#/me`、`#/admin`），
  静态托管不需要 404 回退配置
- 数据层：`@tencent-ai/workbuddy-cloud-sdk`（PostgREST 风格），数据库为 PostgreSQL + RLS
- 二维码 / 图片处理：浏览器端 Canvas 压缩后以 data URL 存库（头像 240×240 WebP，6–11KB）

---

## 四、目录结构

```
.
├── .github/workflows/deploy.yml   # Pages 自动构建发布
├── public/
│   ├── avatars/  covers/          # 首屏轮播等静态图
│   └── demo/snapshot.json         # 演示版只读数据快照（npm run snapshot 生成）
├── scripts/build-snapshot.mjs     # 抓线上公开数据生成快照
├── src/
│   ├── cloud.ts                   # 云端配置 + 演示/完整双形态切换
│   ├── demo.ts                    # 只读数据层：迷你 PostgREST 查询器
│   ├── api.ts                     # 所有数据访问集中在这一层
│   ├── store.tsx                  # 全局状态：目录、会话、点赞、管理员待办
│   ├── router.ts / types.ts / utils.ts
│   ├── components/                # PosterCard / PosterRail / CommentSection / Avatar ...
│   ├── pages/                     # Home / Work / Character / Rank / Me / Admin
│   └── styles.css
├── index.html
└── vite.config.ts
```

---

## 五、为什么部署到 GitHub Pages 时是只读演示版

这是实测结论，不是偷懒：

```
GET https://charafind.app.workbuddy.host/.cloud/database/rest/works
  Origin: https://yunna6.github.io
→ 403 {"error":"access_denied",
       "error_description":"the request origin is not allowed for this client"}
```

云服务按 **Origin 白名单** 校验客户端，只放行本站域名与 localhost。把前端原样搬到 Pages，
页面壳能打开，但作品、角色、评论一条都读不出来——那才是真正的「链接打不开」。

所以 Pages 版本的做法是：

1. `npm run snapshot` 以 localhost Origin 抓取公开数据（RLS 只会给出 official 的公开行），
   存成 `public/demo/snapshot.json`；
2. `src/demo.ts` 用约 200 行实现一个迷你查询器，支持 `.select().eq().is().order().limit()`
   与 `rpc('character_stats')`，让 `api.ts` 一行不改地跑在快照上；
3. 写操作（点赞 / 评论 / 投稿 / 审核）统一返回「只读演示版」提示，页面顶部有横幅说明，
   并给出「前往完整版」出口。

因此：**Pages 版 = 可完整浏览的静态站，完整版 = 可登录互动的动态站**。两边同一套源码、同一套样式。

---

## 六、设计说明

数据先说一句：20 个角色的头像原始素材全是 **240×240 WebP**，这决定了任何「大图铺满」的方案都会糊。
于是首页热门区走的是**剧场海报**思路——2:3 竖版卡、深色卡面配 accent 径向光晕、小图居中做聚光灯、
底部压字幕区（作品名 / 角色名 / CV / 热度），序号 01/02/03 用金、银、铜区分前三。
既有海报的仪式感，又不依赖高清大图。

其余几条约定：

- 明暗两套主题各自调过对比度，不是简单反色；深色下海报卡面比背景更亮，避免糊成一片
- 排行榜第一名的金冠用 3.6s 缓浮动画，并列时每人都戴，空榜不戴
- 待办红点与「下架」之类的危险操作分色：红点用 `--alert`，比 `--danger` 更亮，小尺寸也看得见
- 窄屏（≤520px）顶栏红点收成 7px 纯圆点，否则数字角标会把顶栏撑出横向滚动

---

## 七、已知限制

- 演示版没有登录与写入；数据是构建时的快照，不是实时的
- 演示版的点赞 / 收藏 / 评论数来自快照，点不动
- 角色头像为 240×240，大尺寸展示时有上限；想上高清图需要先替换素材
- 完整版依赖云服务的 Origin 白名单，自建部署需要把新域名加进云服务应用配置

## 素材与版权

角色、作品名称与形象归各原作者及制作委员会所有，本项目仅作检索与交流用途，不含任何商业分发。
