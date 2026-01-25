# Personal Feed

每日个人信息流系统 - 自动抓取 Hacker News 热门文章，通过 LLM 生成摘要和评分。

## 功能特点

- **自动抓取** - 每日定时抓取 Hacker News 热门文章
- **智能摘要** - 通过 LLM 生成一句话摘要和详细摘要
- **评分系统** - 根据内容质量自动评分（0-100）
- **标签分类** - 自动生成 3-6 个相关标签
- **低成本** - 使用 Cloudflare Workers 免费套餐，LLM 成本可控

## 系统架构

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
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  React 前端     │
                                  │  (静态页面)     │
                                  └─────────────────┘
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Cloudflare Workers + D1 (SQLite) + Cron Triggers |
| 前端 | React 19 + TypeScript + Vite |
| 文章抓取 | Jina Reader |
| 摘要生成 | DeepSeek API（兼容 OpenAI 格式） |
| 数据源 | Hacker News Firebase API |

## 项目结构

```
PersonalFeed/
├── worker/           # 后端 - Cloudflare Worker
│   ├── src/          # 源代码
│   ├── schema.sql    # 数据库结构
│   └── wrangler.toml # 配置文件
├── web/              # 前端 - React 应用
│   ├── src/          # 源代码
│   └── vite.config.ts
├── CLAUDE.md         # 开发规范文档
└── README.md         # 本文件
```

## 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账户
- DeepSeek API Key（或其他兼容 OpenAI 格式的 LLM）

### 后端部署

```bash
cd worker

# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create daily-feed-db

# 更新 wrangler.toml 中的 database_id

# 初始化数据库
npm run db:init:remote

# 设置 API Key
npx wrangler secret put LLM_API_KEY

# 部署
npm run deploy
```

### 前端部署

```bash
cd web

# 安装依赖
npm install

# 本地开发
npm run dev

# 构建生产版本
npm run build
```

## 本地开发

### 后端

```bash
cd worker

# 安装依赖
npm install

# 初始化本地数据库
npm run db:init

# 启动开发服务器
npm run dev

# 测试 API
curl http://localhost:8787/api/health
curl http://localhost:8787/api/feed/today
```

### 前端

```bash
cd web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## API 接口

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/feed/today` | GET | 获取今日文章 |
| `/api/feed?date=YYYY-MM-DD` | GET | 获取指定日期文章 |
| `/api/admin/refresh` | POST | 手动触发抓取 |

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM API 地址 |
| `LLM_MODEL` | `deepseek-chat` | 模型名称 |
| `HN_LIMIT` | `30` | 每次抓取文章数量 |
| `MAX_ARTICLE_CHARS` | `12000` | 文章内容截断长度 |

### Cron 配置

默认每天 UTC 00:05（北京时间 08:05）自动抓取。

## 成本估算

- **Cloudflare Workers**: 免费套餐足够（每日 100,000 请求）
- **D1 数据库**: 免费套餐足够（5GB 存储）
- **DeepSeek API**: 约 ¥0.1-0.3/天（30 篇文章）

## 更换 LLM 提供商

系统使用 OpenAI 兼容格式，可以轻松切换到其他提供商：

1. 修改 `wrangler.toml` 中的 `LLM_BASE_URL` 和 `LLM_MODEL`
2. 重新设置 `LLM_API_KEY`
3. 重新部署

支持的提供商：OpenAI、DeepSeek、Moonshot、通义千问等。

## License

MIT
