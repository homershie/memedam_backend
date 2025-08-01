/**
 * 內容基礎、標籤相關、協同過濾和社交協同過濾推薦分頁功能測試
 * 測試分頁和排除功能的正確性
 */

import { jest } from '@jest/globals'
import {
  getContentBasedRecommendationsController,
  getTagBasedRecommendationsController,
  getCollaborativeFilteringRecommendationsController,
  getSocialCollaborativeFilteringRecommendationsController,
} from '../controllers/recommendationController.js'

// Mock 依賴
jest.mock('../models/Meme.js')
jest.mock('../models/User.js')
jest.mock('../utils/contentBased.js')
jest.mock('../utils/collaborativeFiltering.js')

// 動態導入 mock 模組
let Meme,
  User,
  getContentBasedRecommendations,
  getCollaborativeFilteringRecommendations,
  getSocialCollaborativeFilteringRecommendations

beforeAll(async () => {
  Meme = (await import('../models/Meme.js')).default
  User = (await import('../models/User.js')).default
  const contentBasedModule = await import('../utils/contentBased.js')
  const collaborativeFilteringModule = await import('../utils/collaborativeFiltering.js')

  getContentBasedRecommendations = contentBasedModule.getContentBasedRecommendations
  getCollaborativeFilteringRecommendations =
    collaborativeFilteringModule.getCollaborativeFilteringRecommendations
  getSocialCollaborativeFilteringRecommendations =
    collaborativeFilteringModule.getSocialCollaborativeFilteringRecommendations
})

describe('內容基礎、標籤相關、協同過濾和社交協同過濾推薦分頁功能測試', () => {
  let mockReq
  let mockRes

  beforeEach(() => {
    // 重置 mock
    jest.clearAllMocks()

    // 設置 mock 請求
    mockReq = {
      query: {},
      user: { _id: 'user123' },
    }

    // 設置 mock 響應
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    }

    // Mock User.findById
    User.findById = jest.fn().mockResolvedValue({ _id: 'user123', username: 'testuser' })

    // Mock Meme.countDocuments
    Meme.countDocuments = jest.fn().mockResolvedValue(50)
  })

  describe('內容基礎推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      // Mock getContentBasedRecommendations
      const mockRecommendations = [
        { _id: 'meme1', recommendation_score: 0.9 },
        { _id: 'meme2', recommendation_score: 0.8 },
      ]
      getContentBasedRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '2',
        limit: '10',
        min_similarity: '0.1',
        exclude_interacted: 'true',
        include_hot_score: 'true',
        hot_score_weight: '0.3',
        tags: 'funny,memes',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      // 驗證 getContentBasedRecommendations 被調用時包含分頁參數
      expect(getContentBasedRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 2,
          excludeIds: [],
          limit: 10,
        }),
      )

      // 驗證響應包含分頁資訊
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            page: 2,
            exclude_ids: [],
          }),
          pagination: expect.objectContaining({
            page: 2,
            limit: 10,
            skip: 10,
            total: 50,
            hasMore: true,
            totalPages: 5,
          }),
        }),
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockRecommendations = [{ _id: 'meme2', recommendation_score: 0.8 }]
      getContentBasedRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme3',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      // 驗證 getContentBasedRecommendations 被調用時包含排除ID
      expect(getContentBasedRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          excludeIds: ['meme1', 'meme3'],
        }),
      )

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            exclude_ids: ['meme1', 'meme3'],
          }),
        }),
        error: null,
      })
    })
  })

  describe('標籤相關推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      const mockRecommendations = [
        { _id: 'meme1', recommendation_score: 0.9 },
        { _id: 'meme2', recommendation_score: 0.8 },
      ]
      getContentBasedRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        tags: 'funny,memes',
        page: '3',
        limit: '5',
        min_similarity: '0.1',
        include_hot_score: 'true',
        hot_score_weight: '0.3',
      }

      await getTagBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            page: 3,
            exclude_ids: [],
          }),
          pagination: expect.objectContaining({
            page: 3,
            limit: 5,
            skip: 10,
            total: 50,
            hasMore: true,
            totalPages: 10,
          }),
        }),
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockRecommendations = [{ _id: 'meme2', recommendation_score: 0.8 }]
      getContentBasedRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        tags: 'funny',
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme4,meme5',
      }

      await getTagBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            exclude_ids: ['meme1', 'meme4', 'meme5'],
          }),
        }),
        error: null,
      })
    })
  })

  describe('協同過濾推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      const mockRecommendations = [
        { _id: 'meme1', recommendation_score: 0.9 },
        { _id: 'meme2', recommendation_score: 0.8 },
      ]
      getCollaborativeFilteringRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '2',
        limit: '10',
        min_similarity: '0.1',
        max_similar_users: '50',
        exclude_interacted: 'true',
        include_hot_score: 'true',
        hot_score_weight: '0.3',
        tags: 'funny,memes',
      }

      await getCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(getCollaborativeFilteringRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 2,
          excludeIds: [],
          limit: 10,
        }),
      )

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            page: 2,
            exclude_ids: [],
          }),
          pagination: expect.objectContaining({
            page: 2,
            limit: 10,
            skip: 10,
            total: 50,
            hasMore: true,
            totalPages: 5,
          }),
        }),
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockRecommendations = [{ _id: 'meme2', recommendation_score: 0.8 }]
      getCollaborativeFilteringRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme3',
      }

      await getCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(getCollaborativeFilteringRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          excludeIds: ['meme1', 'meme3'],
        }),
      )
    })
  })

  describe('社交協同過濾推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      const mockRecommendations = [
        { _id: 'meme1', recommendation_score: 0.9 },
        { _id: 'meme2', recommendation_score: 0.8 },
      ]
      getSocialCollaborativeFilteringRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '3',
        limit: '5',
        min_similarity: '0.1',
        max_similar_users: '50',
        exclude_interacted: 'true',
        include_hot_score: 'true',
        hot_score_weight: '0.3',
        tags: 'funny,memes',
      }

      await getSocialCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(getSocialCollaborativeFilteringRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 3,
          excludeIds: [],
          limit: 5,
        }),
      )

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            page: 3,
            exclude_ids: [],
          }),
          pagination: expect.objectContaining({
            page: 3,
            limit: 5,
            skip: 10,
            total: 50,
            hasMore: true,
            totalPages: 10,
          }),
        }),
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockRecommendations = [{ _id: 'meme2', recommendation_score: 0.8 }]
      getSocialCollaborativeFilteringRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme4,meme5',
      }

      await getSocialCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(getSocialCollaborativeFilteringRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          excludeIds: ['meme1', 'meme4', 'meme5'],
        }),
      )
    })
  })

  describe('錯誤處理測試', () => {
    test('應該處理資料庫錯誤', async () => {
      getContentBasedRecommendations.mockImplementation(() => {
        throw new Error('Database error')
      })

      mockReq.query = {
        page: '1',
        limit: '10',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
      })
    })

    test('應該處理無效的頁碼參數', async () => {
      const mockRecommendations = [{ _id: 'meme1', recommendation_score: 0.9 }]
      getContentBasedRecommendations.mockResolvedValue(mockRecommendations)

      mockReq.query = {
        page: 'invalid',
        limit: '10',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      // 應該使用預設值 1
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1,
          }),
        }),
        error: null,
      })
    })
  })
})
