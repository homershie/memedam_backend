import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getHotRecommendations,
  getLatestRecommendations,
} from '../../../controllers/recommendationController.js'

// Mock 依賴
vi.mock('../../../models/Meme.js', () => ({ default: {} }))
vi.mock('../../../models/User.js', () => ({ default: {} }))
vi.mock('../../../utils/hotScore.js', () => ({ getHotScoreLevel: vi.fn() }))

describe('熱門和最新推薦分頁功能測試', () => {
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

  describe('熱門推薦分頁測試', () => {
    it('應該正確處理分頁參數', async () => {
      mockReq.query = {
        page: '2',
        limit: '10',
        days: '7',
        type: 'all',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 2,
              limit: 10,
            }),
          }),
        }),
      )
    })

    it('應該處理時間範圍參數', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        days: '30',
        type: 'image',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })

    it('應該處理內容類型過濾', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        type: 'video',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })

    it('應該處理排除 ID 列表', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme2,meme3',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })
  })

  describe('最新推薦分頁測試', () => {
    it('應該正確處理分頁參數', async () => {
      mockReq.query = {
        page: '3',
        limit: '15',
        type: 'all',
      }

      await getLatestRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 3,
              limit: 15,
            }),
          }),
        }),
      )
    })

    it('應該按時間排序', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        sort_by: 'created_at',
        sort_order: 'desc',
      }

      await getLatestRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })

    it('應該處理標籤過濾', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        tags: 'funny,memes',
      }

      await getLatestRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })
  })

  describe('分頁計算測試', () => {
    it('應該計算正確的分頁資訊', async () => {
      mockReq.query = {
        page: '2',
        limit: '10',
      }

      await getHotRecommendations(mockReq, mockRes)

      const responseCall = mockRes.json.mock.calls[0][0]
      const pagination = responseCall.data.pagination

      expect(pagination).toHaveProperty('page')
      expect(pagination).toHaveProperty('limit')
      expect(pagination).toHaveProperty('total')
      expect(pagination).toHaveProperty('totalPages')
      expect(pagination).toHaveProperty('hasNext')
      expect(pagination).toHaveProperty('hasPrev')
    })

    it('應該處理邊界分頁值', async () => {
      mockReq.query = {
        page: '999',
        limit: '1000',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 999,
              limit: 1000,
            }),
          }),
        }),
      )
    })

    it('應該處理無效的分頁參數', async () => {
      mockReq.query = {
        page: 'invalid',
        limit: 'invalid',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      )
    })
  })

  describe('過濾功能測試', () => {
    it('應該處理多個過濾條件', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        type: 'image',
        tags: 'funny',
        exclude_ids: 'meme1',
        days: '7',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })

    it('應該處理空的過濾條件', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })
  })

  describe('排序功能測試', () => {
    it('應該支援不同的排序方式', async () => {
      const sortOptions = [
        { sort_by: 'hot_score', sort_order: 'desc' },
        { sort_by: 'created_at', sort_order: 'desc' },
        { sort_by: 'view_count', sort_order: 'desc' },
        { sort_by: 'like_count', sort_order: 'desc' },
      ]

      for (const sortOption of sortOptions) {
        mockReq.query = {
          page: '1',
          limit: '10',
          ...sortOption,
        }

        await getHotRecommendations(mockReq, mockRes)

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          }),
        )
      }
    })
  })

  describe('性能測試', () => {
    it('應該處理大量數據的分頁', async () => {
      mockReq.query = {
        page: '100',
        limit: '50',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })

    it('應該處理極限分頁參數', async () => {
      mockReq.query = {
        page: '1',
        limit: '1000',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      )
    })
  })

  describe('錯誤處理測試', () => {
    it('應該處理無效的用戶 ID', async () => {
      mockReq.user = null

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      )
    })

    it('應該處理資料庫錯誤', async () => {
      // 模擬資料庫錯誤
      const { default: Meme } = await import('../../../models/Meme.js')
      Meme.countDocuments = vi.fn().mockRejectedValue(new Error('Database error'))

      mockReq.query = {
        page: '1',
        limit: '10',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      )
    })
  })
})
