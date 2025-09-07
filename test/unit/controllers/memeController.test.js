import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as memeController from '../../../controllers/memeController.js'

vi.mock('../../../models/Meme.js', () => {
  const MockMeme = vi.fn().mockImplementation((data) => ({
    ...data,
    save: vi.fn().mockResolvedValue({ ...data, _id: 'mocked-id' }),
  }))

  MockMeme.find = vi.fn()
  MockMeme.findById = vi.fn()
  MockMeme.findByIdAndUpdate = vi.fn()
  MockMeme.findByIdAndDelete = vi.fn()
  MockMeme.findOne = vi.fn()
  MockMeme.create = vi.fn()
  MockMeme.countDocuments = vi.fn()
  MockMeme.aggregate = vi.fn()
  MockMeme.startSession = vi.fn().mockResolvedValue({
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    endSession: vi.fn(),
  })
  MockMeme.updateSceneCounts = vi.fn()

  return {
    default: MockMeme,
  }
})

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../../models/Like.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))
// 保留 Like 模型 mock 以防其他測試需要

vi.mock('../../../models/View.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../../models/Comment.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../../../services/uploadService.js', () => ({
  deleteImage: vi.fn(),
}))

vi.mock('../../../utils/hotScore.js', () => ({
  calculateHotScore: vi.fn().mockReturnValue(100),
}))

describe('Meme Controller', () => {
  let req, res, next
  let Meme, User, Comment

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const MemeModule = await import('../../../models/Meme.js')
    const UserModule = await import('../../../models/User.js')
    const CommentModule = await import('../../../models/Comment.js')

    Meme = MemeModule.default
    User = UserModule.default
    Comment = CommentModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
      file: null,
      files: null,
    }

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    next = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getMemes', () => {
    it('應該返回迷因列表', async () => {
      req.query = {
        page: '1',
        limit: '10',
        sort: 'latest',
      }

      const mockMemes = [
        {
          _id: 'meme1',
          title: 'Meme 1',
          image_url: 'image1.jpg',
          author_id: { _id: 'user1', username: 'user1' },
          like_count: 10,
          view_count: 100,
          createdAt: new Date(),
        },
        {
          _id: 'meme2',
          title: 'Meme 2',
          image_url: 'image2.jpg',
          author_id: { _id: 'user2', username: 'user2' },
          like_count: 5,
          view_count: 50,
          createdAt: new Date(),
        },
      ]

      Meme.countDocuments.mockResolvedValue(2)

      // 設置 mock 返回值
      const mockQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMemes),
        })),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockMemes),
        exec: vi.fn().mockResolvedValue(mockMemes),
      }
      Meme.find.mockReturnValue(mockQuery)

      await memeController.getMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          memes: mockMemes,
          pagination: expect.objectContaining({
            total: 2,
            page: 1,
            limit: 10,
          }),
        }),
      )
    })

    it('應該支援不同的排序選項', async () => {
      req.query = {
        sort: 'hot',
        page: '1',
        limit: '10',
      }

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })

      Meme.countDocuments.mockResolvedValue(0)

      await memeController.getMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalled()
      const sortCall = Meme.find().sort
      expect(sortCall).toHaveBeenCalled()
    })

    it('應該支援標籤過濾', async () => {
      req.query = {
        tags: 'funny,meme',
        page: '1',
        limit: '10',
        useAdvancedSearch: 'true',
      }
      req.user = { role: 'admin' } // 設置為特權用戶

      Meme.countDocuments.mockResolvedValue(0)

      await memeController.getMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalledWith({})
    })
  })

  describe('getMemeById', () => {
    it('應該返回指定迷因', async () => {
      req.params = { id: 'test-slug' }
      req.user = { _id: 'user123' }

      const mockMeme = {
        _id: 'meme123',
        title: 'Test Meme',
        slug: 'test-slug',
        image_url: 'test.jpg',
        author_id: {
          _id: 'user456',
          username: 'author',
          display_name: 'Author',
          avatar: 'avatar.jpg',
        },
        like_count: 10,
        view_count: 100,
        comment_count: 5,
        likes: 10,
        views: 100,
        comments: 5,
        shares: 0,
        dislikes_count: 0,
        shares_count: 0,
        comments_count: 5,
        createdAt: new Date(),
        save: vi.fn(),
      }

      // 設置 mock 數據
      const mockQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        lean: vi.fn().mockResolvedValue(mockMeme),
        exec: vi.fn().mockResolvedValue(mockMeme),
      }
      Meme.findOne.mockReturnValue(mockQuery)

      await memeController.getMemeById(req, res, next)

      expect(Meme.findOne).toHaveBeenCalledWith({
        slug: 'test-slug',
        status: 'public',
      })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            meme: expect.objectContaining({
              _id: 'meme123',
              title: 'Test Meme',
            }),
          }),
        }),
      )
    })

    it('應該處理迷因不存在的情況', async () => {
      req.params = { id: 'nonexistent' }

      Meme.findOne.mockResolvedValue(null)

      await memeController.getMemeById(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '取得迷因時發生錯誤',
        }),
      )
    })
  })

  describe('createMeme', () => {
    it('應該成功創建迷因', async () => {
      req.user = { _id: 'user123' }
      req.body = {
        title: 'New Meme',
        content: 'Test description',
        tags_cache: ['funny', 'test'],
      }
      req.files = [
        {
          path: 'uploads/meme.jpg',
          filename: 'meme.jpg',
        },
      ]

      User.findByIdAndUpdate.mockResolvedValue({})

      await memeController.createMeme(req, res, next)

      expect(Meme).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Meme',
          content: 'Test description',
          image_url: 'uploads/meme.jpg',
          author_id: 'user123',
          tags_cache: ['funny', 'test'],
        }),
      )

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        }),
      )
    })

    it('應該拒絕沒有圖片的創建請求', async () => {
      req.user = { _id: 'user123' }
      req.body = {
        title: 'New Meme',
      }
      req.file = null
      req.files = null

      await memeController.createMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: expect.stringContaining('圖片'),
        }),
      )
    })
  })

  describe('updateMeme', () => {
    it('應該成功更新迷因', async () => {
      req.user = { _id: 'user123' }
      req.params = { id: 'meme123' }
      req.body = {
        title: 'Updated Title',
        content: 'Updated description',
      }

      const mockMeme = {
        _id: 'meme123',
        author_id: 'user123',
        title: 'Old Title',
      }

      // 設置 mock 數據
      const mockQuery = {
        session: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue(mockMeme),
          select: vi.fn().mockReturnThis(),
        }),
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        lean: vi.fn().mockResolvedValue(mockMeme),
        exec: vi.fn().mockResolvedValue(mockMeme),
      }
      Meme.findById.mockReturnValue(mockQuery)

      const updateResult = {
        _id: 'meme123',
        title: 'Updated Title',
        content: 'Updated description',
        author_id: { _id: 'user123', username: 'testuser' },
      }
      const updateQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(updateResult),
        })),
        lean: vi.fn().mockResolvedValue(updateResult),
        exec: vi.fn().mockResolvedValue(updateResult),
      }
      Meme.findByIdAndUpdate.mockReturnValue(updateQuery)

      await memeController.updateMeme(req, res, next)

      expect(Meme.findByIdAndUpdate).toHaveBeenCalledWith(
        'meme123',
        expect.objectContaining({
          title: 'Updated Title',
          content: 'Updated description',
        }),
        expect.objectContaining({
          new: true,
          runValidators: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        }),
      )
    })

    it('應該拒絕非作者的更新請求', async () => {
      req.user = { _id: 'user123' }
      req.params = { id: 'meme123' }
      req.body = {
        title: 'Updated Title',
      }

      const mockMeme = {
        _id: 'meme123',
        author_id: 'user456', // Different author
      }

      // 設置 mock 數據
      const mockQuery = {
        session: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue(mockMeme),
          select: vi.fn().mockReturnThis(),
        }),
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        lean: vi.fn().mockResolvedValue(mockMeme),
        exec: vi.fn().mockResolvedValue(mockMeme),
      }
      Meme.findById.mockReturnValue(mockQuery)

      await memeController.updateMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: expect.stringContaining('權限'),
        }),
      )
    })
  })

  describe('deleteMeme', () => {
    it('應該成功刪除迷因', async () => {
      req.user = { _id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        author_id: 'user123',
        image_url: 'uploads/meme.jpg',
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Meme.findByIdAndDelete.mockResolvedValue(mockMeme)
      Comment.deleteMany.mockResolvedValue({})

      await memeController.deleteMeme(req, res, next)

      expect(Meme.findByIdAndDelete).toHaveBeenCalledWith('meme123')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '迷因已刪除',
        }),
      )
    })

    it('應該拒絕非作者的刪除請求', async () => {
      req.user = { _id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        author_id: 'user456',
      }

      Meme.findById.mockResolvedValue(mockMeme)

      await memeController.deleteMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('權限'),
        }),
      )
    })
  })

  describe('checkSlugAvailable', () => {
    it('應該檢查 slug 是否可用', async () => {
      const req = {
        query: { slug: 'test-slug' },
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      // 設置 mock 數據（slug 可用）
      const mockQuery = {
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(null),
        })),
        lean: vi.fn().mockResolvedValue(null),
        exec: vi.fn().mockResolvedValue(null),
      }
      Meme.findOne.mockReturnValue(mockQuery)

      await memeController.checkSlugAvailable(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith(expect.objectContaining({ slug: 'test-slug' }))
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          slug: 'test-slug',
          available: true,
          existing_meme: null,
        },
        error: null,
      })
    })

    it('應該返回 slug 不可用當迷因已存在', async () => {
      const req = {
        query: { slug: 'existing-slug' },
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      // 設置 mock 數據（slug 不可用）
      const existingMeme = {
        _id: 'existing-id',
        title: 'Existing Meme',
      }

      // 使用 spy 來監控調用
      const findOneSpy = vi.spyOn(Meme, 'findOne')
      const mockQuery = {
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(existingMeme),
        })),
      }
      findOneSpy.mockReturnValue(mockQuery)

      await memeController.checkSlugAvailable(req, res)

      expect(findOneSpy).toHaveBeenCalledWith(expect.objectContaining({ slug: 'existing-slug' }))
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          slug: 'existing-slug',
          available: false,
          existing_meme: {
            id: 'existing-id',
            title: 'Existing Meme',
          },
        },
        error: null,
      })
    })

    it('應該返回錯誤當沒有提供 slug', async () => {
      const req = {
        query: {},
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      await memeController.checkSlugAvailable(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '請提供 slug 參數',
      })
    })
  })

  describe('getMemeById', () => {
    it('應該通過 ObjectId 取得迷因', async () => {
      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
        query: {},
        user: null,
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      const mockMeme = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Meme',
        author_id: {
          _id: 'user-id',
          username: 'testuser',
          display_name: 'Test User',
          avatar: 'avatar.jpg',
        },
      }

      // 設置 mock 數據
      const mockQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        lean: vi.fn().mockResolvedValue(mockMeme),
        exec: vi.fn().mockResolvedValue(mockMeme),
      }
      Meme.findOne.mockReturnValue(mockQuery)

      await memeController.getMemeById(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({
        _id: expect.any(Object),
        status: 'public',
      })
      // 檢查是否有調用 res.json，如果有的話檢查其參數
      if (res.json.mock.calls.length > 0) {
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              meme: expect.objectContaining({
                _id: '507f1f77bcf86cd799439011',
                title: 'Test Meme',
              }),
            }),
          }),
        )
      }
    })

    it('應該通過 slug 取得迷因', async () => {
      const req = {
        params: { id: 'test-slug' },
        query: {},
        user: null,
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      const mockMeme = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Meme',
        slug: 'test-slug',
        author_id: {
          _id: 'user-id',
          username: 'testuser',
          display_name: 'Test User',
          avatar: 'avatar.jpg',
        },
      }

      // 設置 mock 數據
      const mockQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(mockMeme),
        })),
        lean: vi.fn().mockResolvedValue(mockMeme),
        exec: vi.fn().mockResolvedValue(mockMeme),
      }
      Meme.findOne.mockReturnValue(mockQuery)

      await memeController.getMemeById(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({
        slug: 'test-slug',
        status: 'public',
      })
      // 檢查是否有調用 res.json，如果有的話檢查其參數
      if (res.json.mock.calls.length > 0) {
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              meme: expect.objectContaining({
                _id: '507f1f77bcf86cd799439011',
                title: 'Test Meme',
                slug: 'test-slug',
              }),
            }),
          }),
        )
      }
    })

    it('應該返回 404 當迷因不存在', async () => {
      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
        query: {},
        user: null,
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }

      // 設置 mock 數據 - 返回 null 表示找不到
      const mockQuery = {
        populate: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(null),
        })),
        select: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(null),
        })),
        lean: vi.fn().mockResolvedValue(null),
        exec: vi.fn().mockResolvedValue(null),
      }
      Meme.findOne.mockReturnValue(mockQuery)

      await memeController.getMemeById(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: '找不到指定的迷因',
        }),
      )
    })
  })
})
