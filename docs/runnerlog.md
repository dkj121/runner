# 跑步小程序 — Login + Map 规范记录

---

## 一、登录（Login）

### 1.1 核心流程（3 步）

```
wx.login() → 拿 code
    ↓
POST /auth/login { code } → 后端 code2Session 换 openid → 签发 JWT
    ↓
前端存 token，后续请求带 Authorization: Bearer <token>
```

### 1.2 前端最小实现

```javascript
// utils/auth.js — 全项目唯一调用 wx.login 的地方
export async function login() {
  const { code } = await wx.login()                    // 不设 timeout
  const res = await request('/auth/login', { code })
  return res.data                                      // { token }
}
```

```javascript
// app.js
setToken(token) {
  this.globalData.token = token
  wx.setStorageSync('token', token)
}

clearToken() {
  this.globalData.token = ''
  wx.removeStorageSync('token')
}
```

```javascript
// request.js — 拦截层
const token = getApp().globalData.token
header.Authorization = `Bearer ${token}`

if (res.statusCode === 401) {
  getApp().clearToken()
  wx.reLaunch({ url: '/pages/login/login' })
}
```

### 1.3 后端最小实现

```javascript
// POST /auth/login
const { openid, session_key } = await code2Session(code)   // 调微信接口
let user = await db.findOne({ openid })
if (!user) user = await db.create({ openid })

// session_key 存后端，绝不下发给前端
await redis.set(`ssk:${openid}`, session_key, 'EX', 7200)

const token = jwt.sign({ uid: user._id }, SECRET, { expiresIn: '7d' })
res.json({ code: 1, data: { token } })
```

### 1.4 Token 过期无感刷新（跑步场景必要）

跑步中 token 过期不能踢回登录页，必须无感刷新：

```javascript
let isRefreshing = false
let queue = []

async function refreshToken() {
  if (!isRefreshing) {
    isRefreshing = true
    try {
      const { code } = await wx.login()
      const { data } = await rawRequest('/auth/refresh', { code })
      const newToken = data.token
      getApp().setToken(newToken)
      queue.forEach(resolve => resolve(newToken))
      return newToken
    } finally {
      isRefreshing = false
      queue = []
    }
  }
  return new Promise(resolve => queue.push(resolve))
}
```

---

## 二、Map 组件

### 2.1 基础骨架

```xml
<map
  id="runMap"
  latitude="{{center.lat}}"
  longitude="{{center.lng}}"
  scale="16"
  markers="{{markers}}"
  polyline="{{polyline}}"
  show-location
  show-compass
  enable-rotate="{{false}}"
/>
```

### 2.2 跑步场景核心用法

#### （1）绘制跑步路线

```javascript
// data
polyline: [{
  points: [],           // [{latitude, longitude}, ...]
  color: '#FF4500',     // 路线颜色
  width: 6,             // 线宽
  dottedLine: false,    // 实线
  arrowLine: true,      // 更流畅（2.28.0+）
  borderColor: '#fff',  // 描边
  borderWidth: 1
}]

// 跑步中实时追加点位
this.data.polyline[0].points.push({ latitude, longitude })
this.setData({ polyline: this.data.polyline })  // 全量更新
```

#### （2）实时位置更新

```javascript
// 启动位置监听（替代轮询 getLocation）
wx.startLocationUpdate({
  success: () => {
    wx.onLocationChange(res => {
      const { latitude, longitude, speed, accuracy } = res
      // 追加轨迹点、更新中心
      this.appendPoint({ latitude, longitude })
    })
  }
})

// 结束跑步
wx.stopLocationUpdate()
wx.offLocationChange()
```

#### （3）标记起终点

```javascript
markers: [
  { id: 1, latitude: startLat, longitude: startLng,
    iconPath: '/images/start.png', width: 36, height: 42,
    label: { content: '起', color: '#fff', bgColor: '#07c160',
             fontSize: 12, borderRadius: 10, padding: 2, anchorY: -25 }
  },
  { id: 2, latitude: endLat, longitude: endLng,
    iconPath: '/images/end.png', width: 36, height: 42,
    label: { content: '终', color: '#fff', bgColor: '#ee0a24',
             fontSize: 12, borderRadius: 10, padding: 2, anchorY: -25 }
  }
]
```

#### （4）自动适配视野

```javascript
// 跑步结束后，让整条路线完整显示在地图上
const points = this.data.polyline[0].points
const mapCtx = wx.createMapContext('runMap')
mapCtx.includePoints({
  points,
  padding: [40, 40, 40, 40]
})
```

### 2.3 性能优化（跑步场景关键）

```javascript
// ❌ 错误：每秒全量更新 polyline（800 个点后明显卡顿）
setInterval(() => {
  polyline[0].points.push(newPoint)
  this.setData({ polyline })          // 每次都序列化全部点
}, 1000)

// ✅ 正确：分段更新
// 方案1：降低更新频率
this.trackPoints.push(newPoint)
if (this.trackPoints.length % 5 === 0) {   // 每 5 个点更新一次
  this.setData({ polyline })
}

// 方案2：抽稀（Douglas-Peucker），结束时补全
function simplify(points, epsilon = 0.0001) { /* ... */ }

// 方案3：累计一段时间再批量追加
setInterval(() => {
  const batch = this.buffer.splice(0)
  if (batch.length) this.setData({ polyline })
}, 2000)
```

### 2.4 跑步数据精度

```javascript
// startLocationUpdate 比 getLocation 省电且精度更高
// 用于跑步记录时配置高精度
wx.startLocationUpdate({
  type: 'gcj02'           // 国内必用 gcj02
})

// 记录精度筛选：剔除漂移点
function isValidPoint(prev, curr) {
  const dist = haversine(prev, curr)   // 米
  return dist > 3 && dist < 30         // 排除静止漂移和 GPS 跳点
}
```

### 2.5 背景定位（跑步中切后台）

```json
// app.json
{
  "requiredBackgroundModes": ["location"]
}
```

```javascript
// 跑步切后台继续记录
wx.startLocationUpdateBackground({
  success() { /* 后台持续回调 onLocationChange */ }
})
```

---

## 三、踩过的坑

### 3.1 Login

| # | 坑 | 正确做法 |
|---|----|---------|
| 1 | `wx.login` 设了 `timeout`，弱网超时 | **不设 timeout**，微信底层自带重试 |
| 2 | code 复用导致 `40029 invalid code` | code **一次性**，刷新 token 要重新 `wx.login()` |
| 3 | `session_key` 下发到前端 | **绝不下发**，只存后端 |
| 4 | `getPhoneNumber` 在个人主体小程序无效 | 个人无此权限，用于手输 + 短信验证 |
| 5 | 401 散落在各页面处理，有的漏了 | **request 拦截层统一处理**，一处跳转 |
| 6 | 跑步中 token 过期弹出登录页 | 跑步中做**无感刷新**，禁止跳转 |

### 3.2 Map

| # | 坑 | 正确做法 |
|---|----|---------|
| 1 | `iconPath` 写相对路径，真机不显示 | 用 **绝对路径** `/images/xxx.png` |
| 2 | `wgs84` 坐标直接给地图，偏移几百米 | 小程序地图用 **gcj02** |
| 3 | 每秒全量 `setData({ polyline })`，5 分钟后卡顿 | **抽稀** 或降到每 3~5 个点更新一次 |
| 4 | 真机地图空白 | 后台配合法域名 `apis.map.qq.com` |
| 5 | `onLocationChange` 不回调 | `app.json` 声明 `permission.scope.userLocation` |
| 6 | `polyline[0].points.push()` 后 setData 不生效 | 浅拷贝后再 setData：`[...points, newPoint]` |
| 7 | 跑步记录本地缓存被系统清理 | 每公里/每分钟**上传后端**，本地仅做恢复 |

---

## 四、跑步场景最低配置清单

```json
// app.json
{
  "permission": {
    "scope.userLocation": {
      "desc": "记录跑步轨迹需要获取您的位置信息"
    }
  },
  "requiredBackgroundModes": ["location"]
}
```

```
// 小程序后台 → 开发管理 → 服务器域名
request 合法域名：  https://your-api.com
                     https://apis.map.qq.com
socket 合法域名：    wss://your-api.com
uploadFile 合法域名：https://your-api.com
```

---

## 五、一个完整的跑步页骨架

```javascript
// pages/run/run.js
Page({
  data: {
    center:  { lat: 39.9, lng: 116.4 },
    scale:   17,
    markers: [],
    polyline: [{ points: [], color: '#FF4500', width: 6, arrowLine: true }],
    distance: '0.00',
    duration: '00:00',
    pace:    '--\'--"',
  },

  onLoad() {
    this._points = []      // 全量点（结束抽稀用）
    this._displayIndex = 0 // 已渲染的最后一个点索引
    this._timer = null
    this._startTime = 0
  },

  startRun() {
    this._startTime = Date.now()
    this._timer = setInterval(() => this.updateTimer(), 1000)

    wx.startLocationUpdate({
      success: () => {
        wx.onLocationChange(res => {
          const p = { latitude: res.latitude, longitude: res.longitude }
          this._points.push(p)
          // 每3个点更新一次视图
          if (this._points.length - this._displayIndex >= 3) {
            this.renderTrack()
          }
        })
      },
      fail: () => wx.showToast({ title: '请开启位置权限', icon: 'none' })
    })
  },

  renderTrack() {
    const display = this._points
    this._displayIndex = display.length
    this.setData({
      center: display[display.length - 1],
      'polyline[0].points': [...display]
    })
    this.updateStats(display)
  },

  stopRun() {
    wx.stopLocationUpdate()
    wx.offLocationChange()
    clearInterval(this._timer)
    // 抽稀并适配视野
    const simplified = douglasPeucker(this._points, 0.00003)
    this.setData({ 'polyline[0].points': simplified })
    const mapCtx = wx.createMapContext('runMap')
    mapCtx.includePoints({ points: simplified, padding: [40,40,40,40] })
    // 上传后端
    this.uploadRun(simplified)
  },

  updateStats(points) { /* 距离、配速计算 */ },
  updateTimer() { /* 计时器 */ },
})
```

---

## 六、坐标系速查

| 坐标系 | 用于 | 来源 |
|--------|------|------|
| `gcj02` | 小程序 map 组件 | 微信底层腾讯地图 |
| `gcj02` | `wx.getLocation`（默认 type） | 微信 SDK |
| `gcj02` | `wx.chooseLocation` 返回值 | 微信 SDK |
| `wgs84` | 服务端存 GPS 原始值 | 第三方设备 |
| 百度 BD-09 | ❌ 小程序不支持 | - |

**规则**：前端地图全部用 `gcj02`，后端存储统一为 `wgs84`，转换在服务端完成。

```javascript
// 服务端转换（如果设备上报的是 wgs84）
// npm install coordtransform
const coord = require('coordtransform')
const gcj = coord.wgs84togcj02(lng, lat)
```
