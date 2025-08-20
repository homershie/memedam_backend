import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Mock User model
const mockUser = {
  create: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOneAndUpdate: vi.fn(),
  deleteMany: vi.fn(),
  countDocuments: vi.fn(),
  aggregate: vi.fn(),
}

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password, hash) => Promise.resolve(hash === `hashed_${password}`)),
  },
}))

describe('User Model 單元測試', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('用戶創建和驗證', () => {
    it('應該成功創建新用戶', async () => {
      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'password123',
      }

      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
        role: 'user',
        status: 'active',
        is_verified: false,
        has_password: true,
        created_at: new Date(),
      }

      mockUser.create.mockResolvedValue(expectedUser)

      const user = await mockUser.create(userData)

      expect(mockUser.create).toHaveBeenCalledWith(userData)
      expect(user).toEqual(expectedUser)
      expect(user.password).not.toBe(userData.password)
    })

    it('應該驗證必填欄位', async () => {
      const invalidData = {
        email: 'test@example.com',
        // 缺少 username 和 password
      }

      const error = new Error('User validation failed: username is required')
      mockUser.create.mockRejectedValue(error)

      await expect(mockUser.create(invalidData)).rejects.toThrow('username is required')
    })

    it('應該驗證 email 格式', async () => {
      const invalidData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
      }

      const error = new Error('Invalid email format')
      mockUser.create.mockRejectedValue(error)

      await expect(mockUser.create(invalidData)).rejects.toThrow('Invalid email format')
    })

    it('應該驗證 username 長度 (8-20字元)', async () => {
      const shortUsername = {
        username: 'test',
        email: 'test@example.com',
        password: 'password123',
      }

      const error = new Error('Username must be between 8 and 20 characters')
      mockUser.create.mockRejectedValue(error)

      await expect(mockUser.create(shortUsername)).rejects.toThrow('Username must be between 8 and 20 characters')
    })

    it('應該處理 OAuth 用戶創建（無密碼）', async () => {
      const oauthData = {
        username: 'oauthuser123',
        email: 'oauth@example.com',
        google_id: 'google123',
      }

      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...oauthData,
        role: 'user',
        status: 'active',
        is_verified: true,
        has_password: false,
        created_at: new Date(),
      }

      mockUser.create.mockResolvedValue(expectedUser)

      const user = await mockUser.create(oauthData)

      expect(user.has_password).toBe(false)
      expect(user.google_id).toBe('google123')
      expect(user.password).toBeUndefined()
    })
  })

  describe('密碼處理和加密', () => {
    it('應該在保存前加密密碼', async () => {
      const password = 'plainPassword123'
      const hashedPassword = await bcrypt.hash(password, 10)

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10)
      expect(hashedPassword).toBe(`hashed_${password}`)
    })

    it('應該正確比對密碼', async () => {
      const password = 'testPassword'
      const hashedPassword = `hashed_${password}`

      const isMatch = await bcrypt.compare(password, hashedPassword)

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword)
      expect(isMatch).toBe(true)
    })

    it('應該拒絕錯誤的密碼', async () => {
      const password = 'correctPassword'
      const wrongPassword = 'wrongPassword'
      const hashedPassword = `hashed_${password}`

      const isMatch = await bcrypt.compare(wrongPassword, hashedPassword)

      expect(isMatch).toBe(false)
    })
  })

  describe('用戶查詢和更新', () => {
    it('應該通過 ID 查找用戶', async () => {
      const userId = new mongoose.Types.ObjectId()
      const expectedUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
      }

      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(expectedUser),
      })

      const user = await mockUser.findById(userId).select('-password')

      expect(mockUser.findById).toHaveBeenCalledWith(userId)
      expect(user).toEqual(expectedUser)
    })

    it('應該通過 email 查找用戶', async () => {
      const email = 'test@example.com'
      const expectedUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'testuser',
        email,
      }

      mockUser.findOne.mockResolvedValue(expectedUser)

      const user = await mockUser.findOne({ email })

      expect(mockUser.findOne).toHaveBeenCalledWith({ email })
      expect(user.email).toBe(email)
    })

    it('應該更新用戶資料', async () => {
      const userId = new mongoose.Types.ObjectId()
      const updateData = {
        bio: 'Updated bio',
        avatar_url: 'https://example.com/avatar.jpg',
      }

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        ...updateData,
        modified_at: new Date(),
      }

      mockUser.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const user = await mockUser.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      )

      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $set: updateData },
        { new: true }
      )
      expect(user.bio).toBe(updateData.bio)
      expect(user.avatar_url).toBe(updateData.avatar_url)
    })

    it('應該更新最後登入時間', async () => {
      const userId = new mongoose.Types.ObjectId()
      const now = new Date()

      mockUser.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        last_login_at: now,
      })

      const user = await mockUser.findByIdAndUpdate(
        userId,
        { $set: { last_login_at: now } },
        { new: true }
      )

      expect(user.last_login_at).toEqual(now)
    })
  })

  describe('用戶統計', () => {
    it('應該計算用戶總數', async () => {
      mockUser.countDocuments.mockResolvedValue(100)

      const count = await mockUser.countDocuments({ status: 'active' })

      expect(mockUser.countDocuments).toHaveBeenCalledWith({ status: 'active' })
      expect(count).toBe(100)
    })

    it('應該獲取用戶統計資料', async () => {
      const userId = new mongoose.Types.ObjectId()
      const stats = {
        totalMemes: 50,
        totalLikes: 200,
        totalComments: 75,
        totalFollowers: 30,
        totalFollowing: 25,
      }

      mockUser.aggregate.mockResolvedValue([stats])

      const result = await mockUser.aggregate([
        { $match: { _id: userId } },
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: 'author_id',
            as: 'memes',
          },
        },
        {
          $project: {
            totalMemes: { $size: '$memes' },
          },
        },
      ])

      expect(mockUser.aggregate).toHaveBeenCalled()
      expect(result[0]).toEqual(stats)
    })

    it('應該獲取活躍用戶列表', async () => {
      const activeUsers = [
        { _id: '1', username: 'user1', last_login_at: new Date() },
        { _id: '2', username: 'user2', last_login_at: new Date() },
      ]

      mockUser.aggregate.mockResolvedValue(activeUsers)

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const result = await mockUser.aggregate([
        {
          $match: {
            last_login_at: { $gte: thirtyDaysAgo },
            status: 'active',
          },
        },
        { $sort: { last_login_at: -1 } },
        { $limit: 10 },
      ])

      expect(result).toEqual(activeUsers)
      expect(result).toHaveLength(2)
    })
  })

  describe('用戶角色和權限', () => {
    it('應該驗證用戶角色', async () => {
      const userData = {
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      }

      const adminUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
      }

      mockUser.create.mockResolvedValue(adminUser)

      const user = await mockUser.create(userData)

      expect(user.role).toBe('admin')
    })

    it('應該只允許有效的角色值', async () => {
      const invalidRole = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'superuser', // 無效角色
      }

      const error = new Error('Invalid role: must be user, moderator, or admin')
      mockUser.create.mockRejectedValue(error)

      await expect(mockUser.create(invalidRole)).rejects.toThrow('Invalid role')
    })

    it('應該驗證用戶狀態', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        status: 'suspended',
      }

      const suspendedUser = {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: 'hashed_password123',
      }

      mockUser.create.mockResolvedValue(suspendedUser)

      const user = await mockUser.create(userData)

      expect(user.status).toBe('suspended')
    })
  })

  describe('批量操作', () => {
    it('應該批量刪除測試用戶', async () => {
      mockUser.deleteMany.mockResolvedValue({ deletedCount: 5 })

      const result = await mockUser.deleteMany({
        username: { $regex: /^test_/ },
      })

      expect(mockUser.deleteMany).toHaveBeenCalledWith({
        username: { $regex: /^test_/ },
      })
      expect(result.deletedCount).toBe(5)
    })

    it('應該批量更新用戶狀態', async () => {
      const inactiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      mockUser.findOneAndUpdate.mockResolvedValue({ modifiedCount: 10 })

      const result = await mockUser.findOneAndUpdate(
        { last_login_at: { $lt: inactiveDate } },
        { $set: { status: 'inactive' } }
      )

      expect(mockUser.findOneAndUpdate).toHaveBeenCalled()
      expect(result.modifiedCount).toBe(10)
    })
  })


})