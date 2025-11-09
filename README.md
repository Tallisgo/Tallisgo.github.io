# Tallis Blog

基于 Hugo 和 PaperMod 主题的个人博客，支持从 Notion 自动同步内容。

## ✨ 特性

- 🚀 **快速构建**：使用 Hugo 静态网站生成器
- 🎨 **美观主题**：基于 PaperMod 主题，支持明暗模式切换
- 📝 **Notion 同步**：自动从 Notion 数据库同步文章和图片
- 🔍 **全文搜索**：内置搜索功能
- 🏷️ **分类标签**：支持文章分类和标签管理
- 🤖 **自动部署**：GitHub Actions 自动构建和部署到 GitHub Pages

## 📦 技术栈

- [Hugo](https://gohugo.io/) - 静态网站生成器
- [PaperMod](https://github.com/adityatelange/hugo-PaperMod) - Hugo 主题
- [Notion API](https://developers.notion.com/) - 内容同步
- [GitHub Actions](https://github.com/features/actions) - CI/CD

## 🚀 快速开始

### 前置要求

- Node.js 20+
- Hugo Extended 0.150.0+

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
# 启动本地服务器
hugo server -D

# 访问 http://localhost:1313
```

### 从 Notion 同步内容

```bash
# 设置环境变量
export NOTION_TOKEN="your_notion_token"
export NOTION_DATABASE_ID="your_database_id"

# 运行同步脚本
npm run sync-notion
```

## 📁 项目结构

```
.
├── content/          # 博客内容
│   ├── posts/       # 文章目录
│   └── categories/  # 分类索引（自动生成）
├── scripts/         # 脚本文件
│   └── sync_notion.js  # Notion 同步脚本
├── static/          # 静态资源
│   └── images/      # 图片资源
├── themes/          # Hugo 主题
│   └── PaperMod/    # PaperMod 主题
├── hugo.toml        # Hugo 配置文件
└── .github/         # GitHub Actions 工作流
    └── workflows/
        └── hugo.yml # 自动部署配置
```

## ⚙️ 配置

### Hugo 配置

主要配置文件：`hugo.toml`

### Notion 同步配置

在 Notion 数据库中需要以下字段：
- **Title** (title) - 文章标题
- **Category** (select/multi_select) - 文章分类
- **Tags** (multi_select) - 文章标签
- **Status** (select/status) - 文章状态（仅同步 Status = "Done" 的文章）
- **Date** / **Publish Date** (date) - 发布日期
- **Description** (rich_text) - 文章描述（可选）

### GitHub Actions 配置

工作流文件：`.github/workflows/hugo.yml`

支持三种触发方式：
- **Push 到 master 分支**：自动构建和部署
- **手动触发**：在 Actions 页面手动运行
- **定时任务**：每天 UTC 00:00 自动同步 Notion 并部署

## 🔧 功能说明

### 自动分类索引

同步脚本会自动为每个分类创建 `content/categories/{category}/_index.md` 文件，无需手动创建。

### 图片处理

- 自动下载 Notion 中的图片到本地
- 图片保存在 `static/images/posts/` 目录
- 支持多种图片格式（jpg, png, gif, webp, svg）

## 📝 使用说明

### 添加新文章

1. 在 Notion 数据库中创建新页面
2. 填写必要的字段（Title, Category, Tags 等）
3. 将 Status 设置为 "Done"
4. 运行同步脚本或等待定时任务执行

### 自定义分类页面

编辑 `content/categories/{category}/_index.md` 文件，添加自定义内容。

## 🌐 部署

项目使用 GitHub Actions 自动部署到 GitHub Pages。

### 部署流程

1. Push 代码到 master 分支
2. GitHub Actions 自动触发构建
3. 构建成功后自动部署到 GitHub Pages

### 环境变量

在 GitHub 仓库设置中添加以下 Secrets：
- `NOTION_TOKEN` - Notion API Token
- `NOTION_DATABASE_ID` - Notion 数据库 ID

## 📚 相关文档

- [Hugo 文档](https://gohugo.io/documentation/)
- [PaperMod 主题文档](https://github.com/adityatelange/hugo-PaperMod)
- [Notion API 文档](https://developers.notion.com/)

## 📄 许可证

MIT License

## 👤 作者

Tallis

---

⭐ 如果这个项目对你有帮助，欢迎 Star！
