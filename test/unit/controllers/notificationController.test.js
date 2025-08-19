import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import * as notificationUtils from '../../../utils/notificationUtils.js'
import {
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
  getUnreadCount,
} from '../../../controllers/notificationController.js'

// Mock models
vi.mock('../../../models/NotificationReceipt.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}))

vi.mock('../../../models/Notification.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}))

vi.mock('../../../utils/notificationUtils.js')

import NotificationReceipt from '../../../models/NotificationReceipt.js'

describe('通知控制器', () => {
  let mockReq, mockRes

  beforeEach(() => {
    mockReq = {
      user: { _id: new mongoose.Types.ObjectId() },
      query: { page: '1', limit: '20' },
      params: {},
      body: {},
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    vi.clearAllMocks()
  })

  describe('getNotifications', () => {
    it('應該能取得通知列表', async () => {
      const mockReceipts = [
        {
          _id: new mongoose.Types.ObjectId(),
          user_id: mockReq.user._id,
          notification_id: {
            _id: new mongoose.Types.ObjectId(),
            actor_id: { username: 'testuser', avatar: 'avatar.jpg' },
            verb: 'like',
            object_type: 'meme',
            object_id: new mongoose.Types.ObjectId(),
            title: '測試通知',
            content: '有人按讚了您的迷因',
            createdAt: new Date(),
          },
          read_at: null,
          deleted_at: null,
          archived_at: null,
          createdAt: new Date(),
          isRead: false,
          isDeleted: false,
          isArchived: false,
        },
      ]

      const mockQuery = { user_id: mockReq.user._id, deleted_at: null }
      vi.mocked(notificationUtils.getUserReceiptQuery).mockReturnValue(mockQuery)
      vi.mocked(NotificationReceipt.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockReceipts),
            }),
          }),
        }),
      })
      vi.mocked(NotificationReceipt.countDocuments).mockResolvedValue(1)
      vi.mocked(notificationUtils.getUnreadCount).mockResolvedValue(1)

      await getNotifications(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            _id: mockReceipts[0]._id,
            notification_id: mockReceipts[0].notification_id._id,
            verb: 'like',
            object_type: 'meme',
            isRead: false,
            isDeleted: false,
            isArchived: false,
          }),
        ]),
        error: null,
        unreadCount: 1,
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        }),
      })
    })

    it('應該處理查詢錯誤', async () => {
      vi.mocked(notificationUtils.getUserReceiptQuery).mockImplementation(() => {
        throw new Error('查詢錯誤')
      })

      await getNotifications(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '取得通知列表失敗',
      })
    })
  })

  describe('getNotificationById', () => {
    it('應該能取得特定通知', async () => {
      const mockReceipt = {
        _id: new mongoose.Types.ObjectId(),
        user_id: mockReq.user._id,
        notification_id: {
          _id: new mongoose.Types.ObjectId(),
          actor_id: { username: 'testuser' },
          verb: 'comment',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '新評論',
          content: '有人評論了您的迷因',
          createdAt: new Date(),
        },
        read_at: null,
        deleted_at: null,
        archived_at: null,
        createdAt: new Date(),
        isRead: false,
        isDeleted: false,
        isArchived: false,
      }

      mockReq.params.id = mockReceipt._id.toString()
      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(mockReceipt)

      await getNotificationById(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: mockReceipt._id,
          notification_id: mockReceipt.notification_id._id,
          verb: 'comment',
          object_type: 'meme',
          isRead: false,
          isDeleted: false,
          isArchived: false,
        }),
        error: null,
      })
    })

    it('應該處理通知不存在', async () => {
      mockReq.params.id = new mongoose.Types.ObjectId().toString()
      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(null)

      await getNotificationById(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到通知',
      })
    })
  })

  describe('updateNotification', () => {
    it('應該能更新通知狀態', async () => {
      const mockReceipt = {
        _id: new mongoose.Types.ObjectId(),
        user_id: mockReq.user._id,
        notification_id: {
          _id: new mongoose.Types.ObjectId(),
          actor_id: { username: 'testuser' },
          verb: 'like',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '新讚',
          content: '有人按讚了您的迷因',
          createdAt: new Date(),
        },
        read_at: null,
        deleted_at: null,
        archived_at: null,
        createdAt: new Date(),
        isRead: false,
        isDeleted: false,
        isArchived: false,
      }

      mockReq.params.id = mockReceipt._id.toString()
      mockReq.body = { read: true, archived: false }

      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(mockReceipt)
      vi.mocked(notificationUtils.markReceiptRead).mockResolvedValue({ modifiedCount: 1 })
      vi.mocked(notificationUtils.markReceiptArchived).mockResolvedValue({ modifiedCount: 1 })

      await updateNotification(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: mockReceipt._id,
          isRead: true,
          isArchived: false,
        }),
        error: null,
      })
    })

    it('應該處理更新錯誤', async () => {
      mockReq.params.id = new mongoose.Types.ObjectId().toString()
      mockReq.body = { read: true }

      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(null)

      await updateNotification(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到通知',
      })
    })
  })

  describe('deleteNotification', () => {
    it('應該能軟刪除通知', async () => {
      const mockReceipt = {
        _id: new mongoose.Types.ObjectId(),
        user_id: mockReq.user._id,
        notification_id: {
          _id: new mongoose.Types.ObjectId(),
          actor_id: { username: 'testuser' },
          verb: 'like',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '新讚',
          content: '有人按讚了您的迷因',
          createdAt: new Date(),
        },
        read_at: null,
        deleted_at: null,
        archived_at: null,
        createdAt: new Date(),
        isRead: false,
        isDeleted: false,
        isArchived: false,
      }

      mockReq.params.id = mockReceipt._id.toString()

      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(mockReceipt)
      vi.mocked(notificationUtils.softDeleteReceipt).mockResolvedValue({ modifiedCount: 1 })

      await deleteNotification(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(204)
    })

    it('應該處理刪除錯誤', async () => {
      mockReq.params.id = new mongoose.Types.ObjectId().toString()

      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(null)

      await deleteNotification(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到通知',
      })
    })
  })

  describe('markNotificationRead', () => {
    it('應該能標記通知為已讀', async () => {
      const mockReceipt = {
        _id: new mongoose.Types.ObjectId(),
        user_id: mockReq.user._id,
        notification_id: {
          _id: new mongoose.Types.ObjectId(),
          actor_id: { username: 'testuser' },
          verb: 'like',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '新讚',
          content: '有人按讚了您的迷因',
          createdAt: new Date(),
        },
        read_at: null,
        deleted_at: null,
        archived_at: null,
        createdAt: new Date(),
        isRead: false,
        isDeleted: false,
        isArchived: false,
      }

      mockReq.params.id = mockReceipt._id.toString()

      vi.mocked(notificationUtils.ensureReceiptOwner).mockResolvedValue(mockReceipt)
      vi.mocked(notificationUtils.markReceiptRead).mockResolvedValue({ modifiedCount: 1 })

      await markNotificationRead(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: mockReceipt._id,
          isRead: true,
        }),
        error: null,
      })
    })
  })

  describe('markAllNotificationsRead', () => {
    it('應該能標記所有通知為已讀', async () => {
      vi.mocked(NotificationReceipt.updateMany).mockResolvedValue({ modifiedCount: 5 })

      await markAllNotificationsRead(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          updatedCount: 5,
        },
        error: null,
      })
    })

    it('應該處理標記錯誤', async () => {
      vi.mocked(NotificationReceipt.updateMany).mockRejectedValue(new Error('更新錯誤'))

      await markAllNotificationsRead(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '標記所有通知為已讀失敗',
      })
    })
  })

  describe('deleteNotifications', () => {
    it('應該能批次刪除通知', async () => {
      mockReq.body = { ids: [new mongoose.Types.ObjectId().toString()] }

      vi.mocked(notificationUtils.batchSoftDeleteReceipts).mockResolvedValue(3)

      await deleteNotifications(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          deletedCount: 3,
        },
        error: null,
      })
    })

    it('應該處理批次刪除錯誤', async () => {
      mockReq.body = { ids: [new mongoose.Types.ObjectId().toString()] }

      vi.mocked(notificationUtils.batchSoftDeleteReceipts).mockRejectedValue(new Error('刪除錯誤'))

      await deleteNotifications(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '批次刪除通知失敗',
      })
    })
  })

  describe('getUnreadCount', () => {
    it('應該能取得未讀通知數量', async () => {
      vi.mocked(notificationUtils.getUnreadCount).mockResolvedValue(5)

      await getUnreadCount(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          unreadCount: 5,
        },
        error: null,
      })
    })

    it('應該處理取得未讀數量錯誤', async () => {
      vi.mocked(notificationUtils.getUnreadCount).mockRejectedValue(new Error('查詢錯誤'))

      await getUnreadCount(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '取得未讀通知數量失敗',
      })
    })
  })
})
