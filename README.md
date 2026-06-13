# RUNNER

---

![pages](/docs/pages.png)

---

[技术实现](../docs/技术实现)

---

## 即时约跑✅️

就南京某高校扫脸打卡式的跑操系统启发，打造集 **即时定位 + 跑团 + 跑步数据分析** 为一体的约跑软件

---

### 基本功能

- [ ] 跑步定位
- [ ] 轨迹记录
- [ ] 微信登录

---

### 社交分享

- [ ] 统一的日程安排
- [ ] 实时信息共享
- [ ] 语音系统+音乐共享
- [ ] 排行榜
- [ ] 匹配跑步搭子
- [ ] 信誉系统

---

### Web SEO 页面（非必须/doge）

---

## Quick Start

### 下载依赖

 `pnpm install //recommend~`
 或
 `npm install`
 或
 `yarn install`

### .env

 `cp .env.example .env`

 改为个人环境变量

### Auth

 生成 Auth 表
 `npx auth migrate`

### dev 模式启动

 `pnpm run dev`

 输出类似于以下即可

```bash

 Lockfile is up to date, resolution step is skipped
 Already up to date
 Done in 301ms using pnpm v11.0.8
 $ next dev --turbopack
    ▲ Next.js 15.5.18 (Turbopack)
    - Local:        http://localhost:3000
    - Network:      http://172.22.32.1:3000

  ✓ Starting...
  ✓ Ready in 7.3s

```

### 项目结构

```markdown

📂
├── 📂 src                // 源代码
│   ├── 📂 app            // app router 代码
│   │   ├ ……
│   │   └ 📂 api          // 向外调用 api
│   ├── 📂 lib            // 库函数
│   └── 📂 ui             // ui 组件库
│
├── 📂 public
│
├── 📂 prisma             // ORM 映射配置
├── 📃 prisma.config.ts
│
├── 📃 .env.example       // 环境变量
│
├── 📃 tsconfig.json      // ts 配置
│
├── 📃 next.config.ts     // next.js 配置
├── 📃 next-env.d.ts
│
├── 📃 eslint.config.mjs  // eslint 设置
│
├── 📃 postcss.config.mjs // css 配置
│
├── 📃 package.json       // 依赖管理
├── 📃 pnpm-lock.yaml
├── 📃 pnpm-workspace.yaml
├── 📃 bun.lock
│
├── 📃 compose.debug.yaml // docker 部署
├── 📃 compose.yaml
├── 📃 Dockerfile
└── 📃 .dockerignore

```
