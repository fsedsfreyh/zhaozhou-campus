# 昭州校园社区

昭州中学校内专属社区网站，对标国内成熟高校校园墙的高端校园社区平台。

## 技术栈

- **前端**: 原生 HTML/CSS/JS SPA（单页应用）
- **设计**: 毛玻璃拟态 + 校园实景背景 + 视差滚动
- **后端**: Supabase（认证 + 数据库 + 存储 + RLS）
- **部署**: GitHub Pages + Supabase

## 功能特性

### 核心板块
- 💌 表白墙
- 🔍 失物招领
- 🌲 匿名树洞
- ❓ 校园问答
- 🎭 社团招新
- 💼 校内兼职
- 🏠 租房转租
- 🚗 拼车拼单
- 📢 校园通知
- 🏫 校园周边

### 基础互动
- 多图上传（最多9张）
- 点赞/取消点赞
- 收藏/取消收藏
- 评论与回复
- 链接一键分享
- 帖子举报
- 单条帖子独立关闭评论区

### 匿名机制
- 支持匿名/实名两种发帖模式
- 前端完全隐藏匿名发布者身份
- 后台完整留存发布记录（账号、IP、时间）

### 内容审核
- 违禁词自动拦截过滤
- 管理员人工复核
- 批量处理违规内容
- 举报系统

### 管理员后台
- 数据概览
- 帖子管理（置顶/隐藏/溯源）
- 举报处理
- 违禁词库编辑
- 公告轮播管理
- 用户管理（封禁/解封）

### 附加功能
- 用户拉黑指定他人
- 每日/每周热帖榜单
- 首页公告轮播
- 全站搜索

## 部署步骤

### 1. Supabase 项目配置

1. 在 [supabase.com](https://supabase.com) 创建项目
2. 在项目 Settings → API 中获取 `URL` 和 `anon key`
3. 打开项目 SQL Editor，执行 `supabase-schema.sql`
4. 在项目 Storage 中创建 `images` 桶，设为公开
5. （可选）配置 Authentication 中的邮箱验证

### 2. 前端配置

1. 修改 `js/supabase.js` 中的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
2. 替换 `images/school-bg.jpg` 为校园实景照片

### 3. 部署 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 仓库 Settings → Pages → Source: Deploy from a branch
3. 选择 `main` 分支，`/ (root)` 目录
4. 添加 `.nojekyll` 文件（已包含）

### 4. 创建管理员账号

1. 注册一个新账号
2. 在 Supabase Table Editor 中，将 `profiles` 表中该用户的 `role` 字段改为 `admin`

## 项目结构

```
├── index.html              # SPA 入口
├── admin.html              # 管理后台
├── COMMUNITY_CONVENTION.md # 社区公约
├── ARCHITECTURE.md         # 架构文档
├── supabase-schema.sql     # 数据库建表 SQL
├── images/
│   └── school-bg.jpg       # 校园背景图
├── css/
│   └── style.css           # 样式表
└── js/
    ├── supabase.js         # Supabase 客户端
    ├── utils.js            # 工具函数
    ├── router.js           # 路由
    ├── auth.js             # 认证
    ├── posts.js            # 帖子
    ├── comments.js         # 评论
    ├── admin.js            # 管理后台
    └── app.js              # 应用入口
```
