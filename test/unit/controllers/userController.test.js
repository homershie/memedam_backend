import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as userController from '../../../controllers/userController.js'

// Mock dependencies
vi.mock('../../../models/User.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../../../models/Follow.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../../utils/deleteImg.js', () => ({
  deleteImage: vi.fn(),
}))

describe('User Controller', () => {
  let req, res, next
  let User, Meme, Follow

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const UserModule = await import('../../../models/User.js')
    const MemeModule = await import('../../../models/Meme.js')
    const FollowModule = await import('../../../models/Follow.js')

    User = UserModule.default
    Meme = MemeModule.default
    Follow = FollowModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
      file: null,
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

  describe('getUsers', () => {
    it('應該返回用戶列表', async () => {
      req.query = {
        page: '1',
        limit: '10',
        search: '',
      }

      const mockUsers = [
        { _id: 'user1', username: 'user1', email: 'user1@example.com' },
        { _id: 'user2', username: 'user2', email: 'user2@example.com' },
      ]

      User.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue(mockUsers),
      })

      User.countDocuments.mockResolvedValue(2)

      await userController.getUsers(req, res, next)

      expect(User.find).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          users: mockUsers,
          pagination: expect.objectContaining({
            total: 2,
            page: 1,
            limit: 10,
          }),
        }),
      )
    })

    it('應該支援搜索功能', async () => {
      req.query = {
        search: 'test',
        page: '1',
        limit: '10',
      }

      User.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([]),
      })

      User.countDocuments.mockResolvedValue(0)

      await userController.getUsers(req, res, next)

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { username: expect.any(RegExp) },
            { email: expect.any(RegExp) },
          ]),
        }),
      )
    })
  })

  describe('getUserById', () => {
    it('應該返回指定用戶資料', async () => {
      req.params = { id: 'user123' }

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        bio: 'Test bio',
        avatar: 'avatar.jpg',
        createdAt: new Date(),
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockResolvedValue(mockUser),
      })

      await userController.getUserById(req, res, next)

      expect(User.findById).toHaveBeenCalledWith('user123')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: mockUser,
        }),
      )
    })

    it('應該處理用戶不存在的情況', async () => {
      req.params = { id: 'nonexistent' }

      User.findById.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockResolvedValue(null),
      })

      await userController.getUserById(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('找不到'),
        }),
      )
    })
  })

  describe('updateUser', () => {
    it('應該成功更新用戶資料', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'user123' }
      req.body = {
        username: 'newusername',
        bio: 'New bio',
      }

      const mockUpdatedUser = {
        _id: 'user123',
        username: 'newusername',
        bio: 'New bio',
        email: 'test@example.com',
      }

      User.findByIdAndUpdate.mockResolvedValue(mockUpdatedUser)

      await userController.updateUser(req, res, next)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          username: 'newusername',
          bio: 'New bio',
        }),
        expect.objectContaining({
          new: true,
          runValidators: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: mockUpdatedUser,
        }),
      )
    })

    it('應該拒絕未授權的更新', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'user456' } // Different user
      req.body = {
        username: 'newusername',
      }

      await userController.updateUser(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })

    it('應該處理頭像上傳', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'user123' }
      req.file = {
        path: 'uploads/avatar.jpg',
        filename: 'avatar.jpg',
      }
      req.body = {}

      const mockUser = {
        _id: 'user123',
        avatar: 'old-avatar.jpg',
      }

      User.findById.mockResolvedValue(mockUser)
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        avatar: 'uploads/avatar.jpg',
      })

      await userController.updateUser(req, res, next)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          avatar: 'uploads/avatar.jpg',
        }),
        expect.any(Object),
      )
    })
  })

  describe('deleteUser', () => {
    it('應該成功刪除用戶', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'user123' }

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        avatar: 'avatar.jpg',
      }

      User.findById.mockResolvedValue(mockUser)
      User.findByIdAndDelete.mockResolvedValue(mockUser)
      Meme.deleteMany.mockResolvedValue({ deletedCount: 5 })
      Follow.deleteMany = vi.fn().mockResolvedValue({ deletedCount: 10 })

      await userController.deleteUser(req, res, next)

      expect(User.findByIdAndDelete).toHaveBeenCalledWith('user123')
      expect(Meme.deleteMany).toHaveBeenCalledWith({ author: 'user123' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('刪除成功'),
        }),
      )
    })

    it('應該拒絕未授權的刪除', async () => {
      req.user = { id: 'user123' }
      req.params = { id: 'user456' }

      await userController.deleteUser(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('getUserStats', () => {
    it('應該返回用戶統計資料', async () => {
      req.params = { id: 'user123' }

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
      }

      User.findById.mockResolvedValue(mockUser)
      Meme.countDocuments.mockResolvedValue(10)
      Follow.countDocuments
        .mockResolvedValueOnce(100) // followers
        .mockResolvedValueOnce(50) // following

      await userController.getUserStats(req, res, next)

      expect(Meme.countDocuments).toHaveBeenCalledWith({ author: 'user123' })
      expect(Follow.countDocuments).toHaveBeenCalledWith({ following: 'user123' })
      expect(Follow.countDocuments).toHaveBeenCalledWith({ follower: 'user123' })

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({
            memesCount: 10,
            followersCount: 100,
            followingCount: 50,
          }),
        }),
      )
    })
  })

  describe('getUserMemes', () => {
    it('應該返回用戶的迷因列表', async () => {
      req.params = { id: 'user123' }
      req.query = {
        page: '1',
        limit: '10',
      }

      const mockMemes = [
        { _id: 'meme1', title: 'Meme 1', author: 'user123' },
        { _id: 'meme2', title: 'Meme 2', author: 'user123' },
      ]

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMemes),
      })

      Meme.countDocuments.mockResolvedValue(2)

      await userController.getUserMemes(req, res, next)

      expect(Meme.find).toHaveBeenCalledWith({ author: 'user123' })
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
  })

  describe('searchUsers', () => {
    it('應該搜索並返回匹配的用戶', async () => {
      req.query = {
        q: 'test',
        limit: '5',
      }

      const mockUsers = [
        { _id: 'user1', username: 'testuser1', email: 'test1@example.com' },
        { _id: 'user2', username: 'testuser2', email: 'test2@example.com' },
      ]

      User.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockUsers),
      })

      await userController.searchUsers(req, res, next)

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { username: expect.any(RegExp) },
            { email: expect.any(RegExp) },
          ]),
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          users: mockUsers,
        }),
      )
    })
  })
})
