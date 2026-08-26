# Phase 1 实现计划：Auth → Locate → PlayGround

> 基于完整代码库分析 (2026-07-21)
> 分支策略：`git flow topic start phase1-auth` → `phase1-locate` → `phase1-playground`

---

## Part 0: 前置准备

| #   | 操作                                                                                                         | 文件               |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| P1  | 生成 `BETTER_AUTH_SECRET` (`openssl rand -hex 32`)，设置 `BETTER_AUTH_URL=http://localhost:3000`             | `.env`             |
| P2  | 修复 dead code——基于 `useSession()` 条件渲染：未登录 → hero + login/register，已登录 → redirect `/dashboard` | `src/app/page.tsx` |
| P3  | 运行 `pnpm prisma:fmt` + `pnpm prisma:generate` 验证 schema                                                  | —                  |

---

## Part 1: Auth — 用户注册与登录

### 目标

完成邮箱密码 + OTP 认证流程，保护路由，会话感知。

### 新建文件

| 文件                                         | 用途                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/providers/auth-provider.tsx` | 包裹 better-auth `<SessionProvider>`，提供客户端 hooks             |
| `src/middleware.ts`                          | 路由保护——未认证用户重定向到 `/login`，放行静态资源                |
| `src/app/(auth)/layout.tsx`                  | 居中卡片布局，公用所有 auth 页面                                   |
| `src/app/(auth)/login/page.tsx`              | 邮箱 + 密码表单 → `signIn.email()`，错误态，OTP 重发提示           |
| `src/app/(auth)/register/page.tsx`           | 昵称 + 邮箱 + 密码表单 → `signUp.email()`，成功后进入 OTP 验证步骤 |
| `src/app/(auth)/forgot-password/page.tsx`    | 邮箱 → OTP → 新密码三步流程                                        |
| `src/app/(dashboard)/dashboard/page.tsx`     | 受保护占位页——用户头像，统计数据卡片，退出按钮                     |

### 修改文件

| 文件                 | 变更                                                           |
| -------------------- | -------------------------------------------------------------- |
| `src/app/layout.tsx` | 添加 `<AuthProvider>` 包裹 children，添加 `<Toaster>` (sonner) |
| `src/lib/actions.ts` | 填充 `resendOtp()`、`checkSession()` 等 auth server actions    |

### 详细设计

**auth-provider.tsx**：

```tsx
"use client";
import { SessionProvider } from "better-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
	return <SessionProvider>{children}</SessionProvider>;
}
```

**middleware.ts**：

```typescript
import { betterFetch } from "better-auth/react";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = [
	"/",
	"/login",
	"/register",
	"/forgot-password",
	"/api/auth",
];

export default async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	if (
		publicRoutes.some((p) => pathname.startsWith(p)) ||
		pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)
	) {
		return NextResponse.next();
	}
	const { data: session } = await betterFetch("/api/auth/get-session", {
		headers: { cookie: request.headers.get("cookie") ?? "" },
	});
	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**login/page.tsx**：

- 客户端组件，shadcn `Card` + `Input` + `Button`
- 调用 `signIn.email({ email, password })`
- 成功 → `router.push("/dashboard")`
- 失败 → 显示错误（凭证无效/邮箱未验证）
- 邮箱未验证 → 显示弹窗/重发 OTP 按钮
- 链接到 `/register` 和 `/forgot-password`

**register/page.tsx**：

- 客户端组件，表单字段：name, email, password, confirmPassword
- `signUp.email({ name, email, password })` → 进入 OTP 步骤
- OTP 步骤：6 位验证码输入 → `authClient.emailOtp.verifyEmail()` → session 创建 → redirect `/dashboard`

**forgot-password/page.tsx**：

- 步骤 1：输入邮箱 → 触发 OTP 发送
- 步骤 2：输入 6 位 OTP → 校验
- 步骤 3：输入新密码 + 确认 → `authClient.resetPassword()` → redirect `/login`

### 关键设计决策

- **Server Actions 不用 API Routes**：所有数据变更用 `actions.ts`，API routes 仅用于 webhook
- **OTP 流程**：better-auth 内置 OTP 支持，UI 只需做三步展示
- **font-sans 已修复为 literal 值**：`"Inter", ui-sans-serif, ...` — `@theme inline` 不需额外修改

### 验证

1. 注册 → DB 中 user + session + account 行被创建
2. 登录有效/无效凭据均正确处理
3. `/dashboard` 未登录时重定向到 `/login`
4. 退出清除 session
5. 忘记密码完整流程可用
6. `pnpm build` 无 TS 错误

---

## Part 2: Locate — GPS 定位与地图

### 目标

实时 GPS 追踪、高德地图集成、实时跑步数据显示、跑后数据汇总。

### 新建文件

| 文件                                        | 用途                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/lib/amap-loader.ts`                    | 动态加载高德 JS SDK 2.0（基于 promise 的 script 注入）                                         |
| `src/components/map/amap-map.tsx`           | 可复用的暗色主题高德地图组件（center, zoom, polyline, markers）                                |
| `src/components/map/location-picker.tsx`    | 交互式地图选点 → 返回 lat/lng/address                                                          |
| `src/hooks/use-gps-tracking.ts`             | `navigator.geolocation.watchPosition`，可配置采样密度                                          |
| `src/hooks/use-run-tracking.ts`             | 计时器、Haversine 距离、平均/即时配速、卡路里、自动公里分段                                    |
| `src/hooks/index.ts`                        | hooks 桶导出                                                                                   |
| `src/app/(dashboard)/run/page.tsx`          | **跑步记录页** — 240px 实时地图、计时器(Geist Mono)、距离、配速/心率/卡路里卡片、暂停/停止控制 |
| `src/app/(dashboard)/run/complete/page.tsx` | **跑步汇总页** — 静态地图回放、hero 数据、配速柱状图(CSS bars)、分段表(shadcn `Table`)         |

### 修改文件

| 文件                             | 变更                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/models/runrecord.prisma` | 添加字段：`trackPoints`(JSON), `elevationGain`, `elevationLoss`, `avgHeartRate`, `maxHeartRate`, `avgCadence`, `calories`, `splits`(JSON) |
| `src/lib/actions.ts`             | 追加：`createRunRecord`, `updateRunRecord`, `completeRunRecord`, `getUserRunRecords`                                                      |

### 详细设计

**prisma/models/runrecord.prisma** 新增字段：

```prisma
model RunRecord {
  // ... 现有字段 ...
  trackPoints       Json?     @map("track_points")      // [{lat, lng, alt, timestamp, accuracy}]
  totalElevation    Float     @default(0)
  elevationGain     Float     @default(0)
  elevationLoss     Float     @default(0)
  avgHeartRate      Int       @default(0)
  maxHeartRate      Int       @default(0)
  avgCadence        Int       @default(0)
  calories          Int       @default(0)
  splits            Json?     @map("splits")             // [{km, pace, heartRate, elevation}]
  notes             String?   @map("notes")
  deviceInfo        Json?     @map("device_info")
}
```

运行 `pnpm prisma:dev` 生成迁移。

**amap-loader.ts**：

```typescript
export function loadAmapSDK(options: {
	key: string;
	version?: string;
	securityJsCode?: string;
}): Promise<typeof AMap> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined") return reject(new Error("Browser only"));
		if ((window as any).AMap) return resolve((window as any).AMap);
		const script = document.createElement("script");
		script.src = `https://webapi.amap.com/maps?v=${options.version || "2.0"}&key=${options.key}&plugin=AMap.Geolocation`;
		script.async = true;
		script.onload = () => resolve((window as any).AMap);
		script.onerror = () => reject(new Error("Amap SDK failed to load"));
		document.head.appendChild(script);
		if (options.securityJsCode) {
			(window as any)._AMapSecurityConfig = {
				securityJsCode: options.securityJsCode,
			};
		}
	});
}
```

**use-gps-tracking.ts**：

```typescript
interface GPSTrackingOptions {
	samplingDensity: "high" | "medium" | "low"; // high=1s, medium=5s, low=10s
	minDistance?: number; // 最小采集距离(米)
	onPositionUpdate: (position: GeolocationPosition) => void;
}

function useGpsTracking(options: GPSTrackingOptions): {
	startTracking: () => void;
	stopTracking: () => void;
	state: {
		isTracking: boolean;
		currentPosition: GeolocationCoordinates | null;
		trackPoints: Array<{
			lat: number;
			lng: number;
			alt: number | null;
			timestamp: number;
			accuracy: number;
		}>;
		error: GeolocationPositionError | null;
	};
};
```

- 使用 `navigator.geolocation.watchPosition({ enableHighAccuracy: true })`
- 采样密度映射：`high`=1s, `medium`=5s, `low`=10s
- 按最小距离过滤重复点
- 组件卸载时清理 watcher
- 权限拒绝时展示明确的错误态 + 重试按钮

**use-run-tracking.ts**：

- 管理跑步状态机：`idle | running | paused | finished`
- 实时计算：
  - **耗时**：`setInterval(1000)` 从 startTime 计算
  - **距离**：累积 GPS 分段距离（Haversine 公式）
  - **平均配速**：duration / distance（mm:ss/km 格式）
  - **即时配速**：最近 30 秒滑动平均
  - **卡路里**：基于 MET 的估算（默认 70kg + duration + speed）
  - **分段**：每公里自动切分
- 输出格式：`{ durationSeconds, distanceMeters, paceSecondsPerKm, currentPaceSecondsPerKm, calories, splits }`

**run/page.tsx**（跑步记录页）：

- 匹配 Pencil "Running Record Screen"
- **地图区域**：240px 高度，暗色高德地图，实时轨迹 polyline
- **计时器**：大号 Geist Mono 橙色 `#FF5F1F`，格式 "MM:SS" / 目标时间
- **距离**：大号显示 "5.47 公里"（白色）
- **子统计行**（3 卡片）：
  - 配速 `5'43"` + "配速" 标签
  - 心率 `158` bpm（红色图标，`#FF4444`）+ "心率 bpm"
  - 卡路里 `312` + "卡路里"
- **控制区**：
  - 暂停按钮（72px 圆形，橙色描边图标）
  - 停止按钮（88px 圆形，渐变橙色 `#FF5F1F`，发光阴影，方形停止图标）
  - 锁定按钮（72px 圆形，锁图标）
- **群组区域**（组队跑时）：头像圆圈（最多 4 个成员，渐变色）
- 状态：idle（跑前配置）→ running（实时数据）→ paused（变暗）→ finished（触发汇总）
- 跑前配置：目标距离/时长/采样密度

**run/complete/page.tsx**（跑步汇总页）：

- 匹配 Pencil "Running Summary Screen"
- **Hero 距离**：48px 橙色 "5.23" 公里
- **日期**："2024年6月5日 19:32 — 20:09"
- **详情行**（4 卡片）：用时 32:37，配速 6'14"（橙色），卡路里 344，步频 173
- **配速分析**：每公里配速柱状图（CSS bars，5 根柱子，上标配速，下标公里）
- **分段详情表**（shadcn `Table`）：公里、配速、心率、海拔（"+12m"）
- 操作：保存跑步，分享（占位），返回首页

### 关键设计决策

- **GPS 点存 JSON**：MariaDB JSON 列，原子读写，无需单独表
- **高德加载方式**：运行时 script 注入（无官方 npm 包）
- **Haversine 距离**：客户端实时计算，保证精度
- **采样密度**："用户可自行选择测绘密度" → high=1s, medium=5s, low=10s
- **暗色地图**：高德 style `amap://styles/dark`

### 验证

1. 迁移成功应用，RunRecord 新字段存在
2. 高德 SDK 加载无 CORS/安全错误
3. 地图组件暗色主题渲染
4. GPS 追踪捕获坐标，采样密度可配置
5. Running Record 页：计时器、距离、配速实时更新
6. 停止 → 汇总页展示 DB 中的跑步数据
7. 地点选择器返回 lat/lng/address
8. 移动端视口（390px）布局正常

---

## Part 3: PlayGround — 域 CRUD、邀请码、排行榜

### 目标

完整域生命周期：创建（公开/私有）、通过邀请码加入、查看成员与排行、管理日程。

### 新建文件

| 文件                                                      | 用途                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prisma/models/invitecode.prisma`                         | `InviteCode` 模型：code, playGroundId, maxUses, useCount, expiresAt       |
| `src/components/navigation/tab-bar.tsx`                   | 5 标签导航栏（首页/约跑/记录/排行/我的），暗色玻璃效果，橙色活跃态        |
| `src/app/(dashboard)/layout.tsx`                          | Dashboard 外壳：`<TabBar>` 固定在底部，可滚动内容区                       |
| `src/app/(dashboard)/page.tsx`                            | **首页** — 问候语，3 统计卡片，日程卡片，最近跑步，"个人跑"/"约跑" 入口卡 |
| `src/app/(dashboard)/playground/create/page.tsx`          | **创建域** — 表单（名称，公开/私有，描述，集合地点选择器）→ 生成邀请码    |
| `src/app/(dashboard)/playground/join/page.tsx`            | **加入域** — 邀请码输入 + 公开域发现列表                                  |
| `src/app/(dashboard)/playground/[id]/page.tsx`            | **域详情** — 成员列表，排行预览，日程，"开始约跑" 大按钮                  |
| `src/app/(dashboard)/leaderboard/[playgroundId]/page.tsx` | **排行榜** — 排名表（头像，距离，配速，跑步次数），高亮当前用户           |
| `src/app/(dashboard)/schedule/page.tsx`                   | **日程管理** — 个人 + 域日程，从域导入到个人                              |
| `src/app/(dashboard)/settings/page.tsx`                   | **个人设置** — 基础信息，跑步预设（体重/采样密度/音频），退出             |

### 修改文件

| 文件                              | 变更                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `prisma/models/playground.prisma` | 添加：`inviteCodes InviteCode[]`，`locationLat`, `locationLng`, `locationAddr`, `description`                                 |
| `src/lib/actions.ts`              | 追加：`createPlayGround`，`joinPlayGround`，`leavePlayGround`，`generateInviteCode`，`getPlayGroundRanking`，日程相关 actions |

### 详细设计

**prisma/models/invitecode.prisma**：

```prisma
model InviteCode {
  id           String     @id @default(cuid())
  code         String     @unique @map("code")
  playGround   PlayGround @relation(fields: [playGroundId], references: [id], onDelete: Cascade)
  playGroundId String
  createdBy    String     @map("created_by")
  maxUses      Int        @default(0)    // 0 = 无限制
  useCount     Int        @default(0)    @map("use_count")
  expiresAt    DateTime?  @map("expires_at") @db.Timestamp(3)
  isActive     Boolean    @default(true) @map("is_active")
  createdAt    DateTime   @default(now()) @db.Timestamp(3)
  updatedAt    DateTime   @updatedAt @db.Timestamp(3)

  @@index([code])
  @@index([playGroundId])
  @@map("invite_code")
}
```

**playground.prisma** 新增字段：

```prisma
model PlayGround {
  // ... 现有字段 ...
  inviteCodes   InviteCode[]
  locationLat   Float?    @map("location_lat")
  locationLng   Float?    @map("location_lng")
  locationAddr  String?   @map("location_addr")
  description   String?   @map("description")
}
```

**Server Actions**（添加到 `src/lib/actions.ts`）：

| Action                                      | 功能                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `createPlayGround(data)`                    | 创建域 → 添加创建者为 OWNER → 生成邀请码 → 创建空排行榜 → 返回域 + 邀请码 |
| `getPlayGround(id)`                         | 获取域详情（含成员、排行）                                                |
| `listPublicPlayGrounds(page, limit)`        | 公开域发现列表                                                            |
| `joinPlayGround(inviteCode)`                | 查找邀请码 → 添加用户为 USER → 增加使用计数                               |
| `leavePlayGround(id)`                       | 用户从域中退出                                                            |
| `deletePlayGround(id)`                      | 仅 owner，级联删除                                                        |
| `generateInviteCode(playGroundId, options)` | 生成新邀请码（可设过期时间、最大使用次数）                                |
| `getPlayGroundMembers(playGroundId)`        | 成员列表（含角色）                                                        |
| `getPlayGroundLeaderboard(playGroundId)`    | 按 userId 聚合 → 排名（距离、时间、配速、次数）                           |
| `updatePlayGround(id, data)`                | 更新名称、描述、集合地点                                                  |

**tab-bar.tsx**：

- 5 个标签：首页(House)、约跑(Users)、记录(Activity)、排行(Trophy)、我的(User)
- 暗色玻璃效果：`#1A1A1ACC` 背景，28px 圆角，4px 模糊阴影
- 活跃标签：橙色 `#FF5F1F`，非活跃：`text-secondary`
- 使用 `next/link` + `usePathname()` 判断活跃状态

**(dashboard)/page.tsx**（首页）：

- 匹配 Pencil "Home Screen"
- **Header**：问候语 "下午好" + 用户名，头像（橙色圆形，首字母）
- **统计行**（3 卡片）：本月里程 127.4 公里，本月时长 12.8 小时，本月次数 17 次
- **开始跑步按钮**：渐变橙色大按钮 + play 图标
- **今日日程** section header + 日程卡片（橙色指示条 + 标题 + 时间/人数）
- **最近跑步** section header + 跑步卡片（标题 + 日期/配速/卡路里）

**playground/create/page.tsx**：

- 匹配 Pencil "Create Domain Screen"
- 表单输入：域名称，公开/私密切换，描述(可选)，集合地点(地点选择器)
- "生成邀请码" 按钮 → 显示邀请码（Geist Mono 大字，如 "RUN-8K2M"）
- "创建" 按钮 → 提交，redirect 到域详情页

**playground/join/page.tsx**：

- 匹配 Pencil "Join Domain Screen"
- 两个区域：
  - **邀请码输入**：文本框 + "加入域" 按钮
  - **公开域列表**：分隔线 "可加入的公开域" + 域名/人数 → "加入" 箭头按钮

**playground/[id]/page.tsx**：

- 匹配 Pencil "Domain Settings Screen"
- 域信息卡片（图标 + 名称 + 邀请码 + 成员数）
- 设置列表（6 行，橙色图标 + 标题 + 描述 + 右箭头）：
  1. 跑步目标设置
  2. 音频设置（麦克风、音量、共享音乐）
  3. 语音播报（配速提醒、里程播报）
  4. 实时共享（位置、心率、配速信息共享）
  5. 共享音乐（域成员同步播放列表）
  6. 集合地点
- Owner 额外：删除域（红色警告按钮）

**leaderboard/[playgroundId]/page.tsx**：

- 匹配 Pencil "Leaderboard Screen"
- 排行榜表（shadcn `Table`）：排名、头像+昵称、距离、配速、跑步次数
- 当前用户行高亮（橙色强调）
- 排序选项：按距离/配速/跑步次数

**schedule/page.tsx**：

- 匹配 Pencil "Community Schedule Screen"
- 域日程列表（时间指示条 + 标题 + 详情 + "加入" 按钮）
- 个人日程（已注册的日程事件）
- "从域导入" 按钮 → 将域日程复制到个人日程

**settings/page.tsx**：

- 匹配 Pencil "Personal Settings Screen"
- 个人信息：头像、昵称、邮箱
- 跑步预设：体重（卡路里计算用）、默认采样密度、音频偏好
- 第三方关联：微信登录/分享/运动，已连接设备（Apple Watch, Garmin, Strava 等）
- 退出登录按钮

### 关键设计决策

- **邀请码独立模型**：支持使用追踪、过期、多次生成；与 PlayGround 级联删除
- **排行榜聚合**：Server Action 按 userId group → 聚合 distance/time/pace
- **日程导入**：从 PlayGroundSchedule spot → 复制到 UserSchedule
- **TabBar 作为 shell**：所有 dashboard 页面共享底部导航

### 验证

1. 创建域 → DB 中有 PlayGround + PlayGroundUser(OWNER) + InviteCode
2. 邀请码可加入
3. 邀请码记录使用次数
4. 公开域在发现列表中
5. 域详情显示成员、排行、日程
6. 排行榜聚合正确排序
7. 日程 CRUD 可用
8. TabBar 正常导航
9. 删除域级联删除关联记录
10. `pnpm build` 无 TS 错误

---

## 路由结构

```
/                          → 落地页（公开，基于 session 条件渲染）
/login                     → 登录（公开）
/register                  → 注册（公开）
/forgot-password           → 忘记密码（公开）
/dashboard                 → 首页（受保护）
/run                       → 跑步记录（受保护）
/run/complete              → 跑步汇总（受保护）
/playground/create         → 创建域（受保护）
/playground/join           → 加入域（受保护）
/playground/[id]           → 域详情（受保护）
/leaderboard/[playgroundId] → 排行榜（受保护）
/schedule                  → 日程管理（受保护）
/settings                  → 个人设置（受保护）
```

| 路由组        | 布局                     | 访问                |
| ------------- | ------------------------ | ------------------- |
| `(auth)`      | 居中卡片 + 暗色背景      | 公开                |
| `(dashboard)` | TabBar 底部 + 可滚动内容 | 受保护 (middleware) |

---

## 依赖关系

```
Part 1 (Auth)
  ├── P1-P3 前置 (无依赖)
  ├── auth-provider.tsx (无依赖)
  ├── middleware.ts (无依赖)
  ├── layout.tsx 修改 (依赖 auth-provider)
  ├── login/register/forgot-password pages (依赖 auth-client.ts)
  ├── dashboard page (依赖所有 auth pages)
  └── actions.ts 填充 (依赖 prisma)

Part 2 (Locate) ← 依赖 Part 1 完成
  ├── runrecord.prisma 扩展 (无依赖)
  ├── amap-loader.ts (无依赖)
  ├── amap-map.tsx (依赖 amap-loader)
  ├── use-gps-tracking.ts (无依赖)
  ├── use-run-tracking.ts (依赖 use-gps-tracking)
  ├── run/page.tsx (依赖 amap-map, use-run-tracking, auth)
  ├── run/complete/page.tsx (依赖 amap-map, server actions)
  ├── location-picker.tsx (依赖 amap-map)
  └── actions.ts 追加 (依赖 prisma)

Part 3 (PlayGround) ← 依赖 Part 2 完成
  ├── invitecode.prisma (无依赖)
  ├── playground.prisma 扩展 (无依赖)
  ├── tab-bar.tsx + dashboard layout (依赖 auth)
  ├── 所有 playground pages (依赖 actions.ts)
  ├── leaderboard page (依赖 ranking actions)
  ├── schedule/settings pages (依赖 auth)
  └── actions.ts 追加 (依赖 prisma)
```

---

## 风险点

| 风险                                                                                    | 缓解方案                                                                         |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **better-auth middleware**：Edge runtime 中 `betterFetch` cookie 可能不兼容             | Fallback：轻量 middleware 仅检查 session cookie 存在性，或切换到 Node.js runtime |
| **高德 SDK 加载**：需要 `NEXT_PUBLIC_AMAP_KEY` + security code 配置，可能需要域名白名单 | 先 localhost 测试，生产环境在 Amap 控制台配置                                    |
| **地理定位权限**：移动端需要 HTTPS（生产），localhost 开发可用                          | 提供清晰的权限拒绝 UI + 重试                                                     |
| **后台 GPS**：移动浏览器在后台时可能节流 `watchPosition`                                | Phase 2 考虑 Service Worker 后台追踪                                             |
| **JSON 列性能**：MariaDB JSON 不支持索引查询                                            | 可接受——track points 整读整写，不做 JSON 内查询                                  |
