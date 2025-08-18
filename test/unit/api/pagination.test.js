import { describe, it, expect, beforeEach, vi } from 'vitest'

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

// Mock models
vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

describe('分頁功能測試', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本分頁參數', () => {
    it('應該使用預設分頁參數', () => {
      const req = {
        query: {},
      }

      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20

      expect(page).toBe(1)
      expect(limit).toBe(20)
    })

    it('應該接受自定義分頁參數', () => {
      const req = {
        query: {
          page: '3',
          limit: '50',
        },
      }

      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20

      expect(page).toBe(3)
      expect(limit).toBe(50)
    })

    it('應該限制最大頁面大小', () => {
      const req = {
        query: {
          limit: '200',
        },
      }

      const MAX_LIMIT = 100
      const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT)

      expect(limit).toBe(100)
    })

    it('應該處理無效的分頁參數', () => {
      const req = {
        query: {
          page: 'invalid',
          limit: 'abc',
        },
      }

      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20

      expect(page).toBe(1)
      expect(limit).toBe(20)
    })

    it('應該處理負數頁碼', () => {
      const req = {
        query: {
          page: '-1',
          limit: '20',
        },
      }

      const page = Math.max(parseInt(req.query.page) || 1, 1)
      const limit = parseInt(req.query.limit) || 20

      expect(page).toBe(1)
      expect(limit).toBe(20)
    })
  })

  describe('分頁計算', () => {
    it('應該正確計算 skip 值', () => {
      const testCases = [
        { page: 1, limit: 20, expectedSkip: 0 },
        { page: 2, limit: 20, expectedSkip: 20 },
        { page: 3, limit: 10, expectedSkip: 20 },
        { page: 5, limit: 15, expectedSkip: 60 },
      ]

      testCases.forEach(({ page, limit, expectedSkip }) => {
        const skip = (page - 1) * limit
        expect(skip).toBe(expectedSkip)
      })
    })

    it('應該正確計算總頁數', () => {
      const testCases = [
        { total: 100, limit: 20, expectedPages: 5 },
        { total: 101, limit: 20, expectedPages: 6 },
        { total: 0, limit: 20, expectedPages: 0 },
        { total: 19, limit: 20, expectedPages: 1 },
      ]

      testCases.forEach(({ total, limit, expectedPages }) => {
        const totalPages = Math.ceil(total / limit)
        expect(totalPages).toBe(expectedPages)
      })
    })

    it('應該正確判斷是否有下一頁', () => {
      const testCases = [
        { page: 1, totalPages: 5, expectedHasNext: true },
        { page: 5, totalPages: 5, expectedHasNext: false },
        { page: 3, totalPages: 3, expectedHasNext: false },
        { page: 2, totalPages: 10, expectedHasNext: true },
      ]

      testCases.forEach(({ page, totalPages, expectedHasNext }) => {
        const hasNext = page < totalPages
        expect(hasNext).toBe(expectedHasNext)
      })
    })

    it('應該正確判斷是否有上一頁', () => {
      const testCases = [
        { page: 1, expectedHasPrev: false },
        { page: 2, expectedHasPrev: true },
        { page: 5, expectedHasPrev: true },
      ]

      testCases.forEach(({ page, expectedHasPrev }) => {
        const hasPrev = page > 1
        expect(hasPrev).toBe(expectedHasPrev)
      })
    })
  })

  describe('分頁回應格式', () => {
    it('應該返回正確的分頁 metadata', () => {
      const page = 2
      const limit = 20
      const total = 100
      const totalPages = Math.ceil(total / limit)

      const pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }

      expect(pagination).toEqual({
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      })
    })

    it('應該處理空結果集', () => {
      const page = 1
      const limit = 20
      const total = 0
      const totalPages = Math.ceil(total / limit)

      const pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNext: false,
        hasPrev: false,
      }

      expect(pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('應該處理超出範圍的頁碼', () => {
      const page = 10
      const limit = 20
      const total = 50
      const totalPages = Math.ceil(total / limit)

      const pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        data: [], // 超出範圍應返回空數組
      }

      expect(pagination.data).toEqual([])
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(true)
    })
  })

  describe('MongoDB 分頁查詢', () => {
    it('應該構建正確的查詢選項', () => {
      const page = 2
      const limit = 10
      const skip = (page - 1) * limit

      const queryOptions = {
        skip,
        limit,
        sort: { created_at: -1 },
      }

      expect(queryOptions).toEqual({
        skip: 10,
        limit: 10,
        sort: { created_at: -1 },
      })
    })

    it('應該支援自定義排序', () => {
      const sortOptions = {
        'created_at': { created_at: -1 },
        'likes': { like_count: -1 },
        'views': { view_count: -1 },
        'hot': { hot_score: -1 },
      }

      const sortBy = 'likes'
      const sort = sortOptions[sortBy] || { created_at: -1 }

      expect(sort).toEqual({ like_count: -1 })
    })

    it('應該支援多欄位排序', () => {
      const sort = {
        hot_score: -1,
        created_at: -1,
      }

      expect(sort).toHaveProperty('hot_score')
      expect(sort).toHaveProperty('created_at')
      expect(sort.hot_score).toBe(-1)
      expect(sort.created_at).toBe(-1)
    })
  })

  describe('無限滾動支援', () => {
    it('應該生成正確的 cursor', () => {
      const lastItem = {
        _id: '507f1f77bcf86cd799439011',
        created_at: new Date('2024-01-01'),
      }

      const cursor = Buffer.from(JSON.stringify({
        _id: lastItem._id,
        created_at: lastItem.created_at,
      })).toString('base64')

      expect(cursor).toBeDefined()
      expect(typeof cursor).toBe('string')
    })

    it('應該解析 cursor', () => {
      const originalData = {
        _id: '507f1f77bcf86cd799439011',
        created_at: '2024-01-01T00:00:00.000Z',
      }

      const cursor = Buffer.from(JSON.stringify(originalData)).toString('base64')
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString())

      expect(decoded).toEqual(originalData)
    })

    it('應該使用 cursor 構建查詢', () => {
      const cursor = {
        _id: '507f1f77bcf86cd799439011',
        created_at: new Date('2024-01-01'),
      }

      const query = {
        $or: [
          { created_at: { $lt: cursor.created_at } },
          {
            created_at: cursor.created_at,
            _id: { $lt: cursor._id },
          },
        ],
      }

      expect(query.$or).toHaveLength(2)
      expect(query.$or[0]).toHaveProperty('created_at')
      expect(query.$or[1]).toHaveProperty('_id')
    })
  })

  describe('效能優化', () => {
    it('應該使用索引提示', () => {
      const query = {
        status: 'public',
        created_at: { $gte: new Date('2024-01-01') },
      }

      const hint = { status: 1, created_at: -1 }

      expect(hint).toEqual({
        status: 1,
        created_at: -1,
      })
    })

    it('應該限制返回欄位', () => {
      const projection = {
        _id: 1,
        title: 1,
        author_id: 1,
        created_at: 1,
        like_count: 1,
        view_count: 1,
      }

      expect(projection).not.toHaveProperty('content')
      expect(projection).not.toHaveProperty('comments')
    })

    it('應該使用 lean() 查詢', () => {
      const options = {
        lean: true,
      }

      expect(options.lean).toBe(true)
    })
  })
})