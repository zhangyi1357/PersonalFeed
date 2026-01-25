# Personal Feed 前端

每日个人信息流系统的前端应用，使用 React + TypeScript + Vite 构建。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具

## 功能

- 展示每日 Hacker News 热门文章
- 按评分排序显示
- 显示文章摘要、评分和标签
- 日期切换
- 响应式设计

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

## 目录结构

```
web/
├── src/
│   ├── App.tsx       # 主应用组件
│   ├── App.css       # 样式文件
│   ├── api.ts        # API 请求封装
│   ├── types.ts      # 类型定义
│   ├── main.tsx      # 入口文件
│   └── index.css     # 全局样式
├── public/           # 静态资源
├── index.html        # HTML 模板
├── vite.config.ts    # Vite 配置
├── tsconfig.json     # TypeScript 配置
└── package.json
```

## 配置

### API 地址

在 `src/api.ts` 中配置后端 API 地址：

```typescript
const API_BASE = 'https://your-worker.workers.dev';
```

### 开发环境

开发时可以使用 Vite 的代理功能避免跨域问题，在 `vite.config.ts` 中配置：

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
```

## 部署

### 静态托管

构建后的 `dist` 目录可以部署到任何静态托管服务：

- Cloudflare Pages
- GitHub Pages
- Vercel
- Netlify

### Cloudflare Pages 部署

```bash
# 构建
npm run build

# 使用 Wrangler 部署
npx wrangler pages deploy dist --project-name=personal-feed
```

## License

MIT
