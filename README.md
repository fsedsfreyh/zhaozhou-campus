# 🏫 昭州中学校园网

对标各大高校校园网风格的学生社区平台。基于 GitHub Pages + Supabase 构建，完全免费。

## 功能

- 📱 响应式设计，手机电脑都能用
- 📝 发布动态（图文），支持分类
- 💬 评论互动
- ❤️ 点赞
- 👤 用户注册/登录
- 🔒 安全防护（XSS过滤、RLS策略、IP记录）
- 🏷️ 分类浏览（日常、食堂、学习、社团、八卦、公告、求助）
- 🚩 举报机制

## 部署步骤

### 第一步：创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 并注册/登录
2. 点击 **New Project**
3. 填写项目名称（如 `zhaozhou-campus`）
4. 设置数据库密码（记好它）
5. 选择服务器区域（建议选 Singapore 或 Tokyo）
6. 点击 **Create new project**（等待1-2分钟创建完成）

### 第二步：配置数据库

1. 进入项目 **SQL Editor**
2. 点击 **New Query**
3. 复制 `supabase-schema.sql` 文件中的全部内容粘贴进去
4. 点击 **Run** 执行

### 第三步：配置存储

1. 进入项目 **Storage**
2. 点击 **New Bucket**
3. 名称填 `images`，勾选 **Public bucket**
4. 点击 **Create bucket**

### 第四步：配置认证

1. 进入项目 **Authentication → Settings**
2. 在 **Email Auth** 下，确保允许邮箱注册
3. （可选）如果不需要邮箱验证，关掉 `Confirm email` 开关

### 第五步：获取 API 密钥

1. 进入项目 **Settings → API**
2. 复制 **Project URL**（看起来像 `https://xxx.supabase.co`）
3. 复制 **anon public** 密钥

### 第六步：修改前端配置

**方式一：直接编辑文件（推荐）**
打开 `js/supabase.js`，修改开头的配置：

```js
const SUPABASE_CONFIG = {
  url: 'https://你的项目地址.supabase.co',
  anonKey: '你的anon_key',
  siteName: '昭州中学校园网',
  categories: ['日常', '食堂', '学习', '社团', '八卦', '公告', '求助']
};
```

**方式二：首次访问时在网页中配置**
部署后首次访问网站会自动弹出配置页面，填入上述信息即可。

### 第七步：部署到 GitHub Pages

1. 在 GitHub 创建仓库，名字任意（如 `zhaozhou-campus`）
2. 把整个 `zhaozhou-website` 文件夹的内容推送到仓库
3. 进入仓库 **Settings → Pages**
4. **Source** 选择 **Deploy from a branch**
5. **Branch** 选择 `main`，目录选 `/ (root)`
6. 等待1-2分钟，你的网站就会出现在 `https://你的用户名.github.io/zhaozhou-campus/`

### 第八步：添加学校背景图

1. 把学校照片放到 `images/` 目录下，命名为 `school-bg.jpg` 或 `school-bg.png`
2. 或者直接在 CSS 里设置背景图 URL

## 安全措施

- ✅ **XSS 防护**：所有用户输入都经过 HTML 转义
- ✅ **SQL 注入防护**：Supabase 自动参数化查询
- ✅ **RLS 行级安全**：用户只能操作自己的数据
- ✅ **IP 记录**：记录注册和登录 IP，支持追溯
- ✅ **敏感词过滤**：内置简版敏感词库
- ✅ **文件验证**：上传图片限 5MB，仅允许 JPG/PNG/GIF/WebP
- ✅ **CSP 内容安全策略**：防止外部脚本注入

## 作为学生视角的优化建议

此项目是我（作为昭州中学学生）做的时候发现的一些痛点：

1. **热加载**：帖子发布后立即刷新列表
2. **分类导航**：快速找到感兴趣的内容
3. **暗色模式**：跟随系统设置自动切换
4. **移动优先**：课间用手机刷毫无压力
5. **加载动画**：网络不好时也有反馈
6. **举报机制**：看到不当内容一键举报

## 技术栈

- 前端：纯 HTML + CSS + JavaScript（SPA）
- 后端：Supabase（PostgreSQL + Auth + Storage）
- 部署：GitHub Pages
- 无框架依赖，零构建步骤

## 许可证

MIT
