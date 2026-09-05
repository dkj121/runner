# Phase2: 架构深化计划

> 基于 `improve-codebase-architecture` 技能审查，识别 7 个深化机会。本文档供团队分工使用。
>
> 架构词汇：**模块**/**接口**/**深度**/**缝**/**适配器**/**杠杆**/**局部性**

## 背景

Phase1 建立了核心领域模型（PlayGround 域、RunRecord 跑步记录、InviteCode 邀请码、Schedule 日程）和认证流程，但架构存在系统性的**浅模块**问题。Phase2 的目标是将代码库从"能工作"提升到"可测试、可维护、AI 可导航"。

**核心洞察：** 最大的杠杆点是创建一个**路由包装器深度模块** — 将散落在 11 个路由文件中的 ~500 行认证/日志/错误处理样板吸收到一个小的接口后面。

---

## 设计决策

| 决策            | 选择                       | 说明                                                 |
| --------------- | -------------------------- | ---------------------------------------------------- |
| 范围            | 全部 7 项发现              | 按依赖顺序执行                                       |
| 路由包装器风格  | Builder 模式               | 链式 `.auth().requireRole().handle()`                |
| 认证 API        | 分离方法链                 | `.auth()` → `.requireRole()` → `.requireOwnership()` |
| Context 对象    | 最小 ctx                   | `{ session, request, params, logger, perf }`         |
| 模块位置        | `src/lib/route-wrapper.ts` | 与现有 lib 模式一致                                  |
| GPS 错误处理    | 移除 try/catch             | 错误自然传播到包装器统一处理                         |
| track-calc 去重 | 统一导入                   | 移除 3 处内联副本                                    |
| 邀请码修复      | 新解析端点                 | `GET /api/playgrounds/resolve?code=XXXX`             |
| 客户端页面      | 提取 hook                  | 数据获取从页面组件中分离                             |
| 测试策略        | 纯函数优先                 | track-calc → coord-transform → gps-cache → hooks     |
| 中间件          | 保持现状                   | cookie 检查作为第一层门禁                            |
| 迁移策略        | 逐路由迁移                 | 每步 git commit，可随时回滚                          |

---

## 任务拆分

以下任务按依赖顺序排列。每项任务可独立分配给一个贡献者。

---

### 任务 A: track-calc.ts 去重 🔴 必须先做

**负责人：** **\_\_\_\_** | **预计时间：** 30min

**问题：** `haversineDistance`/`calcPace`/`formatDuration` 在 3 个文件中独立实现。`runs/[runId]/route.ts` 有一行误导性注释说"避免导入 track-calc.ts (browser-only amap-sdk)"，但 track-calc.ts 是纯函数，无浏览器依赖。

**文件变更：**

| 文件                                         | 操作                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/track-calc.ts`                      | 确认无浏览器依赖（无需修改）                                                                                                                             |
| `src/app/api/runs/[runId]/route.ts:8-44`     | 删除内联 `haversineDistance`, `calcLiveDistance`, `calcLivePace`；导入 `calcDistance`, `calcPace` from `@/lib/track-calc`                                |
| `src/app/(dashboard)/summary/page.tsx:42-57` | 删除内联 `formatDuration`；导入 `formatDuration` from `@/lib/track-calc`。`formatPace` 是页面专用展示函数（转换 `"5:30 /km"` → `"5'30""`），保留但加注释 |

**验证：** `pnpm build` 通过

---

### 任务 B: 创建路由包装器 `src/lib/route-wrapper.ts` 🔴 核心模块

**负责人：** **\_\_\_\_** | **预计时间：** 2h

**目标：** 创建深度模块 — 小接口，大实现。将认证、日志、错误处理集中到一个 Builder 模式的包装器中。

**接口设计：**

```typescript
// 小接口 — 只有两个入口
export function createRoute(method: string, path: string): RouteBuilder;
export function createPublicRoute(
	method: string,
	path: string,
): PublicRouteBuilder;
```

**Builder 链：**

```typescript
// 完整链示例
export const PUT = createRoute("PUT", "/api/playgrounds/[id]")
  .auth()                          // session 检查 → 401
  .requireRole("OWNER", "id")      // Prisma 角色查询 → 403
  .handle(async (ctx) => {
    // ctx = { session, request, params, logger, perf }
    const body = await ctx.request.json();
    const updated = await prisma.playGround.update({ ... });
    return NextResponse.json(updated);
  });
```

**包装器自动处理：**

- `Date.now()` 计时
- `crypto.randomUUID()` requestId
- `createRequestLogger()` 日志器注入
- `PerformanceLogger` 性能计时 + checkpoint
- `try/catch` 错误捕获 → `logError()` + `logApiRequest()`
- 统一错误响应格式 `{ error: string }` + HTTP status

**导出类型：**

```typescript
type RouteContext = {
	session: { user: { id: string; name: string; email: string } };
	request: Request;
	params: Record<string, string>;
	logger: Logger;
	perf: PerformanceLogger;
};
```

**验证：** TypeScript 编译通过（先不迁移路由，仅确保模块可构建）

---

### 任务 C: GPS 缓存错误传播

**负责人：** **\_\_\_\_** | **预计时间：** 20min

**问题：** `gps-cache.ts` 的 6 个函数都用 try/catch + console.error 吞掉错误。`pushPoints` 在 Redis 故障时静默丢弃 GPS 数据，API 返回 `{ ok: true }`。

**文件变更：** `src/lib/gps-cache.ts`

| 函数               | 变更                                                     |
| ------------------ | -------------------------------------------------------- |
| `createRunSession` | 移除 try/catch                                           |
| `pushPoints`       | 移除 try/catch（空数组提前 return 保留）                 |
| `getAllPoints`     | 移除 try/catch（空结果返回 `[]` 保留，Redis 故障抛异常） |
| `getActiveRunId`   | 移除 try/catch                                           |
| `getRunMeta`       | 移除 try/catch                                           |
| `clearRunSession`  | 移除 try/catch                                           |

错误自然传播到路由包装器的统一 catch 块处理。

**验证：** `pnpm build` 通过

---

### 任务 D: 路由迁移到包装器 🔴 最大工作量

**负责人：** **\_\_\_\_** | **预计时间：** 3h

按以下顺序逐路由迁移，每完成一个 commit 一次。

#### 批次 1: Runs 路由（简单，无角色检查）

| #   | 路由文件                                   | 包装器模式                                                            |
| --- | ------------------------------------------ | --------------------------------------------------------------------- |
| 1   | `src/app/api/runs/route.ts`                | `createRoute` + `.auth()`                                             |
| 2   | `src/app/api/runs/[runId]/route.ts`        | `createRoute` + `.auth()` + `.requireOwnership("runRecord", "runId")` |
| 3   | `src/app/api/runs/[runId]/points/route.ts` | `createRoute` + `.auth()` + `.requireOwnership("runRecord", "runId")` |

#### 批次 2: Playground 基础 CRUD

| #   | 路由文件                                                 | 包装器模式                                                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| 4   | `src/app/api/playgrounds/route.ts` (GET)                 | `createRoute` + `.auth()`                                                 |
| 5   | `src/app/api/playgrounds/route.ts` (POST)                | `createRoute` + `.auth()`                                                 |
| 6   | `src/app/api/playgrounds/[id]/route.ts` (GET/PUT/DELETE) | `createRoute` + `.auth()` + `.requireRole("OWNER", "id")` (仅 PUT/DELETE) |

#### 批次 3: Playground 子资源

| #   | 路由文件                                             | 包装器模式                                                |
| --- | ---------------------------------------------------- | --------------------------------------------------------- |
| 7   | `src/app/api/playgrounds/[id]/join/route.ts`         | `createRoute` + `.auth()`                                 |
| 8   | `src/app/api/playgrounds/[id]/leave/route.ts`        | `createRoute` + `.auth()`                                 |
| 9   | `src/app/api/playgrounds/[id]/members/route.ts`      | `createRoute` + `.auth()`                                 |
| 10  | `src/app/api/playgrounds/[id]/invite-codes/route.ts` | `createRoute` + `.auth()` + `.requireRole("OWNER", "id")` |

**每步验证：** `pnpm build` 通过

---

### 任务 E: 邀请码解析端点 + 修复 O(n) 反模式

**负责人：** **\_\_\_\_** | **预计时间：** 45min

**问题：** `JoinPlayGroundPage.handleJoinByCode` 遍历用户所有 playground，对每个 playground 调用 `POST /api/playgrounds/[id]/join` 来匹配邀请码 — O(n) HTTP 请求循环。

**新增文件：**

- `src/app/api/playgrounds/resolve/route.ts`
  - 端点：`GET /api/playgrounds/resolve?code=XXXX`
  - 逻辑：`prisma.inviteCode.findUnique({ where: { code } })` → 返回 playground 信息
  - 使用 `createRoute` 包装器

**修复文件：**

- `src/app/(dashboard)/playground/join/page.tsx:53-92`
  - 替换 O(n) 循环为单次 `GET /api/playgrounds/resolve?code=XXX`
  - 获得 playgroundId 后调用 `POST /api/playgrounds/[id]/join`

**验证：** `pnpm build` + 手动测试邀请码加入流程

---

### 任务 F: 客户端页面 hook 提取

**负责人：** **\_\_\_\_** | **预计时间：** 1.5h

**新增 hooks：**

| Hook                                 | 封装内容                     | 消费方                       |
| ------------------------------------ | ---------------------------- | ---------------------------- |
| `src/hooks/use-join-playground.ts`   | 邀请码加入 + 公开域加入逻辑  | `playground/join/page.tsx`   |
| `src/hooks/use-create-playground.ts` | 创建 playground + 生成邀请码 | `playground/create/page.tsx` |
| `src/hooks/use-run-summary.ts`       | 跑步记录加载 + 数据转换      | `summary/page.tsx`           |

**页面变化（代表性）：**

| 页面                         | Before                 | After                |
| ---------------------------- | ---------------------- | -------------------- |
| `playground/join/page.tsx`   | 244 行（数据+逻辑+UI） | ~120 行（编排+渲染） |
| `playground/create/page.tsx` | 198 行                 | ~100 行              |
| `summary/page.tsx`           | 301 行                 | ~180 行              |

**验证：** `pnpm build` + 手动验证 3 个页面的关键流程

---

### 任务 G: 测试

**负责人：** **\_\_\_\_** | **预计时间：** 2h

纯函数优先，先易后难。

| 测试文件                                      | 测试对象                                                                             | 类型                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| `src/lib/__tests__/track-calc.test.ts`        | `haversineDistance`, `calcPace`, `formatDuration`, `calcDistance`, `segmentDistance` | 纯函数，无 mock          |
| `src/lib/__tests__/coord-transform.test.ts`   | `wgs84ToGcj02`, `wgs84ToGcj02Point`, `outOfChina` 边界                               | 纯函数，无 mock          |
| `src/lib/__tests__/gps-cache.test.ts`         | key 生成逻辑、数据序列化、空数组处理                                                 | mock Redis client        |
| `src/hooks/__tests__/use-run-tracker.test.ts` | 状态转换、距离累计、配速计算、分段检测                                               | mock geolocation + fetch |

**验证：** `pnpm vitest run` 全部通过

---

## 文件清单

### 新增文件

```
src/lib/route-wrapper.ts
src/app/api/playgrounds/resolve/route.ts
src/hooks/use-join-playground.ts
src/hooks/use-create-playground.ts
src/hooks/use-run-summary.ts
src/lib/__tests__/track-calc.test.ts
src/lib/__tests__/coord-transform.test.ts
src/lib/__tests__/gps-cache.test.ts
src/hooks/__tests__/use-run-tracker.test.ts
```

### 修改文件（代表性）

```
src/lib/gps-cache.ts                     ← 移除 try/catch
src/app/api/runs/[runId]/route.ts        ← 去重 + 包装器
src/app/api/playgrounds/route.ts         ← 包装器
src/app/api/playgrounds/[id]/route.ts    ← 包装器
src/app/api/playgrounds/[id]/join/route.ts ← 包装器
... (其余路由文件同理)
src/app/(dashboard)/playground/join/page.tsx  ← 反模式修复 + hook
src/app/(dashboard)/summary/page.tsx          ← 去重 + hook
src/app/(dashboard)/playground/create/page.tsx ← hook
```

### 不变文件

```
src/middleware.ts        ← 保持轻量 cookie 检查
src/lib/auth.ts          ← better-auth 配置不变
src/lib/prisma.ts        ← 数据库不变
src/lib/redis.ts         ← Redis 连接不变
src/lib/logger.ts        ← 日志基础设施不变（由包装器消费）
src/lib/coord-transform.ts ← 保持独立
src/lib/amap-sdk.ts      ← 保持独立
```

---

## 验证清单

```bash
# 1. 编译检查（每个任务完成后）
pnpm build

# 2. 类型检查
pnpm lint

# 3. 单元测试（任务 G 后）
pnpm vitest run

# 4. 手动回归测试
# □ 登录 → Dashboard
# □ 创建 Playground → 生成邀请码
# □ 通过邀请码加入 Playground
# □ 加入公开 Playground
# □ 查看 Playground 成员
# □ 退出 Playground
# □ 删除 Playground
# □ 开始跑步 → 实时 GPS 追踪 → 暂停 → 恢复 → 停止
# □ 查看跑步汇总（轨迹地图、配速分析、分段详情）
# □ 退出登录

# 5. 样板减少检查
# git diff --stat 应显示显著的删除行数（目标：~500 行样板减少）
```

---

## 预计总工时

| 任务                | 时间     |
| ------------------- | -------- |
| A: track-calc 去重  | 0.5h     |
| B: 路由包装器       | 2h       |
| C: GPS 错误传播     | 0.3h     |
| D: 路由迁移         | 3h       |
| E: 邀请码修复       | 0.8h     |
| F: 客户端 hook 提取 | 1.5h     |
| G: 测试             | 2h       |
| **合计**            | **~10h** |

---

> 🤖 Generated with [Claude Code](https://claude.com/claude-code) · improve-codebase-architecture + grilling skills · 2026-08-09
