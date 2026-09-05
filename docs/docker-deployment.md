# Docker 部署指南

本文档说明如何使用 Docker 和 Docker Compose 部署 Runner 应用。

## 前置要求

- Docker 27.0+
- Docker Compose 2.0+
- 外部 MySQL 8.4+ 数据库（不包含在 compose 配置中）

## 快速开始

### 1. 环境配置

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入实际配置：

```bash
# MySQL 数据库连接（必需）
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_NAME=runner
MYSQL_URL=mysql://user:password@host:3306/runner

# Redis 密码（必需，不能使用默认值）
REDIS_PASSWORD=your_secure_redis_password

# Better Auth 密钥（必需，32字符以上）
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://your_domain:3000

# Resend API 密钥（必需，用于邮件验证）
RESEND_API_KEY=re_your_api_key

# 高德地图密钥（必需）
NEXT_PUBLIC_AMAP_KEY=your_amap_key
NEXT_PUBLIC_AMAP_SECURITY_CODE=your_security_code
```

**重要安全提示**：
- `REDIS_PASSWORD` 必须显式设置，不接受空值
- 在生产环境中使用强密码（至少 16 个随机字符）
- 切勿在版本控制中提交 `.env` 文件

### 2. 数据库迁移

在首次部署前，需要应用 Prisma 迁移：

```bash
# 使用本地 pnpm（推荐）
pnpm prisma:deploy

# 或使用 Docker 临时容器
docker run --rm -v $(pwd):/app -w /app \
  --env-file .env \
  node:22-alpine sh -c "npm install -g pnpm && pnpm prisma:deploy"
```

### 3. 生产环境部署

```bash
# 构建并启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 停止并删除数据卷
docker compose down -v
```

应用将在 `http://localhost:3000` 可用。

### 4. 开发环境部署（带调试）

```bash
# 使用调试配置启动
docker compose -f compose.debug.yaml up -d

# 查看日志
docker compose -f compose.debug.yaml logs -f runner
```

开发模式特性：

- 热重载（代码变更自动生效）
- Node.js 调试器监听 `0.0.0.0:9229`
- Turbopack 开发服务器
- 源代码挂载为卷

## 架构说明

### 多阶段构建

`Dockerfile` 使用三阶段构建优化镜像大小：

1. **deps**：安装依赖 + 生成 Prisma 客户端
2. **builder**：构建 Next.js 应用（standalone 输出）
3. **runner**：最小运行时镜像（仅包含必需文件）

最终镜像大小：~150MB（对比单阶段构建 ~800MB）

### 服务组成

#### 生产环境 (compose.yaml)

- **redis**：Redis 7 Alpine，带密码保护和健康检查
- **runner**：Next.js 应用容器，依赖 Redis 健康后启动

#### 开发环境 (compose.debug.yaml)

- **redis**：同生产配置
- **runner**：开发模式，代码挂载 + 调试端口

### 网络拓扑

```
[MySQL External] ←→ [runner-app] ←→ [redis]
                          ↓
                     (0.0.0.0:3000)
```

所有服务在 `runner-network` 桥接网络中通信。

## 健康检查

### Redis

```bash
# 容器内检查
docker exec runner-redis redis-cli -a your_password ping

# 预期输出：PONG
```

### Runner 应用

应用暴露健康检查端点（需要实现）：

```bash
curl http://localhost:3000/api/health
```

Docker Compose 会自动执行健康检查，状态可通过以下命令查看：

```bash
docker compose ps
```

## 数据持久化

### Redis 数据

Redis 数据存储在 Docker 命名卷 `redis_data` 中：

```bash
# 查看卷信息
docker volume inspect runner_redis_data

# 备份 Redis 数据
docker exec runner-redis redis-cli -a your_password SAVE
docker cp runner-redis:/data/dump.rdb ./backup/

# 恢复 Redis 数据
docker cp ./backup/dump.rdb runner-redis:/data/
docker compose restart redis
```

### MySQL 数据

MySQL 由外部管理，请按照您的数据库备份策略操作。

## 日志管理

### 查看日志

```bash
# 所有服务
docker compose logs -f

# 特定服务
docker compose logs -f runner
docker compose logs -f redis

# 最近 100 行
docker compose logs --tail=100 runner
```

### 日志轮转

生产环境建议配置 Docker 日志驱动：

```yaml
# 在 compose.yaml 中添加
services:
  runner:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 故障排查

### 容器无法启动

```bash
# 检查容器状态
docker compose ps

# 查看详细日志
docker compose logs runner

# 检查环境变量
docker compose config
```

### 数据库连接失败

```bash
# 测试 MySQL 连接
docker exec runner-app sh -c 'nc -zv $MYSQL_HOST $MYSQL_PORT'

# 检查环境变量
docker exec runner-app env | grep MYSQL
```

### Redis 连接失败

```bash
# 检查 Redis 容器
docker compose ps redis

# 测试连接
docker exec runner-redis redis-cli -a your_password ping
```

### 端口冲突

如果端口 3000 或 6379 已被占用：

```bash
# 修改 .env 文件
REDIS_PORT=6380

# 修改 compose.yaml 中 runner 的端口映射
ports:
  - "3001:3000"
```

## 性能优化

### 生产环境优化

1. **启用 Redis 持久化**：

   ```yaml
   services:
     redis:
       command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
   ```

2. **调整 Node.js 内存限制**：

   ```yaml
   services:
     runner:
       environment:
         NODE_OPTIONS: "--max-old-space-size=2048"
       deploy:
         resources:
           limits:
             memory: 2G
   ```

3. **使用外部网络**（与其他服务共享）：
   ```yaml
   networks:
     runner-network:
       external: true
       name: shared_network
   ```

## 安全建议

1. **必须设置所有必需的环境变量**
   - `REDIS_PASSWORD` 不再有默认值，必须显式提供
   - 使用强密码：`openssl rand -base64 32`
2. **定期更新 Docker 镜像**：
   ```bash
   docker compose pull
   docker compose up -d
   ```
3. **限制容器权限**：已配置非 root 用户（nextjs:nodejs）
4. **使用 secrets 管理敏感信息**（Docker Swarm/Kubernetes）
5. **配置防火墙规则**，仅暴露必要端口
6. **不要在日志或错误响应中暴露敏感信息**
   - 健康检查端点返回通用错误消息
   - 详细错误仅记录在服务器日志中

## 更新部署

### 零停机更新（需要负载均衡器）

```bash
# 构建新镜像
docker compose build runner

# 滚动更新
docker compose up -d --no-deps --build runner
```

### 回滚

```bash
# 查看镜像历史
docker images runner

# 使用旧镜像标签重新部署
docker compose down
docker tag runner:old runner:latest
docker compose up -d
```

## 监控集成

建议集成以下监控方案：

- **Prometheus + Grafana**：指标收集和可视化
- **Loki**：日志聚合
- **Uptime Kuma**：服务可用性监控

示例 Prometheus 配置：

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "runner"
    static_configs:
      - targets: ["runner:3000"]
```

## 附录

### 常用命令速查

```bash
# 启动
docker compose up -d

# 重启特定服务
docker compose restart runner

# 查看资源使用
docker stats

# 进入容器 Shell
docker exec -it runner-app sh

# 清理未使用资源
docker system prune -a
```

### 环境变量完整列表

| 变量                             | 必需 | 默认值                | 说明                     |
| -------------------------------- | ---- | --------------------- | ------------------------ |
| `MYSQL_HOST`                     | ✓    | -                     | MySQL 主机地址           |
| `MYSQL_PORT`                     | ✗    | 3306                  | MySQL 端口               |
| `MYSQL_USER`                     | ✓    | -                     | MySQL 用户名             |
| `MYSQL_PASSWORD`                 | ✓    | -                     | MySQL 密码               |
| `MYSQL_NAME`                     | ✓    | -                     | 数据库名                 |
| `MYSQL_URL`                      | ✓    | -                     | Prisma 连接字符串        |
| `REDIS_PASSWORD`                 | ✓    | -                     | Redis 密码（必须显式设置）|
| `REDIS_PORT`                     | ✗    | 6379                  | Redis 端口               |
| `REDIS_DB`                       | ✗    | 0                     | Redis 数据库索引         |
| `BETTER_AUTH_SECRET`             | ✓    | -                     | Auth 签名密钥（≥32字符） |
| `BETTER_AUTH_URL`                | ✗    | http://localhost:3000 | Auth 回调 URL            |
| `RESEND_API_KEY`                 | ✓    | -                     | Resend API 密钥          |
| `NEXT_PUBLIC_AMAP_KEY`           | ✓    | -                     | 高德地图 Key             |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | ✓    | -                     | 高德安全密钥             |
