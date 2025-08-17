import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as notificationController from '../../../controllers/notificationController.js'

// Mock dependencies
vi.mock('../../../models/Notification.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../../utils/notificationService.js', () => ({
  createNotification: vi.fn(),
  sendEmailNotification: vi.fn(),
  sendPushNotification: vi.fn(),
}))

describe('Notification Controller', () => {
  let req, res, next
  let Notification, User

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const NotificationModule = await import('../../../models/Notification.js')
    const UserModule = await import('../../../models/User.js')

    Notification = NotificationModule.default
    User = UserModule.default

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

  describe('getNotifications', () => {
    it('應該返回用戶的通知列表', async () => {
      req.user = { id: 'user123' }
      req.query = {
        page: '1',
        limit: '10',
        unreadOnly: 'false',
      }

      const mockNotifications = [
        {
          _id: 'notif1',
          recipient: 'user123',
          type: 'like',
          message: '有人按讚了你的迷因',
          isRead: false,
          createdAt: new Date(),
          from: { _id: 'user456', username: 'user456' },
        },
        {
          _id: 'notif2',
          recipient: 'user123',
          type: 'comment',
          message: '有人評論了你的迷因',
          isRead: true,
          createdAt: new Date(),
          from: { _id: 'user789', username: 'user789' },
        },
      ]

      Notification.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockNotifications),
      })

      Notification.countDocuments.mockResolvedValue(2)

      await notificationController.getNotifications(req, res, next)

      expect(Notification.find).toHaveBeenCalledWith({ recipient: 'user123' })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          notifications: mockNotifications,
          pagination: expect.objectContaining({
            total: 2,
            page: 1,
            limit: 10,
          }),
        }),
      )
    })

    it('應該過濾未讀通知', async () => {
      req.user = { id: 'user123' }
      req.query = {
        unreadOnly: 'true',
        page: '1',
        limit: '10',
      }

      const mockNotifications = [
        {
          _id: 'notif1',
          recipient: 'user123',
          type: 'like',
          isRead: false,
        },
      ]

      Notification.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockNotifications),
      })

      Notification.countDocuments.mockResolvedValue(1)

      await notificationController.getNotifications(req, res, next)

      expect(Notification.find).toHaveBeenCalledWith({
        recipient: 'user123',
        isRead: false,
      })
    })

    it('應該按類型過濾通知', async () => {
      req.user = { id: 'user123' }
      req.query = {
        type: 'comment',
        page: '1',
        limit: '10',
      }

      Notification.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })

      Notification.countDocuments.mockResolvedValue(0)

      await notificationController.getNotifications(req, res, next)

      expect(Notification.find).toHaveBeenCalledWith({
        recipient: 'user123',
        type: 'comment',
      })
    })
  })

  describe('markAsRead', () => {
    it('應該標記單個通知為已讀', async () => {
      req.user = { id: 'user123' }
      req.params = { notificationId: 'notif123' }

      const mockNotification = {
        _id: 'notif123',
        recipient: 'user123',
        isRead: false,
      }

      Notification.findById.mockResolvedValue(mockNotification)
      Notification.findByIdAndUpdate.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      })

      await notificationController.markAsRead(req, res, next)

      expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
        'notif123',
        expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
        expect.objectContaining({
          new: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          notification: expect.objectContaining({
            isRead: true,
          }),
        }),
      )
    })

    it('應該拒絕標記其他用戶的通知', async () => {
      req.user = { id: 'user123' }
      req.params = { notificationId: 'notif123' }

      const mockNotification = {
        _id: 'notif123',
        recipient: 'user456', // Different user
      }

      Notification.findById.mockResolvedValue(mockNotification)

      await notificationController.markAsRead(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('markAllAsRead', () => {
    it('應該標記所有通知為已讀', async () => {
      req.user = { id: 'user123' }

      Notification.updateMany.mockResolvedValue({
        modifiedCount: 5,
      })

      await notificationController.markAllAsRead(req, res, next)

      expect(Notification.updateMany).toHaveBeenCalledWith(
        {
          recipient: 'user123',
          isRead: false,
        },
        {
          isRead: true,
          readAt: expect.any(Date),
        },
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('標記為已讀'),
          modifiedCount: 5,
        }),
      )
    })
  })

  describe('deleteNotification', () => {
    it('應該成功刪除通知', async () => {
      req.user = { id: 'user123' }
      req.params = { notificationId: 'notif123' }

      const mockNotification = {
        _id: 'notif123',
        recipient: 'user123',
      }

      Notification.findById.mockResolvedValue(mockNotification)
      Notification.findByIdAndDelete.mockResolvedValue(mockNotification)

      await notificationController.deleteNotification(req, res, next)

      expect(Notification.findByIdAndDelete).toHaveBeenCalledWith('notif123')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('刪除成功'),
        }),
      )
    })

    it('應該拒絕刪除其他用戶的通知', async () => {
      req.user = { id: 'user123' }
      req.params = { notificationId: 'notif123' }

      const mockNotification = {
        _id: 'notif123',
        recipient: 'user456',
      }

      Notification.findById.mockResolvedValue(mockNotification)

      await notificationController.deleteNotification(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權限'),
        }),
      )
    })
  })

  describe('deleteAllNotifications', () => {
    it('應該刪除所有通知', async () => {
      req.user = { id: 'user123' }

      Notification.deleteMany.mockResolvedValue({
        deletedCount: 10,
      })

      await notificationController.deleteAllNotifications(req, res, next)

      expect(Notification.deleteMany).toHaveBeenCalledWith({
        recipient: 'user123',
      })

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('刪除成功'),
          deletedCount: 10,
        }),
      )
    })
  })

  describe('getUnreadCount', () => {
    it('應該返回未讀通知數量', async () => {
      req.user = { id: 'user123' }

      Notification.countDocuments.mockResolvedValue(5)

      await notificationController.getUnreadCount(req, res, next)

      expect(Notification.countDocuments).toHaveBeenCalledWith({
        recipient: 'user123',
        isRead: false,
      })

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          unreadCount: 5,
        }),
      )
    })
  })

  describe('getNotificationSettings', () => {
    it('應該返回通知設定', async () => {
      req.user = { id: 'user123' }

      const mockUser = {
        _id: 'user123',
        notificationSettings: {
          email: {
            likes: true,
            comments: true,
            follows: false,
            mentions: true,
          },
          push: {
            likes: false,
            comments: true,
            follows: true,
            mentions: true,
          },
        },
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      await notificationController.getNotificationSettings(req, res, next)

      expect(User.findById).toHaveBeenCalledWith('user123')
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          settings: mockUser.notificationSettings,
        }),
      )
    })
  })

  describe('updateNotificationSettings', () => {
    it('應該更新通知設定', async () => {
      req.user = { id: 'user123' }
      req.body = {
        email: {
          likes: false,
          comments: true,
        },
        push: {
          likes: true,
          comments: false,
        },
      }

      const mockUser = {
        _id: 'user123',
        notificationSettings: {
          email: {
            likes: false,
            comments: true,
            follows: true,
            mentions: true,
          },
          push: {
            likes: true,
            comments: false,
            follows: true,
            mentions: true,
          },
        },
      }

      User.findByIdAndUpdate.mockResolvedValue(mockUser)

      await notificationController.updateNotificationSettings(req, res, next)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        {
          $set: {
            'notificationSettings.email': expect.objectContaining({
              likes: false,
              comments: true,
            }),
            'notificationSettings.push': expect.objectContaining({
              likes: true,
              comments: false,
            }),
          },
        },
        expect.objectContaining({
          new: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          settings: mockUser.notificationSettings,
        }),
      )
    })
  })

  describe('createNotification', () => {
    it('應該創建新通知', async () => {
      req.body = {
        recipient: 'user123',
        type: 'system',
        message: '系統維護通知',
        data: {
          priority: 'high',
        },
      }

      const mockNotification = {
        _id: 'newnotif123',
        recipient: 'user123',
        type: 'system',
        message: '系統維護通知',
        data: {
          priority: 'high',
        },
        isRead: false,
        createdAt: new Date(),
      }

      Notification.create.mockResolvedValue(mockNotification)

      const mockUser = {
        _id: 'user123',
        notificationSettings: {
          email: { system: true },
          push: { system: true },
        },
      }

      User.findById.mockResolvedValue(mockUser)

      await notificationController.createNotification(req, res, next)

      expect(Notification.create).toHaveBeenCalledWith({
        recipient: 'user123',
        type: 'system',
        message: '系統維護通知',
        data: {
          priority: 'high',
        },
      })

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          notification: mockNotification,
        }),
      )
    })
  })

  describe('getNotificationTypes', () => {
    it('應該返回所有通知類型', async () => {
      await notificationController.getNotificationTypes(req, res, next)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          types: expect.arrayContaining([
            'like',
            'comment',
            'follow',
            'mention',
            'system',
            'meme_approved',
            'meme_rejected',
          ]),
        }),
      )
    })
  })

  describe('batchUpdateNotifications', () => {
    it('應該批量更新通知', async () => {
      req.user = { id: 'user123' }
      req.body = {
        notificationIds: ['notif1', 'notif2', 'notif3'],
        updates: {
          isRead: true,
        },
      }

      Notification.updateMany.mockResolvedValue({
        modifiedCount: 3,
      })

      await notificationController.batchUpdateNotifications(req, res, next)

      expect(Notification.updateMany).toHaveBeenCalledWith(
        {
          _id: { $in: ['notif1', 'notif2', 'notif3'] },
          recipient: 'user123',
        },
        {
          isRead: true,
          readAt: expect.any(Date),
        },
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          modifiedCount: 3,
        }),
      )
    })
  })
})
