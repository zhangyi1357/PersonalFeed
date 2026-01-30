# Personal Feed Worker

每日个人信息流系统 - 自动抓取 Hacker News 热门文章，通过 LLM 生成摘要和评分。

## 架构概览

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Hacker News    │────▶│  Cloudflare      │────▶│   D1 Database   │
│  Firebase API   │     │  Worker          │     │   (SQLite)      │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                        ┌────────┴─────────┐
                        ▼                  ▼
               ┌─────────────────┐  ┌─────────────────┐
               │  Jina Reader    │  │  DeepSeek LLM   │
               │  (文章内容抓取)  │  │  (摘要生成)     │
               └─────────────────┘  └─────────────────┘
```

### 数据流程

1. **定时触发** - Cron 每天 UTC 00:05（北京时间 08:05）自动执行
2. **获取热门文章** - 从 HN Firebase API 获取 Top Stories ID 列表
3. **过滤有效文章** - 只处理有 URL 和标题的 story 类型
4. **抓取文章内容** - 通过 Jina Reader 获取文章正文（截断至 12000 字符）
5. **LLM 处理** - DeepSeek 生成一句话摘要、详细摘要、评分（0-100）和标签
6. **存储结果** - Upsert 到 D1 数据库，按日期和评分索引

### 目录结构

```
worker/
├── src/
│   ├── index.ts      # 路由和主入口（API + Cron handler）
│   ├── env.ts        # 环境变量类型和默认配置
│   ├── types.ts      # 公共类型定义
│   ├── hn.ts         # Hacker News API 客户端
│   ├── reader.ts     # Jina Reader 文章抓取
│   ├── llm.ts        # LLM 客户端和 Prompt 定义
│   ├── db.ts         # D1 数据库操作
│   ├── ingest.ts     # 抓取编排逻辑
│   └── utils.ts      # 工具函数
├── schema.sql        # 数据库表结构
├── wrangler.toml     # Cloudflare 配置
└── package.json
```

## API 接口

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查，返回版本和时间戳 |
| `/api/feed/today` | GET | 获取今日文章（上海时区） |
| `/api/feed?date=YYYY-MM-DD` | GET | 获取指定日期文章 |
| `/api/admin/refresh` | POST | 手动触发抓取 |

### 响应示例

```json
{
  "date": "2026-01-25",
  "count": 30,
  "items": [
    {
      "hn_id": 12345,
      "title": "...",
      "url": "https://...",
      "domain": "example.com",
      "summary_short": "一句话摘要",
      "summary_long": "详细摘要...",
      "global_score": 85,
      "tags": "[\"ai\",\"robotics\"]",
      "status": "ok"
    }
  ]
}
```

## 本地开发

### 环境准备

```bash
# 安装依赖
npm install

# 初始化本地数据库
npm run db:init
```

### 启动开发服务器

```bash
npm run dev
```

### 测试命令

```bash
# 健康检查
curl http://localhost:8787/api/health

# 获取今日文章
curl http://localhost:8787/api/feed/today

# 获取指定日期文章
curl "http://localhost:8787/api/feed?date=2026-01-25"

# 手动触发抓取（默认 30 篇）
curl -X POST http://localhost:8787/api/admin/refresh

# 手动触发抓取（指定数量）
curl -X POST http://localhost:8787/api/admin/refresh \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

## 部署

### 首次部署

```bash
# 1. 登录 Cloudflare
npx wrangler login

# 2. 创建 D1 数据库（如果还没创建）
npx wrangler d1 create daily-feed-db

# 3. 更新 wrangler.toml 中的 database_id

# 4. 初始化远程数据库
npm run db:init:remote

# 5. 设置 LLM API Key
npx wrangler secret put LLM_API_KEY

# 6. 部署
npm run deploy
```

### 线上测试

```bash
# 健康检查
curl https://personal-feed.zhangyi2537.workers.dev/api/health

# 获取今日文章
curl https://personal-feed.zhangyi2537.workers.dev/api/feed/today

# 获取今日文章（跳过缓存）
curl 'https://personal-feed.zhangyi2537.workers.dev/api/feed/today?no_cache=1'

# 手动触发抓取
curl -X POST https://personal-feed.zhangyi2537.workers.dev/api/admin/refresh \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# 强制重新生成（忽略已处理的条目，会重新调用 LLM）
curl -X POST https://personal-feed.zhangyi2537.workers.dev/api/admin/refresh \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "force": true}'
```

## 配置说明

### 环境变量（wrangler.toml）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM API 地址 |
| `LLM_MODEL` | `deepseek-chat` | 模型名称 |
| `HN_LIMIT` | `30` | 每次抓取文章数量 |
| `MAX_ARTICLE_CHARS` | `12000` | 文章内容截断长度 |
| `MAX_OUTPUT_TOKENS` | `350` | LLM 输出 token 限制 |
| `TEMPERATURE` | `0.1` | LLM 温度参数 |

### Secrets

| 名称 | 说明 |
|------|------|
| `LLM_API_KEY` | DeepSeek API Key |

### Cron 配置

默认每天 UTC 00:05（北京时间 08:05）执行：

```toml
[triggers]
crons = ["5 0 * * *"]
```

## 注意事项

### 成本控制

- 文章内容截断至 `MAX_ARTICLE_CHARS`（12000 字符）以控制 token 消耗
- 使用低温度（0.1）确保输出稳定
- 固定 `max_tokens`（350）限制输出长度
- 每日仅抓取 30 篇热门文章

### 容错处理

- HTTP 请求带超时（默认 30s，LLM 60s）
- 文章抓取失败时使用标题作为 fallback
- LLM 失败时标记 `status='error'` 并记录原因
- 使用 upsert 避免重复插入

### 数据库

- 主键：`hn_id`（HN 文章 ID）
- 索引：`date` 和 `(date, global_score)` 用于快速查询
- `tags` 字段存储为 JSON 字符串

### 时区

- 数据库中的 `date` 字段使用上海时区（Asia/Shanghai）
- `/api/feed/today` 自动计算上海时区的当前日期

## 常见问题

### Q: 抓取失败怎么办？

查看 Cloudflare Dashboard 的 Worker Logs，检查：
1. LLM_API_KEY 是否正确设置
2. API 配额是否充足
3. 网络连接是否正常

### Q: 如何更换 LLM 提供商？

修改 `wrangler.toml` 中的 `LLM_BASE_URL` 和 `LLM_MODEL`，确保 API 兼容 OpenAI 格式。

### Q: 如何调整评分偏好？

编辑 `src/llm.ts` 中的 `SYSTEM_PROMPT`，修改用户画像和评分规则。

### Q: 为什么 /api/admin/refresh 返回的 ingested 很少？

`ingested` 表示“本次运行里实际重新处理并写入 ok 的条目数量”。如果当天大部分条目已经处理过，会被跳过，所以 `ingested` 可能远小于 `limit`。如需强制全部重跑，使用 `{"force": true}`。

## License

MIT
