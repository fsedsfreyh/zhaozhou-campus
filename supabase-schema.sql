-- =============================================
-- 昭州校园社区 - 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行
-- =============================================

-- 0. 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 板块表
-- =============================================
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📋',
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 插入默认板块
INSERT INTO boards (name, slug, icon, description, sort_order) VALUES
  ('表白墙', 'confession', '💌', '说出你的心意', 1),
  ('失物招领', 'lost-found', '🔍', '丢失与拾取物品信息', 2),
  ('匿名树洞', 'treehole', '🌲', '匿名倾诉你的心事', 3),
  ('校园问答', 'qa', '❓', '有问有答，互帮互助', 4),
  ('社团招新', 'club', '🎭', '各社团纳新信息', 5),
  ('校内兼职', 'part-time', '💼', '兼职招聘信息发布', 6),
  ('租房转租', 'rental', '🏠', '房屋出租转租信息', 7),
  ('拼车拼单', 'carpool', '🚗', '出行拼车、团购拼单', 8),
  ('校园通知', 'notice', '📢', '学校官方公告通知', 9),
  ('校园周边', 'campus-life', '🏫', '分享校园生活新鲜事', 10);

-- =============================================
-- 2. 用户扩展信息
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  class_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT DEFAULT '',
  banned_until TIMESTAMPTZ,
  bio TEXT DEFAULT '',
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_sign_in_ip TEXT DEFAULT '',
  last_sign_in_at TIMESTAMPTZ
);

-- 创建用户后自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '用户' || substr(NEW.id::text, 1, 8)),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 3. 帖子表
-- =============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  board_slug TEXT NOT NULL REFERENCES boards(slug),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  images TEXT[] DEFAULT '{}',
  is_anonymous BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  comments_disabled BOOLEAN DEFAULT false,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  bookmark_count INT DEFAULT 0,
  report_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  auto_hide_at TIMESTAMPTZ,
  creator_ip TEXT DEFAULT '',
  is_hidden BOOLEAN DEFAULT false
);

CREATE INDEX idx_posts_board ON posts(board_slug);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_pinned ON posts(is_pinned DESC);
CREATE INDEX idx_posts_user ON posts(user_id);

-- =============================================
-- 4. 评论表
-- =============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  creator_ip TEXT DEFAULT ''
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- =============================================
-- 5. 点赞表
-- =============================================
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- =============================================
-- 6. 收藏表
-- =============================================
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- =============================================
-- 7. 举报表
-- =============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 8. 违禁词表
-- =============================================
CREATE TABLE banned_words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- =============================================
-- 9. 公告表
-- =============================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ
);

-- =============================================
-- 10. 用户黑名单
-- =============================================
CREATE TABLE blacklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);

-- =============================================
-- 11. 关键词订阅
-- =============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  board_slug TEXT REFERENCES boards(slug),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 12. 通知表
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'reply', 'report_resolved', 'system')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- =============================================
-- 13. 站点设置
-- =============================================
CREATE TABLE site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES
  ('site_name', '"昭州校园社区"'),
  ('site_description', '"昭州中学校内专属社区"'),
  ('require_approval', 'false'),
  ('max_images_per_post', '9');

-- =============================================
-- RLS 策略
-- =============================================
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 公开可读策略
CREATE POLICY "boards_read_all" ON boards FOR SELECT USING (true);
CREATE POLICY "posts_read_visible" ON posts FOR SELECT USING (NOT is_hidden AND is_approved IS NOT FALSE);
CREATE POLICY "comments_read_all" ON comments FOR SELECT USING (true);
CREATE POLICY "announcements_read_active" ON announcements FOR SELECT USING (is_active);
CREATE POLICY "banned_words_read_all" ON banned_words FOR SELECT USING (true);
CREATE POLICY "profiles_read_public" ON profiles FOR SELECT USING (true);
CREATE POLICY "site_settings_read_all" ON site_settings FOR SELECT USING (true);

-- 认证用户写策略
CREATE POLICY "posts_insert_auth" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_insert_auth" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_insert_auth" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "reports_insert_auth" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "blacklists_insert_auth" ON blacklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "blacklists_delete_own" ON blacklists FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_insert_auth" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 用户可更新自己的 profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 管理员完全访问
CREATE POLICY "admin_all_posts" ON posts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_reports" ON reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_banned_words" ON banned_words FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_announcements" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_site_settings" ON site_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_read_notifications" ON notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- 违禁词初次数据
-- =============================================
INSERT INTO banned_words (word) VALUES
  ('傻逼'), ('草泥马'), ('fuck'), ('操你妈'), ('cnm'),
  ('nmsl'), ('sb'), ('尼玛'), ('他妈'), ('混蛋'),
  ('废物'), ('去死'), ('垃圾人'), ('脑残'), ('白痴'),
  ('弱智'), ('精神病'), ('滚蛋'), ('恶心'), ('不要脸');


-- =============================================
-- 计数更新 RPC 函数
-- =============================================
CREATE OR REPLACE FUNCTION increment_like(p_post_id UUID)
RETURNS void AS $$
  UPDATE posts SET like_count = like_count + 1 WHERE id = p_post_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_like(p_post_id UUID)
RETURNS void AS $$
  UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = p_post_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_comment(p_post_id UUID)
RETURNS void AS $$
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = p_post_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_bookmark(p_post_id UUID)
RETURNS void AS $$
  UPDATE posts SET bookmark_count = bookmark_count + 1 WHERE id = p_post_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_bookmark(p_post_id UUID)
RETURNS void AS $$
  UPDATE posts SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id = p_post_id;
$$ LANGUAGE sql;
