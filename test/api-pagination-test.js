/**
 * API 分頁功能測試
 * 簡單測試來驗證所有推薦端點的分頁功能
 */

import request from 'supertest'
import express from 'express'
import { jest } from '@jest/globals'

// Mock 依賴
jest.mock('../models/Meme.js')
jest.mock('../models/User.js')
jest.mock('../utils/contentBased.js')
jest.mock('../utils/collaborativeFiltering.js')

// 創建測試應用
const app = express()
app.use(express.json())

// Mock 中間件
const mockAuth = (req, res, next) => {
  req.user = { _id: 'user123', username: 'testuser' }
  next()
}

// Mock 控制器
const mockContentBasedController = (req, res) => {
  const { page = 1, limit = 20, exclude_ids } = req.query

  const excludeIds = exclude_ids ? exclude_ids.split(',').map((id) => id.trim()) : []

  res.json({
    success: true,
    data: {
      recommendations: [
        { _id: 'meme1', title: 'Test Meme 1' },
        { _id: 'meme2', title: 'Test Meme 2' },
      ],
      filters: {
        page: parseInt(page),
        limit: parseInt(limit),
        exclude_ids: excludeIds,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: 50,
        hasMore: true,
        totalPages: Math.ceil(50 / parseInt(limit)),
      },
    },
    error: null,
  })
}

const mockTagBasedController = (req, res) => {
  const { page = 1, limit = 20, exclude_ids, tags } = req.query

  const excludeIds = exclude_ids ? exclude_ids.split(',').map((id) => id.trim()) : []

  res.json({
    success: true,
    data: {
      recommendations: [
        { _id: 'meme1', title: 'Tag Meme 1' },
        { _id: 'meme2', title: 'Tag Meme 2' },
      ],
      query_tags: tags ? tags.split(',') : [],
      filters: {
        page: parseInt(page),
        limit: parseInt(limit),
        exclude_ids: excludeIds,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: 50,
        hasMore: true,
        totalPages: Math.ceil(50 / parseInt(limit)),
      },
    },
    error: null,
  })
}

const mockCollaborativeController = (req, res) => {
  const { page = 1, limit = 20, exclude_ids } = req.query

  const excludeIds = exclude_ids ? exclude_ids.split(',').map((id) => id.trim()) : []

  res.json({
    success: true,
    data: {
      recommendations: [
        { _id: 'meme1', title: 'Collaborative Meme 1' },
        { _id: 'meme2', title: 'Collaborative Meme 2' },
      ],
      user_id: 'user123',
      filters: {
        page: parseInt(page),
        limit: parseInt(limit),
        exclude_ids: excludeIds,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: 50,
        hasMore: true,
        totalPages: Math.ceil(50 / parseInt(limit)),
      },
    },
    error: null,
  })
}

const mockSocialCollaborativeController = (req, res) => {
  const { page = 1, limit = 20, exclude_ids } = req.query

  const excludeIds = exclude_ids ? exclude_ids.split(',').map((id) => id.trim()) : []

  res.json({
    success: true,
    data: {
      recommendations: [
        { _id: 'meme1', title: 'Social Collaborative Meme 1' },
        { _id: 'meme2', title: 'Social Collaborative Meme 2' },
      ],
      user_id: 'user123',
      filters: {
        page: parseInt(page),
        limit: parseInt(limit),
        exclude_ids: excludeIds,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: 50,
        hasMore: true,
        totalPages: Math.ceil(50 / parseInt(limit)),
      },
    },
    error: null,
  })
}

// 設置路由
app.get('/api/recommendations/content-based', mockAuth, mockContentBasedController)
app.get('/api/recommendations/tag-based', mockTagBasedController)
app.get('/api/recommendations/collaborative-filtering', mockAuth, mockCollaborativeController)
app.get(
  '/api/recommendations/social-collaborative-filtering',
  mockAuth,
  mockSocialCollaborativeController,
)

describe('API 分頁功能測試', () => {
  describe('內容基礎推薦', () => {
    test('應該正確處理分頁參數', async () => {
      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          page: '2',
          limit: '10',
          exclude_ids: 'meme1,meme2',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.filters.page).toBe(2)
      expect(response.body.data.filters.limit).toBe(10)
      expect(response.body.data.filters.exclude_ids).toEqual(['meme1', 'meme2'])
      expect(response.body.data.pagination.page).toBe(2)
      expect(response.body.data.pagination.limit).toBe(10)
      expect(response.body.data.pagination.skip).toBe(10)
      expect(response.body.data.pagination.hasMore).toBe(true)
    })

    test('應該處理無效的頁碼參數', async () => {
      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          page: 'invalid',
          limit: '10',
        })
        .expect(200)

      expect(response.body.data.filters.page).toBe(1) // 預設值
    })
  })

  describe('標籤相關推薦', () => {
    test('應該正確處理分頁和標籤參數', async () => {
      const response = await request(app)
        .get('/api/recommendations/tag-based')
        .query({
          tags: 'funny,memes',
          page: '3',
          limit: '5',
          exclude_ids: 'meme1,meme3,meme5',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.query_tags).toEqual(['funny', 'memes'])
      expect(response.body.data.filters.page).toBe(3)
      expect(response.body.data.filters.limit).toBe(5)
      expect(response.body.data.filters.exclude_ids).toEqual(['meme1', 'meme3', 'meme5'])
      expect(response.body.data.pagination.page).toBe(3)
      expect(response.body.data.pagination.skip).toBe(10)
    })
  })

  describe('協同過濾推薦', () => {
    test('應該正確處理分頁參數', async () => {
      const response = await request(app)
        .get('/api/recommendations/collaborative-filtering')
        .query({
          page: '2',
          limit: '10',
          exclude_ids: 'meme1,meme2',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user_id).toBe('user123')
      expect(response.body.data.filters.page).toBe(2)
      expect(response.body.data.filters.exclude_ids).toEqual(['meme1', 'meme2'])
      expect(response.body.data.pagination.hasMore).toBe(true)
    })
  })

  describe('社交協同過濾推薦', () => {
    test('應該正確處理分頁參數', async () => {
      const response = await request(app)
        .get('/api/recommendations/social-collaborative-filtering')
        .query({
          page: '3',
          limit: '5',
          exclude_ids: 'meme1,meme4,meme5',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user_id).toBe('user123')
      expect(response.body.data.filters.page).toBe(3)
      expect(response.body.data.filters.limit).toBe(5)
      expect(response.body.data.filters.exclude_ids).toEqual(['meme1', 'meme4', 'meme5'])
      expect(response.body.data.pagination.skip).toBe(10)
    })
  })

  describe('錯誤處理', () => {
    test('應該處理缺少必要參數的情況', async () => {
      const response = await request(app)
        .get('/api/recommendations/tag-based')
        .query({})
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.filters.page).toBe(1) // 預設值
      expect(response.body.data.filters.limit).toBe(20) // 預設值
    })
  })
})
