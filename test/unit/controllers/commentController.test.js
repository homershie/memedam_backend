import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as commentController from '../../../controllers/commentController.js'

// Mock dependencies
vi.mock('../../../models/Comment.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../../models/Meme.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(),
  },
}))

vi.mock('../../../models/Notification.js', () => ({
  default: {
    create: vi.fn(),
  },
}))

vi.mock('../../../utils/notificationService.js', () => ({
  createNotification: vi.fn(),
  notifyMentionedUsers: vi.fn(),
}))

describe('Comment Controller', () => {
  let req, res, next
  let Comment, Meme, User, Notification

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const CommentModule = await import('../../../models/Comment.js')
    const MemeModule = await import('../../../models/Meme.js')
    const UserModule = await import('../../../models/User.js')
    const NotificationModule = await import('../../../models/Notification.js')

    Comment = CommentModule.default
    Meme = MemeModule.default
    User = UserModule.default
    Notification = NotificationModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
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

  describe('getComments', () => {
    it('應該返回迷因的評論列表', async () => {
      req.params = { memeId: 'meme123' }
      req.query = {
        page: '1',
        limit: '10',
        sort: 'latest',
      }

      const mockComments = [
        {
          _id: 'comment1',
          content: 'Great meme!',
          author: { _id: 'user1', username: 'user1' },
          meme: 'meme123',
          likes: 5,
          createdAt: new Date(),
        },
        {
          _id: 'comment2',
          content: 'Funny!',
          author: { _id: 'user2', username: 'user2' },
          meme: 'meme123',
          likes: 3,
          createdAt: new Date(),
        },
      ]

      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockComments),
      })

      Comment.countDocuments.mockResolvedValue(2)

      await commentController.getComments(req, res, next)

      expect(Comment.find).toHaveBeenCalledWith({ meme: 'meme123' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          comments: mockComments,
          pagination: expect.objectContaining({
            total: 2,
            page: 1,
            limit: 10,
          }),
        }),
      )
    })

    it('應該支援不同的排序選項', async () => {
      req.params = { memeId: 'meme123' }
      req.query = {
        sort: 'popular',
        page: '1',
        limit: '10',
      }

      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })

      Comment.countDocuments.mockResolvedValue(0)

      await commentController.getComments(req, res, next)

      const sortCall = Comment.find().sort
      expect(sortCall).toHaveBeenCalled()
    })

    it('應該支援回覆評論的查詢', async () => {
      req.params = { memeId: 'meme123' }
      req.query = {
        parentId: 'comment1',
        page: '1',
        limit: '10',
      }

      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })

      Comment.countDocuments.mockResolvedValue(0)

      await commentController.getComments(req, res, next)

      expect(Comment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          meme: 'meme123',
          parent: 'comment1',
        }),
      )
    })
  })

  describe('createComment', () => {
    it('應該成功創建評論', async () => {
      req.user = { id: 'user123' }
      req.params = { memeId: 'meme123' }
      req.body = {
        content: 'This is a great meme!',
      }

      const mockMeme = {
        _id: 'meme123',
        title: 'Test Meme',
        author: 'user456',
        comments: 5,
        save: vi.fn(),
      }

      const mockComment = {
        _id: 'newcomment123',
        content: 'This is a great meme!',
        author: 'user123',
        meme: 'meme123',
        populate: vi.fn().mockResolvedValue({
          _id: 'newcomment123',
          content: 'This is a great meme!',
          author: { _id: 'user123', username: 'testuser' },
          meme: 'meme123',
        }),
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Comment.create.mockResolvedValue(mockComment)

      await commentController.createComment(req, res, next)

      expect(Comment.create).toHaveBeenCalledWith({
        content: 'This is a great meme!',
        author: 'user123',
        meme: 'meme123',
      })

      expect(mockMeme.comments).toBe(6)
      expect(mockMeme.save).toHaveBeenCalled()

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          comment: expect.any(Object),
        }),
      )
    })

    it('應該處理迷因不存在的情況', async () => {
      req.user = { id: 'user123' }
      req.params = { memeId: 'nonexistent' }
      req.body = {
        content: 'Comment content',
      }

      Meme.findById.mockResolvedValue(null)

      await commentController.createComment(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('找不到'),
        }),
      )
    })

    it('應該支援回覆評論', async () => {
      req.user = { id: 'user123' }
      req.params = { memeId: 'meme123' }
      req.body = {
        content: 'This is a reply!',
        parentId: 'comment1',
      }

      const mockMeme = {
        _id: 'meme123',
        comments: 5,
        save: vi.fn(),
      }

      const mockParentComment = {
        _id: 'comment1',
        replies: 2,
        save: vi.fn(),
      }

      const mockComment = {
        _id: 'reply123',
        content: 'This is a reply!',
        author: 'user123',
        meme: 'meme123',
        parent: 'comment1',
        populate: vi.fn().mockResolvedValue({
          _id: 'reply123',
          content: 'This is a reply!',
          author: { _id: 'user123', username: 'testuser' },
          parent: 'comment1',
        }),
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Comment.findById.mockResolvedValue(mockParentComment)
      Comment.create.mockResolvedValue(mockComment)

      await commentController.createComment(req, res, next)

      expect(Comment.create).toHaveBeenCalledWith({
        content: 'This is a reply!',
        author: 'user123',
        meme: 'meme123',
        parent: 'comment1',
      })

      expect(mockParentComment.replies).toBe(3)
      expect(mockParentComment.save).toHaveBeenCalled()
    })

    it('應該處理提及用戶', async () => {
      req.user = { id: 'user123' }
      req.params = { memeId: 'meme123' }
      req.body = {
        content: 'Hey @user456, check this out!',
      }

      const mockMeme = {
        _id: 'meme123',
        comments: 0,
        save: vi.fn(),
      }

      const mockComment = {
        _id: 'comment123',
        content: 'Hey @user456, check this out!',
        populate: vi.fn().mockResolvedValue({
          _id: 'comment123',
          content: 'Hey @user456, check this out!',
          author: { _id: 'user123', username: 'testuser' },
        }),
      }

      Meme.findById.mockResolvedValue(mockMeme)
      Comment.create.mockResolvedValue(mockComment)
      User.findById.mockResolvedValue({ _id: 'user456', username: 'user456' })

      await commentController.createComment(req, res, next)

      // 驗證是否處理了提及通知
      const notificationService = await import('../../../utils/notificationService.js')
      expect(notificationService.notifyMentionedUsers).toHaveBeenCalled()
    })
  })

  describe('updateComment', () => {
    it('應該成功更新評論', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }
      req.body = {
        content: 'Updated comment content',
      }

      const mockComment = {
        _id: 'comment123',
        author: 'user123',
        content: 'Old content',
      }

      Comment.findById.mockResolvedValue(mockComment)
      Comment.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: 'comment123',
          content: 'Updated comment content',
          author: { _id: 'user123', username: 'testuser' },
          isEdited: true,
          editedAt: new Date(),
        }),
      })

      await commentController.updateComment(req, res, next)

      expect(Comment.findByIdAndUpdate).toHaveBeenCalledWith(
        'comment123',
        expect.objectContaining({
          content: 'Updated comment content',
          isEdited: true,
          editedAt: expect.any(Date),
        }),
        expect.objectContaining({
          new: true,
          runValidators: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          comment: expect.any(Object),
        }),
      )
    })

    it('應該拒絕非作者的更新請求', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }
      req.body = {
        content: 'Updated content',
      }

      const mockComment = {
        _id: 'comment123',
        author: 'user456', // Different author
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.updateComment(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('deleteComment', () => {
    it('應該成功刪除評論', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        author: 'user123',
        meme: 'meme123',
      }

      const mockMeme = {
        _id: 'meme123',
        comments: 5,
        save: vi.fn(),
      }

      Comment.findById.mockResolvedValue(mockComment)
      Meme.findById.mockResolvedValue(mockMeme)
      Comment.findByIdAndDelete.mockResolvedValue(mockComment)
      Comment.deleteMany.mockResolvedValue({ deletedCount: 2 }) // Delete replies

      await commentController.deleteComment(req, res, next)

      expect(Comment.findByIdAndDelete).toHaveBeenCalledWith('comment123')
      expect(Comment.deleteMany).toHaveBeenCalledWith({ parent: 'comment123' })
      expect(mockMeme.comments).toBe(4)
      expect(mockMeme.save).toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('刪除成功'),
        }),
      )
    })

    it('應該拒絕非作者的刪除請求', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        author: 'user456',
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.deleteComment(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('likeComment', () => {
    it('應該成功按讚評論', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        likes: 5,
        likedBy: [],
        save: vi.fn(),
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.likeComment(req, res, next)

      expect(mockComment.likes).toBe(6)
      expect(mockComment.likedBy).toContain('user123')
      expect(mockComment.save).toHaveBeenCalled()

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
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        likes: 5,
        likedBy: ['user123'], // Already liked
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.likeComment(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('已經按讚'),
        }),
      )
    })
  })

  describe('unlikeComment', () => {
    it('應該成功取消按讚', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        likes: 5,
        likedBy: ['user123', 'user456'],
        save: vi.fn(),
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.unlikeComment(req, res, next)

      expect(mockComment.likes).toBe(4)
      expect(mockComment.likedBy).not.toContain('user123')
      expect(mockComment.save).toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('取消按讚'),
          likes: 4,
        }),
      )
    })

    it('應該處理未按讚的取消請求', async () => {
      req.user = { id: 'user123' }
      req.params = {
        memeId: 'meme123',
        commentId: 'comment123',
      }

      const mockComment = {
        _id: 'comment123',
        likes: 5,
        likedBy: ['user456'], // user123 not in list
      }

      Comment.findById.mockResolvedValue(mockComment)

      await commentController.unlikeComment(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('尚未按讚'),
        }),
      )
    })
  })

  describe('getUserComments', () => {
    it('應該返回用戶的評論列表', async () => {
      req.params = { userId: 'user123' }
      req.query = {
        page: '1',
        limit: '10',
      }

      const mockComments = [
        {
          _id: 'comment1',
          content: 'My comment 1',
          author: 'user123',
          meme: { _id: 'meme1', title: 'Meme 1' },
        },
        {
          _id: 'comment2',
          content: 'My comment 2',
          author: 'user123',
          meme: { _id: 'meme2', title: 'Meme 2' },
        },
      ]

      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockComments),
      })

      Comment.countDocuments.mockResolvedValue(2)

      await commentController.getUserComments(req, res, next)

      expect(Comment.find).toHaveBeenCalledWith({ author: 'user123' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          comments: mockComments,
          pagination: expect.any(Object),
        }),
      )
    })
  })
})
