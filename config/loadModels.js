// 模型載入器 - 預先載入所有模型以確保索引建立時模型已註冊
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Like from '../models/Like.js'
import Dislike from '../models/Dislike.js'
import Comment from '../models/Comment.js'
import Collection from '../models/Collection.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
import Follow from '../models/Follow.js'
import Tag from '../models/Tag.js'
import MemeTag from '../models/MemeTag.js'
import Notification from '../models/Notification.js'
import Report from '../models/Report.js'
import MemeVersion from '../models/MemeVersion.js'
import MemeEditProposal from '../models/MemeEditProposal.js'
import Announcement from '../models/Announcement.js'
import Sponsor from '../models/Sponsor.js'
import VerificationToken from '../models/VerificationToken.js'
import RecommendationMetrics from '../models/RecommendationMetrics.js'
import ABTest from '../models/ABTest.js'

// 導出所有模型以便其他模組使用
export {
  User,
  Meme,
  Like,
  Dislike,
  Comment,
  Collection,
  Share,
  View,
  Follow,
  Tag,
  MemeTag,
  Notification,
  Report,
  MemeVersion,
  MemeEditProposal,
  Announcement,
  Sponsor,
  VerificationToken,
  RecommendationMetrics,
  ABTest,
}

// 模型載入完成
console.log('✅ 所有模型已載入')
