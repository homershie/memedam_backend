import express from 'express'
import {
  followUser,
  unfollowUser,
  toggleFollow,
  getFollowing,
  getFollowers,
  checkFollowStatus,
  getUserStats,
} from '../controllers/followController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 追隨用戶
router.post('/follow', token, isUser, followUser)

// 取消追隨用戶
router.post('/unfollow', token, isUser, unfollowUser)

// 切換追隨狀態（推薦使用此API）
router.post('/toggle', token, isUser, toggleFollow)

// 檢查是否追隨某個用戶
router.get('/status/:user_id', token, isUser, checkFollowStatus)

// 獲取指定用戶的追隨列表（我追隨的人）
router.get('/following/:user_id', getFollowing)

// 獲取指定用戶的粉絲列表（追隨我的人）
router.get('/followers/:user_id', getFollowers)

// 獲取用戶統計資訊
router.get('/stats/:user_id', getUserStats)

export default router
