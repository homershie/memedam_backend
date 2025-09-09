import Sponsor from '../models/Sponsor.js'
import { logger } from '../utils/logger.js'
import kofiService from '../services/kofiService.js'

// 建立贊助
export const createSponsor = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Sponsor.startSession()
  session.startTransaction()

  try {
    const sponsor = new Sponsor({
      ...req.body,
      created_ip: req.ip || req.headers['x-forwarded-for'] || '',
    })
    await sponsor.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json({ success: true, data: sponsor, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '贊助記錄重複，請檢查是否已存在相同記錄',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有贊助（支援分頁、條件查詢、排序、populate user）
export const getSponsors = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.status) filter.status = req.query.status
    if (req.query.q) {
      const keyword = req.query.q.trim()
      filter.message = new RegExp(keyword, 'i')
    }
    if (req.query.min_amount)
      filter.amount = { ...filter.amount, $gte: Number(req.query.min_amount) }
    if (req.query.max_amount)
      filter.amount = { ...filter.amount, $lte: Number(req.query.max_amount) }
    // 分頁
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    // 排序
    let sort = { createdAt: -1 }
    if (req.query.sort_by) {
      const dir = req.query.sort_dir === 'asc' ? 1 : -1
      sort = { [req.query.sort_by]: dir }
    }
    // 查詢
    const sponsors = await Sponsor.find(filter)
      .populate('user_id', 'nickname avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
    const total = await Sponsor.countDocuments(filter)
    res.json({
      success: true,
      data: sponsors,
      error: null,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得單一贊助
export const getSponsorById = async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id).populate('user_id', 'nickname avatar')
    if (!sponsor) return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    // 僅本人或管理員可查
    if (
      sponsor.user_id._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      return res.status(403).json({ success: false, data: null, error: '無權限查詢此贊助' })
    }
    res.json({ success: true, data: sponsor, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新贊助
export const updateSponsor = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Sponsor.startSession()
  session.startTransaction()

  try {
    const sponsor = await Sponsor.findById(req.params.id).session(session)
    if (!sponsor) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    }

    // 僅本人或管理員可改
    if (
      sponsor.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      await session.abortTransaction()
      return res.status(403).json({ success: false, data: null, error: '無權限修改此贊助' })
    }

    // 更新
    Object.assign(sponsor, req.body)
    await sponsor.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: sponsor, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '贊助記錄重複，請檢查是否已存在相同記錄',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除贊助
export const deleteSponsor = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Sponsor.startSession()
  session.startTransaction()

  try {
    const sponsor = await Sponsor.findById(req.params.id).session(session)
    if (!sponsor) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    }

    // 僅本人或管理員可刪
    if (
      sponsor.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      await session.abortTransaction()
      return res.status(403).json({ success: false, data: null, error: '無權限刪除此贊助' })
    }

    await sponsor.deleteOne({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: null, error: null, message: '贊助已刪除' })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// Buy Me a Coffee 回調處理
export const handleBuyMeACoffeeCallback = async (req, res) => {
  try {
    const {
      transaction_id,
      amount,
      message,
      payment_method,
      user_id, // 從 URL 參數傳遞的用戶ID
    } = req.body

    // 驗證必要參數
    if (!transaction_id || !amount || !user_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: '缺少必要參數',
      })
    }

    // 檢查是否已存在相同交易ID的贊助
    const existingSponsor = await Sponsor.findOne({ transaction_id })
    if (existingSponsor) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '此交易已存在',
      })
    }

    // 建立新的贊助記錄
    const sponsor = new Sponsor({
      user_id,
      amount: parseFloat(amount),
      message: message || '',
      payment_method: payment_method || 'buy_me_a_coffee',
      transaction_id,
      status: 'success',
      created_ip: req.ip || req.headers['x-forwarded-for'] || '',
    })

    await sponsor.save()

    // 重定向到成功頁面
    res.redirect(`/sponsor/success?transaction_id=${transaction_id}`)
  } catch (error) {
    console.error('Buy Me a Coffee 回調錯誤:', error)

    // 重定向到錯誤頁面
    res.redirect('/sponsor/error?message=處理贊助時發生錯誤')
  }
}

// 根據交易ID取得贊助資訊
export const getSponsorByTransactionId = async (req, res) => {
  try {
    const { transaction_id } = req.params

    if (!transaction_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: '缺少交易ID',
      })
    }

    const sponsor = await Sponsor.findOne({ transaction_id }).populate('user_id', 'nickname avatar')

    if (!sponsor) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到此交易記錄',
      })
    }

    res.json({
      success: true,
      data: sponsor,
      error: null,
    })
  } catch (error) {
    console.error('取得贊助資訊錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
}

// 記錄贊助頁面訪問
export const logSponsorPageAccess = async (req, res) => {
  try {
    const { pageType, transactionId, message, userAgent, referrer } = req.body

    // 記錄訪問日誌
    console.log('贊助頁面訪問記錄:', {
      pageType,
      transactionId,
      message,
      userAgent,
      referrer,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      timestamp: new Date().toISOString(),
    })

    // 這裡可以將記錄儲存到資料庫或發送到分析服務
    // 例如：await SponsorAccessLog.create({ ... })

    res.json({
      success: true,
      message: '訪問記錄已記錄',
      error: null,
    })
  } catch (error) {
    console.error('記錄贊助頁面訪問錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
}

// 處理 Ko-fi Shop Order Webhook
export const handleKofiShopOrderWebhook = async (req, res) => {
  let session = null
  // 在測試環境中完全禁用事務，因為 MongoDB Memory Server 不支援事務
  if (process.env.NODE_ENV !== 'test') {
    try {
      session = await Sponsor.startSession()
      session.startTransaction()
    } catch (sessionError) {
      logger.warn('Ko-fi Webhook: 會話創建失敗，使用無會話模式', { error: sessionError.message })
      session = null
    }
  }

  try {
    const {
      kofi_transaction_id,
      from_name,
      display_name,
      email,
      amount,
      currency,
      message,
      direct_link_code,
      shop_items,
      shipping,
      is_public,
      message_id,
    } = req.body

    const { productInfo, clientIP } = req.kofiData || {}

    // 如果沒有 kofiData，說明中間件驗證失敗
    if (!req.kofiData || !productInfo) {
      logger.error('Ko-fi Webhook: 缺少必要的驗證數據', {
        hasKofiData: !!req.kofiData,
        hasProductInfo: !!productInfo,
        message_id: req.body.message_id,
      })
      return res.status(500).json({
        success: false,
        error: '中間件驗證數據缺失',
      })
    }

    // 檢查是否已存在相同交易ID的贊助
    const existingSponsor = session
      ? await Sponsor.findOne({ kofi_transaction_id }).session(session)
      : await Sponsor.findOne({ kofi_transaction_id })

    if (existingSponsor) {
      if (session) await session.abortTransaction()
      logger.info('Ko-fi Webhook: 交易已存在，跳過處理', { kofi_transaction_id, message_id })
      return res.status(200).json({
        success: true,
        message: '交易已存在',
        kofi_transaction_id,
      })
    }

    // 嘗試根據 email 找到現有用戶
    let user = null
    if (email) {
      try {
        const User = (await import('../models/User.js')).default
        user = session
          ? await User.findOne({ email: email.toLowerCase() }).session(session)
          : await User.findOne({ email: email.toLowerCase() })
      } catch (error) {
        logger.warn('Ko-fi Webhook: 用戶查找失敗，使用 null', { email, error: error.message })
        // 在測試環境中，如果模型導入失敗，我們繼續處理但不關聯用戶
        user = null
      }
    }

    // 建立新的贊助記錄
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      logger.error('Ko-fi Webhook: 無效的金額', { amount, parsedAmount })
      await session.abortTransaction()
      return res.status(400).json({
        success: false,
        error: '無效的金額',
      })
    }

    const sponsorData = {
      user_id: user?._id || null,
      amount: parsedAmount,
      message: message || '',
      payment_method: 'ko-fi',
      transaction_id: kofi_transaction_id,
      status: 'success',

      // Ko-fi 特定字段
      kofi_transaction_id,
      from_name: from_name || '',
      display_name: display_name || '',
      email: email || '',
      discord_username: req.body.discord_username || '',
      discord_userid: req.body.discord_userid || '',
      currency: currency || 'USD',
      type: 'Shop Order',
      direct_link_code: direct_link_code ? direct_link_code.toUpperCase() : '',
      shop_items: shop_items || [],
      shipping: shipping || {},
      is_public: is_public !== undefined ? is_public : true,
      sponsor_level: productInfo.level,
      badge_earned: true, // Shop Order 預設獲得徽章

      // IP 和處理資訊
      created_ip: clientIP,
      processed_at: new Date(),
      message_id: message_id || null,
    }

    let sponsor
    try {
      sponsor = new Sponsor(sponsorData)
      await sponsor.save(session ? { session } : {})

      // 確保 sponsor 有 _id
      if (!sponsor._id) {
        throw new Error('贊助記錄保存後沒有獲得 ID')
      }
    } catch (saveError) {
      logger.error('Ko-fi Webhook: 保存贊助記錄失敗', {
        error: saveError.message,
        kofi_transaction_id,
        amount: parsedAmount,
        validationErrors: saveError.errors,
      })
      if (session) await session.abortTransaction()
      return res.status(500).json({
        success: false,
        error: '保存贊助記錄失敗',
        details: saveError.message,
      })
    }

    // 如果用戶存在，更新用戶的贊助統計
    if (user) {
      try {
        await kofiService.updateUserSponsorStats(user._id, sponsorData, session)
      } catch (statsError) {
        logger.warn('Ko-fi Webhook: 用戶統計更新失敗，但繼續處理', {
          error: statsError.message,
          userId: user._id,
        })
        // 不阻擋主要處理流程
      }
    }

    // 提交事務（如果有會話）
    if (session) await session.commitTransaction()

    // 非同步處理通知和快取更新（不影響主要回應）
    setImmediate(async () => {
      try {
        // 發送通知
        try {
          await kofiService.sendSponsorNotification(sponsor, user)
        } catch (notifyError) {
          logger.warn('Ko-fi Webhook: 通知發送失敗', { error: notifyError.message })
        }

        // 更新全域統計快取
        try {
          await kofiService.updateSponsorStatsCache(sponsor)
        } catch (cacheError) {
          logger.warn('Ko-fi Webhook: 快取更新失敗', { error: cacheError.message })
        }

        logger.info('Ko-fi Webhook 後續處理完成', { kofi_transaction_id })
      } catch (error) {
        logger.error('Ko-fi Webhook 後續處理失敗:', error)
        // 在測試環境中，這種錯誤很常見，不影響主要功能
      }
    })

    logger.info('Ko-fi Shop Order Webhook 處理成功', {
      kofi_transaction_id,
      message_id,
      sponsor_level: productInfo.level,
      amount,
      user_found: !!user,
    })

    res.status(200).json({
      success: true,
      message: 'Shop Order 處理成功',
      data: {
        kofi_transaction_id,
        sponsor_id: sponsor._id,
        sponsor_level: productInfo.level,
        amount,
      },
    })
  } catch (error) {
    // 回滾事務（如果有會話）
    if (session) {
      try {
        await session.abortTransaction()
      } catch (abortError) {
        logger.warn('Ko-fi Webhook: 事務回滾失敗', { error: abortError.message })
      }
    }

    logger.error('Ko-fi Shop Order Webhook 處理失敗:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      message_id: req.body.message_id,
      kofi_transaction_id: req.body.kofi_transaction_id,
      amount: req.body.amount,
      direct_link_code: req.body.direct_link_code,
      reqBody: req.body,
      kofiData: req.kofiData,
      productInfo: req.kofiData?.productInfo,
    })

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      logger.error('Ko-fi Webhook: 資料驗證錯誤詳情', {
        validationErrors: error.errors,
        message_id: req.body.message_id,
      })
      return res.status(400).json({
        success: false,
        error: '資料驗證錯誤',
        details: error.message,
        validationErrors: Object.keys(error.errors || {}),
      })
    }

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: '交易ID重複',
      })
    }

    res.status(500).json({
      success: false,
      error: '處理 Shop Order 時發生錯誤',
      message_id: req.body.message_id,
      details: error.message,
    })
  } finally {
    // 清理會話（如果有會話）
    if (session) {
      try {
        session.endSession()
      } catch (endError) {
        logger.warn('Ko-fi Webhook: 會話清理失敗', { error: endError.message })
      }
    }
  }
}
