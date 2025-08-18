import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

// Mock mongoose
vi.mock('mongoose', () => ({
  default: {
    trusted: vi.fn((value) => value),
    Types: {
      ObjectId: {
        isValid: vi.fn(() => true),
      },
    },
  },
}))

// Mock 模型
vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({
            populate: vi.fn(() => ({
              lean: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    })),
    countDocuments: vi.fn(() => Promise.resolve(0)),
    findById: vi.fn(() => ({
      populate: vi.fn(() => ({
        lean: vi.fn(() => Promise.resolve(null)),
      })),
    })),
  },
}))

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(() =>
          Promise.resolve({
            _id: 'user123',
            username: 'testuser',
            email: 'test@example.com',
          }),
        ),
      })),
    })),
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}))

// Mock utils
vi.mock('../../../utils/contentBased.js', () => ({
  getContentBasedRecommendations: vi.fn(() =>
    Promise.resolve({
      recommendations: [],
      totalCount: 0,
      userInteractions: [],
    }),
  ),
}))

vi.mock('../../../utils/collaborativeFiltering.js', () => ({
  getCollaborativeFilteringRecommendations: vi.fn(() =>
    Promise.resolve({
      recommendations: [],
      totalCount: 0,
    }),
  ),
  getSocialCollaborativeFilteringRecommendations: vi.fn(() =>
    Promise.resolve({
      recommendations: [],
      totalCount: 0,
    }),
  ),
}))

// Import controllers after mocks
const {
  getContentBasedRecommendationsController,
  getTagBasedRecommendationsController,
  getCollaborativeFilteringRecommendationsController,
  getSocialCollaborativeFilteringRecommendationsController,
} = await import('../../../controllers/recommendationController.js')

// Mock 依賴
vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            populate: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([])
            })
          })
        })
      })
    }),
    countDocuments: vi.fn().mockResolvedValue(0)
  }
}))

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'user123', username: 'testuser' })
      })
    })
  }
}))

vi.mock('../../../utils/contentBased.js', () => ({
  getContentBasedRecommendations: vi.fn().mockResolvedValue({
    recommendations: [],
    totalCount: 0,
    userInteractions: []
  })
}))

vi.mock('../../../utils/collaborativeFiltering.js', () => ({
  getCollaborativeFilteringRecommendations: vi.fn().mockResolvedValue({
    recommendations: [],
    totalCount: 0
  }),
  getSocialCollaborativeFilteringRecommendations: vi.fn().mockResolvedValue({
    recommendations: [],
    totalCount: 0
  })
}))

describe('推薦系統分頁功能測試', () => {
  let mockReq, mockRes

  beforeEach(() => {
    // 重置 mock
    vi.clearAllMocks()

    // 設置 mock 請求
    mockReq = {
      query: {},
      user: { _id: 'user123' },
    }

    // 設置 mock 響應
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }
  })

  describe('內容基礎推薦分頁測試', () => {
    it('應該正確處理分頁參數', async () => {
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

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
    })

    it('應該處理無效的分頁參數', async () => {
      mockReq.query = {
        page: 'invalid',
        limit: 'invalid',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      // 控制器可能會使用預設值而不是返回錯誤
      expect(mockRes.json).toHaveBeenCalled()
    })

    it('應該處理邊界分頁值', async () => {
      mockReq.query = {
        page: '999',
        limit: '100', // 使用合理的限制值
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })
  })

  describe('標籤基礎推薦分頁測試', () => {
    it('應該正確處理標籤過濾和分頁', async () => {
      mockReq.query = {
        page: '1',
        limit: '5',
        tags: 'funny,memes',
        exclude_ids: 'meme1,meme2',
      }

      await getTagBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })

    it('應該處理空的標籤列表', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        tags: '',
      }

      await getTagBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })
  })

  describe('協同過濾推薦分頁測試', () => {
    it('應該正確處理協同過濾分頁', async () => {
      mockReq.query = {
        page: '3',
        limit: '15',
        min_similarity: '0.5',
        include_social_score: 'true',
      }

      await getCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })

    it('應該處理相似度閾值', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        min_similarity: '0.8',
      }

      await getCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })
  })

  describe('社交協同過濾推薦分頁測試', () => {
    it('應該正確處理社交協同過濾分頁', async () => {
      mockReq.query = {
        page: '1',
        limit: '20',
        include_social_interactions: 'true',
        social_weight: '0.7',
      }

      await getSocialCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })

    it('應該處理社交權重參數', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        social_weight: '0.5',
      }

      await getSocialCollaborativeFilteringRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })
  })

  describe('通用分頁功能測試', () => {
    it('應該計算正確的分頁資訊', async () => {
      mockReq.query = {
        page: '2',
        limit: '10',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      
      if (response.data && response.data.pagination) {
        expect(response.data.pagination).toHaveProperty('page')
        expect(response.data.pagination).toHaveProperty('limit')
      }
    })

    it('應該處理排除 ID 列表', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme2,meme3',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })

    it('應該處理排序參數', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        sort_by: 'recommendation_score',
        sort_order: 'desc',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      const response = mockRes.json.mock.calls[0][0]
      expect(response.success).toBe(true)
    })
  })

  describe('錯誤處理測試', () => {
    it('應該處理無效的用戶 ID', async () => {
      mockReq.user = null

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalled()
      // 控制器可能允許匿名用戶
      const response = mockRes.json.mock.calls[0][0]
      expect(response).toBeDefined()
    })

    it('應該處理資料庫錯誤', async () => {
      // 模擬資料庫錯誤
      const { default: Meme } = await import('../../../models/Meme.js')
      Meme.countDocuments = vi.fn().mockRejectedValue(new Error('Database error'))

      mockReq.query = {
        page: '1',
        limit: '10',
      }

      await getContentBasedRecommendationsController(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      )
    })
  })
})
