# Daily Personal Feed MVP (HN) - Claude Code 任务规格

## 目标
构建一个 **每日个人信息流** 系统，要求：
- 每天抓取 Hacker News 的热门文章（默认抓取 30 条）。
- 为每条文章抓取正文、生成两种总结（简洁总结和论文摘要式总结）、打分（0-100）并生成标签。
- 将结果存入 **Cloudflare D1** 数据库。
- 提供一个只读的 API 以供前端获取当天的信息流。
- 没有聊天交互，避免用户消耗 LLM 额度，只在每天的定时任务中调用 LLM。

本 MVP 优先考虑：
- 简单（今天就能完成）
- 控制成本（LLM 调用仅在定时任务或手动刷新时触发）
- 结果稳定（稳定的输出格式，一致的评分标准）

## 技术栈
- 后端：Cloudflare Workers + D1 (SQLite) + Cron Triggers
- 前端：Vite + React 部署到 GitHub Pages
- 外部数据：
  - Hacker News 官方 API（Firebase）
  - Jina Reader（`https://r.jina.ai/http(s)://...`）用来获取文章正文
- LLM：OpenAI 兼容接口

## 后端功能
1) **定时任务（Cron）**
   - 每天获取 Hacker News 的热门文章 ID。
   - 获取每条文章的详情。
   - 筛选出带有 URL 和标题的文章。
   - 获取文章正文通过 Jina Reader。
   - 调用 OpenAI 生成：
     - 一句话总结（`summary_short`，<= 50 字）
     - 论文摘要式总结（`summary_long`，<= 200 字）
     - global_score（0-100，浮动评分）
     - 标签（3-6 个标签）
   - 将结果存入 D1 数据库（使用 upsert）

2) **公开 API**
   - `GET /api/feed?date=YYYY-MM-DD`：返回指定日期的文章信息流，按照 `global_score` 降序排列。
   - `GET /api/feed/today`：返回今天的文章信息流（日期由后端计算，使用东京时区）。
   - `GET /api/health`：健康检查接口。

3) **手动刷新（可选）**
   - `POST /api/admin/refresh`：手动触发抓取文章并刷新数据库内容。此接口只能被开发者访问，使用 SECRET Token 来保护。

**不需要登录系统**。

## 非功能性需求
- **成本控制**
  - 限制正文长度：每篇文章发送给 LLM 之前，正文最大长度为 `MAX_ARTICLE_CHARS`（例如 12000）。
  - 使用较低的温度（0-0.2），确保模型输出稳定。
  - 固定 `max_tokens`（例如 350）。

- **健壮性**
  - 所有 HTTP 请求都要做好超时和重试处理（包括 HN API、Jina Reader 和 OpenAI API）。
  - 如果正文抓取失败，则回退使用标题 + HN 内容。
  - 如果 LLM 处理失败，标记该条数据为错误并跳过。

- **幂等性**
  - 如果多次触发相同日期的抓取任务，不应重复插入相同数据，而是更新已存在的数据。

- **安全性**
  - 不在客户端存储 API 密钥。
  - CORS：公开 API 可以设置只允许来自 GitHub Pages 的请求，或全开放。

- **可观察性**
  - 记录日志：记录每次抓取的文章 ID、处理成功/失败数量。
  - 每次抓取任务结束时，记录一次 `ingestion_run` 日志（可选，简单地记录每次运行的时间戳）。

## 项目结构（后端）
- /worker
  - src/
    - index.ts              # 路由和请求处理
    - env.ts                # 环境变量解析与默认值设置
    - hn.ts                 # Hacker News API 客户端
    - reader.ts             # Jina Reader 获取正文
    - llm.ts                # OpenAI 客户端与 prompt 构建
    - score.ts              # 标签和评分的帮助函数
    - db.ts                 # D1 数据库操作
    - ingest.ts             # 数据抓取与处理
    - types.ts              # 公共数据类型定义
    - utils.ts              # 重试、超时、日期等工具函数
  - schema.sql              # D1 数据库表结构
  - wrangler.toml           # 配置文件（Worker + D1 + Cron）
  - README.md               # 部署步骤与本地开发指南

## API 设计
### `GET /api/feed?date=YYYY-MM-DD`
返回当天日期的数据（按 global_score 降序排列）。

响应：
```json
{
  "date": "2026-01-25",
  "count": 30,
  "items": [
    {
      "hn_id": 123,
      "title": "...",
      "url": "https://...",
      "domain": "example.com",
      "by": "author",
      "hn_score": 256,
      "descendants": 88,
      "hn_time": 1700000000,
      "fetched_at": "2026-01-25T00:01:02Z",
      "summary_short": "…",
      "summary_long": "…",
      "global_score": 82,
      "tags": ["ai", "devtools", "security"],
      "status": "ok" | "error",
      "error_reason": null | "..."
    }
  ]
}
````

### `GET /api/feed/today`

同 `GET /api/feed?date=YYYY-MM-DD`，但日期由服务器自动计算（上海时区）。

### `GET /api/health`

返回版本号和时间戳。

### `POST /api/admin/refresh`（可选）

此接口用于手动触发抓取任务。

请求：

```json
{
  "date": "2026-01-25",
  "limit": 30
}
```

响应：

```json
{ "ok": true, "date": "2026-01-25", "ingested": 30, "failed": 2 }
```

## 定时任务（Cron）

* 每天固定时间触发（建议 UTC 时间）。
* `getShanghaiDateISO(nowUTC)`：获取上海时区的当前日期（格式：YYYY-MM-DD）。

## 数据库表设计（D1）

表：`items`

* `hn_id INTEGER PRIMARY KEY`
* `date TEXT NOT NULL`
* `title TEXT NOT NULL`
* `url TEXT`
* `domain TEXT`
* `by TEXT`
* `hn_score INTEGER`
* `descendants INTEGER`
* `hn_time INTEGER`
* `fetched_at TEXT`
* `summary_short TEXT`
* `summary_long TEXT`
* `global_score REAL`
* `tags TEXT`（JSON 字符串）
* `status TEXT NOT NULL DEFAULT 'ok'`
* `error_reason TEXT`
* `updated_at TEXT NOT NULL`

索引：

* `CREATE INDEX idx_items_date ON items(date);`
* `CREATE INDEX idx_items_date_score ON items(date, global_score);`

## 数据抓取流程

1. 获取 Hacker News 项目 ID。
2. 获取项目详情，检查是否有 URL 和标题。
3. 获取正文内容，调用 Jina Reader。
4. 调用 OpenAI 生成摘要和打分。
5. 存入 D1 数据库（使用 upsert）。

错误处理：

* 如果正文抓取失败：使用标题 + 文章文本（如果有）作为回退。
* 如果 LLM 生成失败，存入 `status='error'`，并记录错误原因。

## 部署步骤

1. 创建 D1 数据库，并应用 `schema.sql`。
2. 配置 `wrangler.toml` 文件，包括 D1 绑定和 Cron 配置。
3. 设置环境变量：

   * `OPENAI_API_KEY`
   * `OPENAI_MODEL`
   * `HN_LIMIT`
   * `MAX_ARTICLE_CHARS`
   * `MAX_OUTPUT_TOKENS`
   * `TEMPERATURE`
4. 部署 Worker。
5. 验证：

   * `GET /api/health`
   * `POST /api/admin/refresh` （使用 Token 进行验证）
   * `GET /api/feed/today` 返回结果。

````

---

## 2) 提示词（Prompt）

### 系统提示词（System Prompt）

```text
你是一名中文信息流编辑和评审员。你的任务是根据给定的文章内容，生成 **简洁的一句话总结** 和 **详细的论文摘要式总结**。同时，你需要给每篇文章一个 **0-100 的全局评分**，并生成 **3-6 个相关的主题标签**。输出必须是标准化的 JSON 格式，只包含 `summary_short`（一句话总结）、`summary_long`（论文摘要式总结）、`global_score`、`tags` 字段，不允许输出任何其他文本或解释。
````

### 用户提示词（User Prompt）

```text
请根据以下文章生成总结和评分。

【材料】
标题: {title}
来源: {domain}
链接: {url}
正文（可能截断）:
{content}

【输出要求】
1. 一句话总结（`summary_short`）：一句简洁的中文总结，尽量把文章的核心内容凝练成一句话，长度 <= 50 字。
2. 论文摘要式总结（`summary_long`）：详细的中文摘要，长度 <= 200 字。
3. 全局评分（`global_score`）：给这篇文章打一个 0-100 的分数，越高代表越值得阅读。
4. 生成标签（`tags`）：3-6 个与文章主题相关的标签，使用小写英文词语（如 `ai`, `security`, `tech`）。

评分规则：
- 90-100：高信息密度、创新性强、可操作性强，适合技术读者。
- 70-89：有一定的价值或新信息。
- 50-69：一般性资讯或讨论。
- 0-49：内容贫乏或不可靠。
```

### 后端 LLM 输出结构（强约束 JSON）

```json
{
  "summary_short": "这篇文章讨论了 AI 在 Web 开发中的应用，重点介绍了工具和框架。",
  "summary_long": "本文详细分析了人工智能在 Web 开发中的应用，重点介绍了当前市场上最流行的 AI 工具与框架，并讨论了它们如何帮助开发者提高效率，节省时间，降低错误率。",
  "global_score": 85,
  "tags": ["ai", "web", "devtools", "ml"]
}
```

## 开发说明

及时提交代码, 系统架构或设计有变更及时更新本文档以及参考中其他相关文档。

实现一切从简,完成功能的基础上不要添加不必要的功能或复杂性。

开发完某项功能及时在本文件更新开发状态, 包括功能描述, 实现方式, 测试方法等。

这个项目将会开源,请不要将任何密钥等敏感信息放到代码或 git 提交里, 包括但不限于:

* OpenAI API 密钥
* HN API 密钥
* 数据库连接字符串
* 其他任何可能泄露敏感信息的配置项
