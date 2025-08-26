import Sponsor from '../models/Sponsor.js'

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
