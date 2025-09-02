// MemeDam 資料庫 ERD 圖表 (2025年1月更新版)
// 使用 dbdiagram.io 格式
// 基於實際 MongoDB 模型架構更新

// ===========================
// 用戶相關
// ===========================
Table users {
  _id ObjectId [pk]
  username varchar(30) [unique, not null, note: '5-30字元，僅允許小寫英文、數字、底線與句點']
  display_name varchar(50)
  email varchar [unique, note: '社群登入用戶可為空，MongoDB sparse索引']
  phone varchar(10) [note: '台灣手機號碼格式 09xxxxxxxx']
  password varchar [note: '社群登入用戶自動生成']
  has_password boolean [default: false, note: '是否有設定密碼']
  tokens varchar[] [note: '最多3個有效登入token']
  google_id varchar [unique, note: 'MongoDB sparse索引']
  facebook_id varchar [unique, note: 'MongoDB sparse索引']
  discord_id varchar [unique, note: 'MongoDB sparse索引']
  twitter_id varchar [unique, note: 'MongoDB sparse索引']
  avatar varchar [note: '頭像URL']
  cover_image varchar [note: '封面圖片URL']
  bio varchar(500)
  gender varchar [note: '可選值: male, female, other，可為空字串']
  location varchar(100)
  role varchar [default: 'user', note: '可選值: user, admin, auditor, manager']
  status varchar [default: 'active', note: '可選值: active, banned, pending, deleted, suspended']
  ban_reason varchar(200)
  email_verified boolean [default: false]
  login_method varchar [default: 'local', note: '可選值: local, google, facebook, discord, twitter']
  needs_username_selection boolean [default: false]
  birthday date
  last_login_at timestamp
  last_ip varchar(45)
  join_ip varchar(45)
  user_agent varchar(500)
  exp int [default: 0, note: '經驗值']
  verified_at timestamp
  deactivate_at timestamp
  register_from varchar [default: 'web', note: '可選值: web, mobile, api']
  preferences json [note: '用戶偏好設定']
  functionalPreferences json [note: '功能偏好設定：theme, language, personalization, searchPreferences']
  follower_count int [default: 0]
  following_count int [default: 0]
  meme_count int [default: 0]
  collection_count int [default: 0]
  total_likes_received int [default: 0]
  comment_count int [default: 0]
  share_count int [default: 0]
  notificationSettings json [note: '通知設定：browser, newFollower, newComment, newLike, newMention, trendingContent, weeklyDigest']
  username_changed_at timestamp
  previous_usernames json[] [note: '用戶名變更歷史：username, changed_at']
  privacyConsentId ObjectId
  lastConsentUpdate timestamp
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// 隱私權同意
Table privacy_consents {
  _id ObjectId [pk]
  userId ObjectId [note: '可為空，支援匿名用戶']
  sessionId varchar [not null, note: '索引欄位']
  necessary boolean [default: true, not null]
  functional boolean [default: false, not null]
  analytics boolean [default: false, not null]
  consentVersion varchar [default: '1.0', not null]
  consentSource varchar [not null, note: '可選值: initial, settings, reconsent, sync']
  ipAddress varchar [not null]
  userAgent varchar [not null]
  isActive boolean [default: true, note: '索引欄位']
  revokedAt timestamp
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 迷因相關（三層模型架構）
// ===========================
Table memes {
  _id ObjectId [pk]
  title varchar(200) [not null]
  type varchar [not null, note: '可選值: text, image, video, audio']
  content varchar(5000) [not null]
  image_url varchar [note: '圖片迷因的圖片連結']
  cover_image varchar [note: '迷因主圖連結，所有類型都可選填']
  video_url varchar [note: '影片迷因的影片連結']
  audio_url varchar [note: '音樂/音效迷因的檔案連結']
  source_id ObjectId [note: '三層模型：作品來源']
  scene_id ObjectId [note: '三層模型：場景']
  variant_of ObjectId [note: '變體系譜：此迷因是哪個迷因的變體']
  lineage json [note: '變體系譜：root(根源), depth(深度)']
  body varchar(5000) [note: '笑點解析']
  author_id ObjectId [not null]
  editors ObjectId[]
  status varchar [default: 'public', note: '可選值: public, deleted, banned, hidden, draft']
  slug varchar(100) [note: 'SEO友善網址，僅允許小寫字母、數字和連字號']
  nsfw boolean [default: false, note: '是否為成人/限制級']
  views int [default: 0, note: '瀏覽次數快取']
  comment_count int [default: 0, note: '留言數快取']
  like_count int [default: 0, note: '按讚數快取']
  dislike_count int [default: 0, note: '按噓數快取']
  collection_count int [default: 0, note: '收藏數快取']
  share_count int [default: 0, note: '分享數快取']
  hot_score float [default: 0, note: '熱門分數']
  tags_cache varchar[] [note: '主要標籤名稱快取，每個標籤1-50字元']
  sources json[] [note: '來源資訊陣列：name(名稱), url(網址)']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// 作品來源 (三層模型)
Table sources {
  _id ObjectId [pk]
  type varchar [not null, note: '可選值: video, film, tv, ad, web, article, other']
  title varchar(200) [not null, note: '索引欄位']
  alt_titles varchar[] [note: '別名、其他譯名']
  year int [note: '發行年份，1800-未來10年']
  origin_country varchar(100) [note: '來源國家/地區']
  creators json[] [note: '創作者陣列：role(角色), name(姓名)']
  synopsis varchar(5000) [note: '作品簡介']
  context varchar(5000) [note: '背景/爭議/影響']
  license json [note: '授權資訊：type(類型), notes(說明)']
  links json[] [note: '相關連結陣列：label(標籤), url(網址)']
  slug varchar [note: '索引欄位']
  status varchar [default: 'active']
  counts json [note: '統計數據：memes(相關迷因數)']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// 場景 (三層模型)
Table scenes {
  _id ObjectId [pk]
  source_id ObjectId [not null, note: '索引欄位']
  title varchar(200) [note: '場景標題']
  episode varchar(50) [note: '集數標示，如 S01E05']
  start_time int [note: '開始時間(秒)']
  end_time int [note: '結束時間(秒)，必須大於開始時間']
  quote varchar(1000) [note: '關鍵台詞/名言']
  transcript varchar(5000) [note: '場景逐字稿']
  description varchar(2000) [note: '場景描述/場景說明']
  images varchar[] [note: '截圖連結陣列']
  video_url varchar [note: '場景影片連結']
  slug varchar [note: '索引欄位']
  status varchar [default: 'active']
  counts json [note: '統計數據：memes(相關迷因數)']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 標籤系統
// ===========================
Table tags {
  _id ObjectId [pk]
  name varchar(50) [unique, not null]
  slug varchar [note: '同一語言下必須唯一']
  lang varchar [default: 'zh', note: '可選值: zh, en, ja, ko']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table meme_tags {
  _id ObjectId [pk]
  meme_id ObjectId [not null]
  tag_id ObjectId [not null]
  lang varchar [default: 'zh']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 互動系統
// ===========================
Table likes {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  meme_id ObjectId [not null]
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table dislikes {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  meme_id ObjectId [not null]
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table comments {
  _id ObjectId [pk]
  meme_id ObjectId [not null]
  user_id ObjectId [not null]
  content varchar(2000) [not null]
  parent_id ObjectId [note: '樓中樓回覆']
  status varchar [default: 'normal']
  like_count int [default: 0]
  dislike_count int [default: 0]
  reply_count int [default: 0]
  is_deleted boolean [default: false]
  deleted_at timestamp
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table collections {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  meme_id ObjectId [not null]
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table shares {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  meme_id ObjectId [not null]
  platform_detail varchar(100)
  ip varchar(45)
  user_agent varchar(500)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 瀏覽與追蹤
// ===========================
Table views {
  _id ObjectId [pk]
  meme_id ObjectId [not null]
  user_id ObjectId [note: '未登入用戶為空']
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  referrer varchar(500)
  duration int [default: 0, note: '瀏覽時間（秒）']
  is_duplicate boolean [default: false]
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// 搜尋歷史（計畫新增，尚未實作）
// Table search_history {
//   _id ObjectId [pk]
//   user_id ObjectId [ref: > users._id, note: '未登入用戶為空']
//   search_query varchar(500) [not null]
//   search_type varchar [default: 'general', note: '可選值: general, tag, user, advanced']
//   filters json [note: '搜尋篩選條件']
//   result_count int [default: 0]
//   clicked_results ObjectId[] [ref: > memes._id, note: '點擊的搜尋結果']
//   ip varchar(45)
//   user_agent varchar(500)
//   platform_detail varchar(100)
//   createdAt timestamp [default: `now()`]
// }

// ===========================
// 社交關係
// ===========================
Table follows {
  _id ObjectId [pk]
  follower_id ObjectId [not null]
  following_id ObjectId [not null]
  ip varchar(45)
  user_agent varchar(500)
  platform_detail varchar(100)
  status varchar [default: 'active', note: '可選值: active, muted, blocked']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 通知系統
// ===========================
Table notifications {
  _id ObjectId [pk]
  actor_id ObjectId [not null, note: '索引欄位']
  verb varchar(50) [not null, note: '索引欄位']
  object_type varchar(50) [not null, note: '索引欄位']
  object_id ObjectId [not null, note: '索引欄位']
  target_type varchar(50)
  target_id ObjectId
  extra json
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// 通知收據
Table notification_receipts {
  _id ObjectId [pk]
  notification_id ObjectId [not null, note: '索引欄位']
  user_id ObjectId [not null, note: '索引欄位']
  read_at timestamp
  deleted_at timestamp
  archived_at timestamp
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 檢舉系統
// ===========================
Table reports {
  _id ObjectId [pk]
  reporter_id ObjectId [not null]
  target_type varchar [not null, note: '可選值: user, meme, comment, other']
  target_id ObjectId [not null]
  reason varchar(1000) [not null]
  evidence json
  status varchar [default: 'pending', note: '可選值: pending, resolved, rejected']
  processed_at timestamp
  processor_id ObjectId
  processing_note varchar(1000)
  is_anonymous boolean [default: false]
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 公告系統
// ===========================
Table announcements {
  _id ObjectId [pk]
  title varchar(200) [not null]
  content varchar(5000) [not null]
  author_id ObjectId [not null]
  status varchar [default: 'draft', note: '可選值: draft, public, hidden, deleted']
  pinned boolean [default: false]
  visible_at timestamp
  expired_at timestamp
  category varchar(50) [note: 'system, activity, update, other']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 贊助系統
// ===========================
Table sponsors {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  status varchar [default: 'pending', note: '可選值: pending, success, failed, refunded']
  amount int [not null]
  message varchar(1000)
  payment_method varchar(50)
  transaction_id varchar(100)
  created_ip varchar(45)
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 版本控制系統
// ===========================
Table meme_versions {
  _id ObjectId [pk]
  meme ObjectId [not null]
  proposal_id ObjectId
  version_number int [not null]
  title varchar(200) [not null]
  content varchar(10000) [not null]
  images varchar[]
  created_by ObjectId [not null]
  changelog varchar(1000)
  status varchar [default: 'active', note: '可選值: active, pending, rejected']
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

Table meme_edit_proposals {
  _id ObjectId [pk]
  meme_id ObjectId [not null]
  proposer_id ObjectId [not null]
  title varchar
  content varchar
  images varchar[]
  reason varchar
  status varchar [default: 'pending', note: '可選值: pending, approved, rejected']
  reviewer_id ObjectId
  reviewed_at timestamp
  review_comment varchar
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// A/B 測試系統
// ===========================
Table ab_tests {
  _id ObjectId [pk]
  test_type varchar [not null]
  name varchar [not null]
  description varchar
  status varchar [default: 'draft', note: '可選值: draft, active, paused, completed']
  primary_metric varchar [not null]
  secondary_metrics varchar[]
  variants json [not null]
  traffic_allocation json
  target_audience json
  start_date timestamp
  end_date timestamp
  created_by ObjectId
  results json
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 推薦系統指標
// ===========================
Table recommendation_metrics {
  _id ObjectId [pk]
  user_id ObjectId [not null]
  meme_id ObjectId [not null]
  algorithm varchar [not null]
  ab_test_id varchar
  ab_test_variant varchar
  recommendation_score float [not null]
  recommendation_rank int [not null]
  is_clicked boolean [default: false]
  is_liked boolean [default: false]
  is_shared boolean [default: false]
  is_commented boolean [default: false]
  is_collected boolean [default: false]
  is_disliked boolean [default: false]
  view_duration int [default: 0]
  time_to_interact int
  user_rating int
  recommended_at timestamp [default: `now()`]
  interacted_at timestamp
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 意見回饋系統
// ===========================
Table feedback {
  _id ObjectId [pk]
  userId ObjectId [not null]
  email varchar(255) [not null]
  title varchar(200) [not null]
  message varchar(2000) [not null]
  category varchar [default: 'other', note: '可選值: suggestion, bug, content, feature, other']
  status varchar [default: 'pending', note: '可選值: pending, in_progress, resolved, closed']
  adminResponse varchar(2000)
  userAgent varchar
  ipHash varchar
  respondedAt timestamp
  createdAt timestamp [default: `now()`]
  updatedAt timestamp [default: `now()`]
}

// ===========================
// 驗證 Token
// ===========================
Table verification_tokens {
  _id ObjectId [pk]
  token varchar [unique, not null]
  userId ObjectId [not null]
  type varchar [not null, note: '可選值: email, password_reset, account_verification']
  used boolean [default: false]
  expiresAt timestamp [not null]
  createdAt timestamp [default: `now()`]
}

// ===========================
// 關聯關係定義
// ===========================

// 用戶與隱私同意
Ref: "users"."privacyConsentId" < "privacy_consents"."_id"

// 迷因三層模型關聯
Ref: "memes"."source_id" < "sources"."_id"
Ref: "memes"."scene_id" < "scenes"."_id"
Ref: "scenes"."source_id" < "sources"."_id"

// 迷因變體系譜
Ref: "memes"."variant_of" < "memes"."_id"

// 通知系統關聯
Ref: "notification_receipts"."notification_id" < "notifications"."_id"
Ref: "notification_receipts"."user_id" < "users"."_id"

// 意見回饋關聯
Ref: "feedback"."userId" < "users"."_id"

// 驗證 Token 關聯
Ref: "verification_tokens"."userId" < "users"."_id"

// 版本控制關聯
Ref: "meme_versions"."meme" < "memes"."_id"
Ref: "meme_versions"."proposal_id" < "meme_edit_proposals"."_id"
Ref: "meme_versions"."created_by" < "users"."_id"
Ref: "meme_edit_proposals"."meme_id" < "memes"."_id"
Ref: "meme_edit_proposals"."proposer_id" < "users"."_id"
Ref: "meme_edit_proposals"."reviewer_id" < "users"."_id"

// A/B 測試關聯
Ref: "ab_tests"."created_by" < "users"."_id"

// 推薦系統關聯
Ref: "recommendation_metrics"."user_id" < "users"."_id"
Ref: "recommendation_metrics"."meme_id" < "memes"."_id"

// 檢舉系統關聯
Ref: "reports"."reporter_id" < "users"."_id"
Ref: "reports"."processor_id" < "users"."_id"

// 其他基本關聯
Ref: "memes"."author_id" < "users"."_id"
Ref: "meme_tags"."meme_id" < "memes"."_id"
Ref: "meme_tags"."tag_id" < "tags"."_id"
Ref: "likes"."user_id" < "users"."_id"
Ref: "likes"."meme_id" < "memes"."_id"
Ref: "dislikes"."user_id" < "users"."_id"
Ref: "dislikes"."meme_id" < "memes"."_id"
Ref: "comments"."meme_id" < "memes"."_id"
Ref: "comments"."user_id" < "users"."_id"
Ref: "comments"."parent_id" < "comments"."_id"
Ref: "collections"."user_id" < "users"."_id"
Ref: "collections"."meme_id" < "memes"."_id"
Ref: "shares"."user_id" < "users"."_id"
Ref: "shares"."meme_id" < "memes"."_id"
Ref: "views"."meme_id" < "memes"."_id"
Ref: "views"."user_id" < "users"."_id"
Ref: "follows"."follower_id" < "users"."_id"
Ref: "follows"."following_id" < "users"."_id"
Ref: "notifications"."actor_id" < "users"."_id"
Ref: "announcements"."author_id" < "users"."_id"
Ref: "sponsors"."user_id" < "users"."_id"