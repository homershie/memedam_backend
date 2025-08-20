import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as authController from '../../../controllers/authController.js'

// Mock dependencies
vi.mock('../../../models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    genSalt: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('../../../services/emailService.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

describe('Auth Controller', () => {
  let req, res, next
  let User

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked User
    const UserModule = await import('../../../models/User.js')
    User = UserModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
      headers: {},
    }

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    }

    next = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('應該成功註冊新用戶', async () => {
      req.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      }

      User.findOne.mockResolvedValue(null)
      User.create.mockResolvedValue({
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: false,
      })

      bcrypt.genSalt.mockResolvedValue('salt')
      bcrypt.hash.mockResolvedValue('hashedPassword')
      jwt.sign.mockReturnValue('token123')

      await authController.register(req, res, next)

      expect(User.findOne).toHaveBeenCalled()
      expect(User.create).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        }),
      )
    })

    it('應該拒絕重複的用戶名', async () => {
      req.body = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123',
      }

      User.findOne.mockResolvedValue({ username: 'existinguser' })

      await authController.register(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('已存在'),
        }),
      )
    })

    it('應該拒絕重複的電子郵件', async () => {
      req.body = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      }

      User.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce({ email: 'existing@example.com' }) // email check

      await authController.register(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('已被使用'),
        }),
      )
    })
  })

  describe('login', () => {
    it('應該成功登入用戶', async () => {
      req.body = {
        username: 'testuser',
        password: 'password123',
      }

      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedPassword',
        isVerified: true,
        toObject: vi.fn().mockReturnValue({
          _id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
        }),
      }

      User.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      bcrypt.compare.mockResolvedValue(true)
      jwt.sign.mockReturnValue('token123')

      await authController.login(req, res, next)

      expect(User.findOne).toHaveBeenCalledWith({ username: 'testuser' })
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'token123',
          user: expect.objectContaining({
            _id: 'user123',
            username: 'testuser',
          }),
        }),
      )
    })

    it('應該拒絕無效的憑證', async () => {
      req.body = {
        username: 'testuser',
        password: 'wrongpassword',
      }

      const mockUser = {
        _id: 'user123',
        password: 'hashedPassword',
      }

      User.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      bcrypt.compare.mockResolvedValue(false)

      await authController.login(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無效'),
        }),
      )
    })

    it('應該拒絕不存在的用戶', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'password123',
      }

      User.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      })

      await authController.login(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無效'),
        }),
      )
    })
  })

  describe('logout', () => {
    it('應該成功登出用戶', async () => {
      await authController.logout(req, res, next)

      expect(res.clearCookie).toHaveBeenCalledWith('token')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('登出'),
        }),
      )
    })
  })

  describe('forgotPassword', () => {
    it('應該發送密碼重置郵件', async () => {
      req.body = {
        email: 'test@example.com',
      }

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        save: vi.fn(),
      }

      User.findOne.mockResolvedValue(mockUser)

      await authController.forgotPassword(req, res, next)

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' })
      expect(mockUser.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('重置'),
        }),
      )
    })

    it('應該處理不存在的電子郵件', async () => {
      req.body = {
        email: 'nonexistent@example.com',
      }

      User.findOne.mockResolvedValue(null)

      await authController.forgotPassword(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('找不到'),
        }),
      )
    })
  })

  describe('resetPassword', () => {
    it('應該成功重置密碼', async () => {
      req.params = {
        token: 'resettoken123',
      }
      req.body = {
        password: 'newpassword123',
      }

      const mockUser = {
        _id: 'user123',
        resetPasswordToken: 'hashedtoken',
        resetPasswordExpire: Date.now() + 3600000,
        save: vi.fn(),
      }

      User.findOne.mockResolvedValue(mockUser)
      bcrypt.genSalt.mockResolvedValue('salt')
      bcrypt.hash.mockResolvedValue('newhashedpassword')

      await authController.resetPassword(req, res, next)

      expect(mockUser.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('重置成功'),
        }),
      )
    })

    it('應該拒絕過期的重置令牌', async () => {
      req.params = {
        token: 'expiredtoken',
      }
      req.body = {
        password: 'newpassword123',
      }

      User.findOne.mockResolvedValue(null)

      await authController.resetPassword(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無效'),
        }),
      )
    })
  })

  describe('changePassword', () => {
    it('應該成功更改密碼', async () => {
      req.user = { id: 'user123' }
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }

      const mockUser = {
        _id: 'user123',
        password: 'oldhashedpassword',
        save: vi.fn(),
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      bcrypt.compare.mockResolvedValue(true)
      bcrypt.genSalt.mockResolvedValue('salt')
      bcrypt.hash.mockResolvedValue('newhashedpassword')

      await authController.changePassword(req, res, next)

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'oldhashedpassword')
      expect(mockUser.save).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('更改成功'),
        }),
      )
    })

    it('應該拒絕錯誤的當前密碼', async () => {
      req.user = { id: 'user123' }
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      }

      const mockUser = {
        _id: 'user123',
        password: 'hashedpassword',
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      bcrypt.compare.mockResolvedValue(false)

      await authController.changePassword(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('錯誤'),
        }),
      )
    })
  })
})
