import Tag from '../models/Tag.js'
import MemeTag from '../models/MemeTag.js'

// 建立標籤
export const createTag = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 檢查是否已存在相同名稱和語言的標籤
    const existingTag = await Tag.findOne({
      name: req.body.name,
      lang: req.body.lang || 'zh',
    }).session(session)

    if (existingTag) {
      await session.abortTransaction()
      return res.status(400).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    const tag = new Tag(req.body)
    await tag.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json(tag)
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(400).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有標籤（可加分頁、條件查詢）
export const getTags = async (req, res) => {
  try {
    const filter = {}
    if (req.query.lang) filter.lang = req.query.lang
    if (req.query.name) filter.name = new RegExp(req.query.name, 'i') // 模糊搜尋

    // 如果有分頁參數，回傳完整格式；否則回傳簡單陣列格式
    if (req.query.page || req.query.limit) {
      // 添加分頁支援
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 50
      const skip = (page - 1) * limit

      const tags = await Tag.find(filter).sort({ name: 1 }).skip(skip).limit(limit)
      const total = await Tag.countDocuments(filter)

      res.json({
        tags,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } else {
      // 簡單格式，直接回傳標籤陣列（適用於前端下拉選單等用途）
      const tags = await Tag.find(filter).sort({ name: 1 }).limit(200) // 限制200個避免過多
      res.json(tags)
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得熱門標籤統計
export const getPopularTags = async (req, res) => {
  try {
    const { lang, limit = 20 } = req.query

    // 使用 MongoDB 聚合管道統計每個標籤的使用次數
    const matchStage = {}
    if (lang) matchStage.lang = lang

    const popularTags = await MemeTag.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$tag_id',
          usageCount: { $sum: 1 },
          lang: { $first: '$lang' },
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: '_id',
          foreignField: '_id',
          as: 'tag',
        },
      },
      {
        $unwind: '$tag',
      },
      {
        $project: {
          _id: '$tag._id',
          name: '$tag.name',
          lang: '$tag.lang',
          usageCount: 1,
          createdAt: '$tag.createdAt',
        },
      },
      {
        $sort: { usageCount: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ])

    res.json({
      popularTags,
      total: popularTags.length,
      generatedAt: new Date(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一標籤
export const getTagById = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id)
    if (!tag) return res.status(404).json({ error: '找不到標籤' })

    // 可選：同時返回使用此標籤的迷因數量
    const usageCount = await MemeTag.countDocuments({ tag_id: req.params.id })

    res.json({
      ...tag.toJSON(),
      usageCount,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新標籤
export const updateTag = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 如果要更新名稱，檢查是否會造成重複
    if (req.body.name) {
      const existingTag = await Tag.findOne({
        name: req.body.name,
        lang: req.body.lang || 'zh',
        _id: { $ne: req.params.id },
      }).session(session)

      if (existingTag) {
        await session.abortTransaction()
        return res.status(400).json({
          error: '該語言下已存在相同名稱的標籤',
        })
      }
    }

    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!tag) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到標籤' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json(tag)
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        error: '該語言下已存在相同名稱的標籤',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(400).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除標籤
export const deleteTag = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Tag.startSession()
  session.startTransaction()

  try {
    // 檢查是否有迷因正在使用此標籤
    const usageCount = await MemeTag.countDocuments({ tag_id: req.params.id }).session(session)

    if (usageCount > 0) {
      await session.abortTransaction()
      return res.status(400).json({
        error: `無法刪除標籤，目前有 ${usageCount} 個迷因正在使用此標籤`,
        usageCount,
      })
    }

    const tag = await Tag.findByIdAndDelete(req.params.id).session(session)
    if (!tag) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到標籤' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({
      message: '標籤已刪除',
      deletedTag: tag,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}
