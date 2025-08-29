import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as memeController from '../../../controllers/memeController.js'

// Mock dependencies
vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    findOne: vi.fn(), // Added findOne to Meme mock
  },
}))

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
  let Meme, User, Like, View, Comment

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const MemeModule = await import('../../../models/Meme.js')
    const UserModule = await import('../../../models/User.js')
    const LikeModule = await import('../../../models/Like.js')
    const ViewModule = await import('../../../models/View.js')
    const CommentModule = await import('../../../models/Comment.js')

    Meme = MemeModule.default
    User = UserModule.default
    Like = LikeModule.default
    View = ViewModule.default
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
          imageUrl: 'image1.jpg',
          author: { _id: 'user1', username: 'user1' },
          likes: 10,
          views: 100,
          createdAt: new Date(),
        },
        {
          _id: 'meme2',
          title: 'Meme 2',
          imageUrl: 'image2.jpg',
          author: { _id: 'user2', username: 'user2' },
          likes: 5,
          views: 50,
          createdAt: new Date(),
        },
      ]

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMemes),
      })

      Meme.countDocuments.mockResolvedValue(2)

      await memeController.getMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
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
      }

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })

      Meme.countDocuments.mockResolvedValue(0)

      await memeController.getMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.objectContaining({
            $in: expect.arrayContaining(['funny', 'meme']),
          }),
        }),
      )
    })
  })

  describe('getMemeById', () => {
    it('應該返回指定迷因', async () => {
      req.params = { id: 'meme123' }
      req.user = { id: 'user123' }

      const mockMeme = {
        _id: 'meme123',
        title: 'Test Meme',
        imageUrl: 'test.jpg',
        author: { _id: 'user456', username: 'author' },
        likes: 10,
        views: 100,
        comments: 5,
        save: vi.fn(),
      }

      Meme.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockMeme),
      })

      View.findOne.mockResolvedValue(null)
      View.create.mockResolvedValue({})
      Like.findOne.mockResolvedValue(null)

      await memeController.getMemeById(req, res, next)

      expect(Meme.findById).toHaveBeenCalledWith('meme123')
      expect(View.create).toHaveBeenCalledWith({
        meme: 'meme123',
        viewer: 'user123',
      })
      expect(mockMeme.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meme: expect.objectContaining({
            _id: 'meme123',
            title: 'Test Meme',
            isLiked: false,
          }),
        }),
      )
    })

    it('應該處理迷因不存在的情況', async () => {
      req.params = { id: 'nonexistent' }

      Meme.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      })

      await memeController.getMemeById(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('找不到'),
        }),
      )
    })
  })

  describe('createMeme', () => {
    it('應該成功創建迷因', async () => {
      req.user = { id: 'user123' }
      req.body = {
        title: 'New Meme',
        description: 'Test description',
        tags: ['funny', 'test'],
      }
      req.file = {
        path: 'uploads/meme.jpg',
        filename: 'meme.jpg',
      }

      const mockMeme = {
        _id: 'newmeme123',
        title: 'New Meme',
        description: 'Test description',
        imageUrl: 'uploads/meme.jpg',
        author: 'user123',
        tags: ['funny', 'test'],
        populate: vi.fn().mockResolvedValue({
          _id: 'newmeme123',
          title: 'New Meme',
          author: { _id: 'user123', username: 'testuser' },
        }),
      }

      Meme.create.mockResolvedValue(mockMeme)
      User.findByIdAndUpdate.mockResolvedValue({})

      await memeController.createMeme(req, res, next)

      expect(Meme.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Meme',
          description: 'Test description',
          imageUrl: 'uploads/meme.jpg',
          author: 'user123',
          tags: ['funny', 'test'],
        }),
      )

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meme: expect.any(Object),
        }),
      )
    })

    it('應該拒絕沒有圖片的創建請求', async () => {
      req.user = { id: 'user123' }
      req.body = {
        title: 'New Meme',
      }
      req.file = null

      await memeController.createMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('圖片'),
        }),
      )
    })
  })

  describe('updateMeme', () => {
    it('應該成功更新迷因', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }
      req.body = {
        title: 'Updated Title',
        description: 'Updated description',
      }

      const mockMeme = {
        _id: 'meme123',
        author: 'user123',
        title: 'Old Title',
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Meme.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: 'meme123',
          title: 'Updated Title',
          description: 'Updated description',
          author: { _id: 'user123', username: 'testuser' },
        }),
      })

      await memeController.updateMeme(req, res, next)

      expect(Meme.findByIdAndUpdate).toHaveBeenCalledWith(
        'meme123',
        expect.objectContaining({
          title: 'Updated Title',
          description: 'Updated description',
        }),
        expect.objectContaining({
          new: true,
          runValidators: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meme: expect.any(Object),
        }),
      )
    })

    it('應該拒絕非作者的更新請求', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }
      req.body = {
        title: 'Updated Title',
      }

      const mockMeme = {
        _id: 'meme123',
        author: 'user456', // Different author
      }

      Meme.findById.mockResolvedValue(mockMeme)

      await memeController.updateMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('deleteMeme', () => {
    it('應該成功刪除迷因', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        author: 'user123',
        imageUrl: 'uploads/meme.jpg',
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Meme.findByIdAndDelete.mockResolvedValue(mockMeme)
      Comment.deleteMany.mockResolvedValue({})
      Like.deleteMany = vi.fn().mockResolvedValue({})
      View.deleteMany = vi.fn().mockResolvedValue({})

      await memeController.deleteMeme(req, res, next)

      expect(Meme.findByIdAndDelete).toHaveBeenCalledWith('meme123')
      expect(Comment.deleteMany).toHaveBeenCalledWith({ meme: 'meme123' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('刪除成功'),
        }),
      )
    })

    it('應該拒絕非作者的刪除請求', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        author: 'user456',
      }

      Meme.findById.mockResolvedValue(mockMeme)

      await memeController.deleteMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('likeMeme', () => {
    it('應該成功按讚迷因', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        likes: 5,
        save: vi.fn(),
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Like.findOne.mockResolvedValue(null)
      Like.create.mockResolvedValue({})

      await memeController.likeMeme(req, res, next)

      expect(Like.create).toHaveBeenCalledWith({
        user: 'user123',
        meme: 'meme123',
      })
      expect(mockMeme.likes).toBe(6)
      expect(mockMeme.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('按讚成功'),
          likes: 6,
        }),
      )
    })

    it('應該處理重複按讚', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }

      Like.findOne.mockResolvedValue({ _id: 'like123' })

      await memeController.likeMeme(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('已經按讚'),
        }),
      )
    })
  })

  describe('unlikeMeme', () => {
    it('應該成功取消按讚', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'meme123' }

      const mockMeme = {
        _id: 'meme123',
        likes: 5,
        save: vi.fn(),
      }

      const mockLike = {
        _id: 'like123',
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Like.findOne.mockResolvedValue(mockLike)
      Like.deleteOne.mockResolvedValue({})

      await memeController.unlikeMeme(req, res, next)

      expect(Like.deleteOne).toHaveBeenCalledWith({
        user: 'user123',
        meme: 'meme123',
      })
      expect(mockMeme.likes).toBe(4)
      expect(mockMeme.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('取消按讚'),
          likes: 4,
        }),
      )
    })
  })

  describe('searchMemes', () => {
    it('應該搜索並返回匹配的迷因', async () => {
      req.query = {
        q: 'funny',
        page: '1',
        limit: '10',
      }

      const mockMemes = [
        { _id: 'meme1', title: 'Funny meme 1' },
        { _id: 'meme2', title: 'Funny meme 2' },
      ]

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMemes),
      })

      Meme.countDocuments.mockResolvedValue(2)

      await memeController.searchMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { title: expect.any(RegExp) },
            { description: expect.any(RegExp) },
            { tags: expect.any(RegExp) },
          ]),
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          memes: mockMemes,
          pagination: expect.any(Object),
        }),
      )
    })
  })

  describe('checkSlugAvailable', () => {
    it('應該檢查 slug 是否可用', async () => {
      const req = {
        query: { slug: 'test-slug' }
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      // Mock Meme.findOne 返回 null（表示 slug 可用）
      Meme.findOne.mockResolvedValue(null)

      await memeController.checkSlugAvailable(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({ slug: 'test-slug' })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          slug: 'test-slug',
          available: true,
          existing_meme: null
        },
        error: null
      })
    })

    it('應該返回 slug 不可用當迷因已存在', async () => {
      const req = {
        query: { slug: 'existing-slug' }
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      // Mock Meme.findOne 返回現有迷因
      Meme.findOne.mockResolvedValue({
        _id: 'existing-id',
        title: 'Existing Meme'
      })

      await memeController.checkSlugAvailable(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({ slug: 'existing-slug' })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          slug: 'existing-slug',
          available: false,
          existing_meme: {
            id: 'existing-id',
            title: 'Existing Meme'
          }
        },
        error: null
      })
    })

    it('應該返回錯誤當沒有提供 slug', async () => {
      const req = {
        query: {}
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      await memeController.checkSlugAvailable(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '請提供 slug 參數'
      })
    })
  })

  describe('getMemeById', () => {
    it('應該通過 ObjectId 取得迷因', async () => {
      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
        query: {},
        user: null
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      const mockMeme = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Meme',
        author_id: {
          _id: 'user-id',
          username: 'testuser',
          display_name: 'Test User',
          avatar: 'avatar.jpg'
        }
      }

      Meme.findOne.mockResolvedValue(mockMeme)

      await memeController.getMemeById(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({ _id: expect.any(Object) })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          meme: expect.objectContaining({
            _id: '507f1f77bcf86cd799439011',
            title: 'Test Meme'
          })
        },
        error: null
      })
    })

    it('應該通過 slug 取得迷因', async () => {
      const req = {
        params: { id: 'test-slug' },
        query: {},
        user: null
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      const mockMeme = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Meme',
        slug: 'test-slug',
        author_id: {
          _id: 'user-id',
          username: 'testuser',
          display_name: 'Test User',
          avatar: 'avatar.jpg'
        }
      }

      Meme.findOne.mockResolvedValue(mockMeme)

      await memeController.getMemeById(req, res)

      expect(Meme.findOne).toHaveBeenCalledWith({ slug: 'test-slug' })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          meme: expect.objectContaining({
            _id: '507f1f77bcf86cd799439011',
            title: 'Test Meme',
            slug: 'test-slug'
          })
        },
        error: null
      })
    })

    it('應該返回 404 當迷因不存在', async () => {
      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
        query: {},
        user: null
      }
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      }

      Meme.findOne.mockResolvedValue(null)

      await memeController.getMemeById(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '找不到指定的迷因'
      })
    })
  })
})
