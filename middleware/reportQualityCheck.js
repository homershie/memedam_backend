import Report from '../models/Report.js'

// 檢舉品質檢查中間件
export const reportQualityCheck = async (req, res, next) => {
  try {
    // 只對已登入用戶進行品質檢查
    if (!req.user) {
      return next()
    }

    const userId = req.user._id

    // 取得用戶最近的檢舉記錄（最近20筆）
    const recentReports = await Report.find({
      reporter_id: userId,
    })
      .sort({ createdAt: -1 })
      .limit(20)

    // 如果檢舉數量不足，直接通過
    if (recentReports.length < 5) {
      return next()
    }

    // 計算有效率（被標為 processed 的比率）
    const processedReports = recentReports.filter((report) => report.status === 'processed')
    const effectiveRate = processedReports.length / recentReports.length

    // 如果有效率低於 10%，發出警告
    if (effectiveRate < 0.1) {
      // 檢查是否已經被暫停檢舉功能
      const isSuspended = await checkReportSuspension(userId)
      if (isSuspended) {
        return res.status(429).json({
          success: false,
          data: null,
          error: '您的檢舉功能已被暫停，請稍後再試。',
        })
      }

      // 如果有效率低於 5% 且累計檢舉 ≥ 40 筆，暫停檢舉功能
      if (effectiveRate < 0.05 && recentReports.length >= 40) {
        await suspendReportFunction(userId)
        return res.status(429).json({
          success: false,
          data: null,
          error: '由於檢舉有效率過低，您的檢舉功能已被暫停7天。',
        })
      }

      // 發出警告但不阻止檢舉
      req.reportWarning = {
        effectiveRate: Math.round(effectiveRate * 100),
        message: `您的檢舉有效率為 ${Math.round(effectiveRate * 100)}%，請確保檢舉內容符合規範。`,
      }
    }

    next()
  } catch (error) {
    console.error('檢舉品質檢查錯誤:', error)
    // 如果檢查失敗，允許檢舉繼續進行
    next()
  }
}

// 檢查用戶是否被暫停檢舉功能
const checkReportSuspension = async (userId) => {
  try {
    // 這裡可以使用 Redis 來存儲暫停狀態，提高效能
    // 暫時使用簡單的記憶體檢查，實際應用中應該使用 Redis
    // const suspensionKey = `report_suspension:${userId}` // 未來 Redis 整合時使用

    // 檢查是否有暫停記錄（這裡簡化處理，實際應該檢查 Redis）
    // 如果用戶在過去7天內被暫停過，則繼續暫停
    const suspensionRecord = await Report.findOne({
      reporter_id: userId,
      'action_meta.suspended': true,
      'action_meta.suspended_at': {
        $gte: (() => {
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          return sevenDaysAgo
        })(),
      },
    })

    return !!suspensionRecord
  } catch (error) {
    console.error('檢查檢舉暫停狀態錯誤:', error)
    return false
  }
}

// 暫停用戶的檢舉功能
const suspendReportFunction = async (userId) => {
  try {
    // 在資料庫中記錄暫停狀態
    await Report.create({
      reporter_id: userId,
      target_type: 'system',
      target_id: userId, // 使用用戶ID作為目標ID
      reason: 'system_suspension',
      description: '系統自動暫停檢舉功能',
      status: 'processed',
      action: 'none',
      action_meta: {
        suspended: true,
        suspended_at: new Date(),
        reason: 'low_effective_rate',
        effective_rate: 'below_5_percent',
      },
      admin_comment: '由於檢舉有效率過低，系統自動暫停檢舉功能7天。',
      processed_at: new Date(),
      handler_id: userId, // 使用系統用戶ID
    })

    console.log(`用戶 ${userId} 的檢舉功能已被暫停`)
  } catch (error) {
    console.error('暫停檢舉功能錯誤:', error)
  }
}

// 取得用戶檢舉統計
export const getUserReportStats = async (userId) => {
  try {
    const [totalReports, processedReports, rejectedReports, pendingReports, recentReports] =
      await Promise.all([
        Report.countDocuments({ reporter_id: userId }),
        Report.countDocuments({
          reporter_id: userId,
          status: 'processed',
        }),
        Report.countDocuments({
          reporter_id: userId,
          status: 'rejected',
        }),
        Report.countDocuments({
          reporter_id: userId,
          status: 'pending',
        }),
        Report.find({ reporter_id: userId }).sort({ createdAt: -1 }).limit(20),
      ])

    const effectiveRate = totalReports > 0 ? processedReports / totalReports : 0
    const isSuspended = await checkReportSuspension(userId)

    return {
      totalReports,
      processedReports,
      rejectedReports,
      pendingReports,
      effectiveRate: Math.round(effectiveRate * 100),
      recentReportsCount: recentReports.length,
      isSuspended,
      warning:
        effectiveRate < 0.1
          ? {
              effectiveRate: Math.round(effectiveRate * 100),
              message: `您的檢舉有效率為 ${Math.round(effectiveRate * 100)}%，請確保檢舉內容符合規範。`,
            }
          : null,
    }
  } catch (error) {
    console.error('取得用戶檢舉統計錯誤:', error)
    return null
  }
}
