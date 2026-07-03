# 昭州校园社区 — 架构设计文档

## 技术栈
- **前端**: 纯 HTML/CSS/JS 单页应用（SPA），hash 路由
- **后端**: Supabase（认证 + 数据库 + 存储 + RLS）
- **部署**: GitHub Pages（静态前端）+ Supabase（数据库/认证/存储）
- **图片**: Supabase Storage（images 桶，公开访问）

## 项目结构
```
zhaozhou-community/
├── index.html            # SPA 入口（所有页面）
├── admin.html            # 管理后台
├── css/
│   └── style.css         # 全局样式
├── js/
│   ├── supabase.js       # Supabase 客户端初始化
│   ├── auth.js           # 登录/注册/登出
│   ├── router.js         # SPA Hash 路由
│   ├── posts.js          # 帖子 CRUD
│   ├── comments.js       # 评论系统
│   ├── admin.js          # 管理员后台
│   ├── utils.js          # 工具函数（违禁词过滤、时间格式化等）
│   └── app.js            # 应用入口
├── images/
│   └── school-bg.jpg     # 校园背景图
├── supabase-schema.sql   # 完整数据库建表 SQL
├── COMMUNITY_CONVENTION.md # 社区公约
├── ARCHITECTURE.md       # 本文件
└── README.md             # 部署说明
```

## 路由设计

| Hash | 页面 | 说明 |
|------|------|------|
| `#/` | 首页 | 全屏 Hero + 热帖 + 公告 |
| `#/board/:board` | 板块页 | 各板块帖子列表 |
| `#/post/:id` | 帖子详情 | 正文 + 评论 |
| `#/create` | 发帖 | 选择板块 + 匿名开关 |
| `#/login` | 登录 | |
| `#/register` | 注册 | |
| `#/profile` | 个人中心 | 帖子/收藏/拉黑/设置 |
| `#/search/:q` | 搜索结果 | |
| `#/admin` | 管理后台 | 单独页面 |

## 数据库表设计

### boards（板块）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| name | text | 板块名 |
| slug | text unique | 英文标识 |
| icon | text | 图标 emoji |
| sort_order | int | 排序 |
| is_active | boolean | 是否启用 |

### profiles（用户扩展）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK → auth.users | |
| display_name | text | 昵称 |
| class_name | text nullable | 班级 |
| avatar_url | text nullable | 头像 |
| role | text default 'user' | 'user' 或 'admin' |
| is_banned | boolean | 是否禁言 |
| ban_reason | text nullable | 禁言原因 |
| banned_until | timestamptz nullable | 禁言到期 |
| created_at | timestamptz | |
| last_sign_in_ip | text nullable | 最后登录IP |
| last_sign_in_at | timestamptz | |

### posts（帖子）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| board_slug | text FK → boards | 所属板块 |
| title | text | 标题 |
| content | text | 正文 |
| images | text[] | 图片 URL 数组 |
| is_anonymous | boolean | 是否匿名 |
| is_pinned | boolean | 是否置顶 |
| is_approved | boolean | 是否审核通过 |
| comments_disabled | boolean | 是否关闭评论 |
| like_count | int default 0 | 点赞数 |
| comment_count | int default 0 | 评论数 |
| bookmark_count | int default 0 | 收藏数 |
| report_count | int default 0 | 举报数 |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| auto_hide_at | timestamptz nullable | 定时下架时间 |
| creator_ip | text nullable | 发布IP |
| is_hidden | boolean | 是否被隐藏 |

### comments（评论）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| post_id | uuid FK → posts | |
| user_id | uuid FK → profiles | |
| parent_id | uuid nullable FK → comments | 回复某条评论 |
| content | text | 评论内容 |
| like_count | int default 0 | |
| created_at | timestamptz | |
| creator_ip | text nullable | |

### likes（点赞）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| post_id | uuid FK → posts | |
| created_at | timestamptz | |
| UNIQUE(user_id, post_id) | | |

### bookmarks（收藏）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| post_id | uuid FK → posts | |
| created_at | timestamptz | |
| UNIQUE(user_id, post_id) | | |

### reports（举报）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| reporter_id | uuid FK → profiles | |
| post_id | uuid nullable FK → posts | |
| comment_id | uuid nullable FK → comments | |
| reason | text | 举报原因 |
| status | text default 'pending' | pending/resolved/dismissed |
| resolved_by | uuid nullable FK → profiles | |
| resolved_at | timestamptz | |
| created_at | timestamptz | |

### banned_words（违禁词）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| word | text unique | 违禁词 |
| is_active | boolean default true | |
| created_at | timestamptz | |
| created_by | uuid FK → profiles | |

### announcements（公告）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| title | text | |
| content | text | |
| is_active | boolean | |
| sort_order | int | |
| created_at | timestamptz | |
| expires_at | timestamptz nullable | |

### blacklists（用户拉黑）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | 拉黑者 |
| blocked_id | uuid FK → profiles | 被拉黑者 |
| created_at | timestamptz | |
| UNIQUE(user_id, blocked_id) | | |

### subscriptions（关键词订阅）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| keyword | text | 订阅关键词 |
| board_slug | text nullable | 限定板块 |
| created_at | timestamptz | |

### notifications（通知）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| type | text | like/comment/reply/report |
| post_id | uuid nullable | |
| content | text | |
| is_read | boolean | |
| created_at | timestamptz | |

### site_settings（站点设置）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| key | text unique | |
| value | jsonb | |
| updated_at | timestamptz | |

## 页面交互流程

1. **用户访问首页** → 全屏 Hero 展示校园背景 + 网站名称 + 投稿入口 + 搜索框
2. **滚动** → Hero 视差效果，导航栏毛玻璃效果切换
3. **点击投稿** → 未登录跳登录，已登录弹出合规弹窗（确认后进入发帖页）
4. **发帖** → 选择板块 → 填写标题/内容/图片 → 匿名开关 → 提交（前端过滤违禁词 → Supabase 插入）
5. **首页下方** → 公告轮播 + 各板块热帖推荐 + 每日/每周热帖榜单
6. **帖子详情** → 互动按钮（点赞/收藏/评论/举报/分享）+ 评论区
7. **个人中心** → 我的帖子/收藏/拉黑列表/通知设置/关键词订阅

## RLS 策略

- 公开数据（帖子、评论、点赞数等）：公开可读
- 敏感字段（creator_ip、is_anonymous 后端关联）：仅管理员和本人可读
- 写操作：需认证用户
- 管理员表（banned_words、reports、site_settings）：仅管理员可读写
