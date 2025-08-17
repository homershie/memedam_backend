/**
 * 熱門推薦和最新推薦分頁功能測試
 * 測試分頁和排除功能的正確性
 */

import { vi, describe, test, expect, beforeEach } from 'vitest'
import {
  getHotRecommendations,
  getLatestRecommendations,
} from '../../../controllers/recommendationController.js'

// Mock 依賴
vi.mock('../../../models/Meme.js', () => ({ default: {} }))
vi.mock('../../../models/User.js', () => ({ default: {} }))
vi.mock('../../../utils/hotScore.js', () => ({ getHotScoreLevel: vi.fn() }))

const Meme = (await import('../../../models/Meme.js')).default
const { getHotScoreLevel } = await import('../../../utils/hotScore.js')

describe.skip('熱門推薦和最新推薦分頁功能測試', () => {
  let mockReq
  let mockRes

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

    // Mock getHotScoreLevel
    getHotScoreLevel.mockReturnValue('popular')
  })

  describe('熱門推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      // 設置測試數據
      const mockMemes = [
        { _id: 'meme1', hot_score: 100, author_id: { username: 'user1' } },
        { _id: 'meme2', hot_score: 90, author_id: { username: 'user2' } },
        { _id: 'meme3', hot_score: 80, author_id: { username: 'user3' } },
      ]

      // Mock Meme.find 和 countDocuments
      Meme.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = vi.fn().mockResolvedValue(50)

      // 設置請求參數
      mockReq.query = {
        page: '2',
        limit: '10',
        days: '7',
        type: 'all',
      }

      await getHotRecommendations(mockReq, mockRes)

      // 驗證響應
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              _id: 'meme1',
              recommendation_type: 'hot',
              hot_level: 'popular',
            }),
          ]),
          filters: expect.objectContaining({
            page: 2,
            limit: 10,
            exclude_ids: [],
          }),
          algorithm: 'hot_score',
          pagination: expect.objectContaining({
            page: 2,
            limit: 10,
            skip: 10,
            total: 50,
            hasMore: true,
            totalPages: 5,
          }),
        },
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockMemes = [
        { _id: 'meme2', hot_score: 90, author_id: { username: 'user2' } },
        { _id: 'meme3', hot_score: 80, author_id: { username: 'user3' } },
      ]

      Meme.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = vi.fn().mockResolvedValue(30)

      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme4',
      }

      await getHotRecommendations(mockReq, mockRes)

      // 驗證查詢條件包含排除ID
      expect(Meme.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $nin: ['meme1', 'meme4'] },
        }),
        expect.any(Object),
      )

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            exclude_ids: ['meme1', 'meme4'],
          }),
        }),
        error: null,
      })
    })

    test('應該正確處理標籤篩選', async () => {
      const mockMemes = [{ _id: 'meme1', hot_score: 100, author_id: { username: 'user1' } }]

      Meme.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = vi.fn().mockResolvedValue(10)

      mockReq.query = {
        page: '1',
        limit: '10',
        tags: 'funny,memes',
      }

      await getHotRecommendations(mockReq, mockRes)

      // 驗證查詢條件包含標籤篩選
      expect(Meme.find).toHaveBeenCalledWith(
        expect.objectContaining({
          tags_cache: { $in: ['funny', 'memes'] },
        }),
        expect.any(Object),
      )
    })
  })

  describe('最新推薦分頁測試', () => {
    test('應該正確處理分頁參數', async () => {
      const mockMemes = [
        { _id: 'meme1', createdAt: new Date(), author_id: { username: 'user1' } },
        { _id: 'meme2', createdAt: new Date(), author_id: { username: 'user2' } },
      ]

      Meme.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = vi.fn().mockResolvedValue(25)

      mockReq.query = {
        page: '3',
        limit: '5',
        hours: '24',
        type: 'all',
      }

      await getLatestRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              _id: 'meme1',
              recommendation_type: 'latest',
            }),
          ]),
          filters: expect.objectContaining({
            page: 3,
            limit: 5,
            hours: 24,
            exclude_ids: [],
          }),
          algorithm: 'latest',
          pagination: expect.objectContaining({
            page: 3,
            limit: 5,
            skip: 10,
            total: 25,
            hasMore: true,
            totalPages: 5,
          }),
        },
        error: null,
      })
    })

    test('應該正確處理排除ID參數', async () => {
      const mockMemes = [{ _id: 'meme2', createdAt: new Date(), author_id: { username: 'user2' } }]

      Meme.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = jest.fn().mockResolvedValue(15)

      mockReq.query = {
        page: '1',
        limit: '10',
        exclude_ids: 'meme1,meme3,meme5',
      }

      await getLatestRecommendations(mockReq, mockRes)

      // 驗證查詢條件包含排除ID
      expect(Meme.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $nin: ['meme1', 'meme3', 'meme5'] },
        }),
        expect.any(Object),
      )
    })

    test('應該正確處理最後一頁', async () => {
      const mockMemes = [{ _id: 'meme1', createdAt: new Date(), author_id: { username: 'user1' } }]

      Meme.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = jest.fn().mockResolvedValue(25)

      mockReq.query = {
        page: '5',
        limit: '5',
      }

      await getLatestRecommendations(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            page: 5,
            limit: 5,
            skip: 20,
            total: 25,
            hasMore: false, // 最後一頁
            totalPages: 5,
          }),
        }),
        error: null,
      })
    })
  })

  describe('錯誤處理測試', () => {
    test('應該處理資料庫錯誤', async () => {
      Meme.find = vi.fn().mockImplementation(() => {
        throw new Error('Database error')
      })

      mockReq.query = {
        page: '1',
        limit: '10',
      }

      await getHotRecommendations(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
      })
    })

    test('應該處理無效的頁碼參數', async () => {
      const mockMemes = [{ _id: 'meme1', hot_score: 100, author_id: { username: 'user1' } }]

      Meme.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockMemes),
            }),
          }),
        }),
      })
      Meme.countDocuments = jest.fn().mockResolvedValue(10)

      mockReq.query = {
        page: 'invalid',
        limit: '10',
      }

      await getHotRecommendations(mockReq, mockRes)

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
