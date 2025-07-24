import MemeTag from '../models/MemeTag.js'
import Meme from '../models/Meme.js'
import Tag from '../models/Tag.js'

// 建立迷因標籤關聯（支援單一和批量創建）
export const createMemeTag = async (req, res) => {
  try {
    // 檢查是否為批量創建格式
    const { meme_id, tag_id, tag_ids, tagIds, lang = 'zh' } = req.body

    // 批量創建邏輯（兼容前端格式）
    if (tag_ids || tagIds) {
      const batchTagIds = tag_ids || tagIds

      if (!Array.isArray(batchTagIds) || batchTagIds.length === 0) {
        return res.status(400).json({ error: '標籤ID陣列不能為空' })
      }

      if (!meme_id) {
        return res.status(400).json({ error: '迷因ID為必填' })
      }

      // 驗證 Meme 是否存在
      const memeExists = await Meme.findById(meme_id)
      if (!memeExists) {
        return res.status(404).json({ error: '指定的迷因不存在' })
      }

      // 驗證所有 Tag 是否存在
      const tagsExist = await Tag.find({ _id: { $in: batchTagIds } })
      if (tagsExist.length !== batchTagIds.length) {
        return res.status(404).json({ error: '部分標籤不存在' })
      }

      // 檢查已存在的關聯
      const existingMemeTags = await MemeTag.find({
        meme_id,
        tag_id: { $in: batchTagIds },
        lang,
      })

      const existingTagIds = existingMemeTags.map((mt) => mt.tag_id.toString())
      const newTagIds = batchTagIds.filter((tagId) => !existingTagIds.includes(tagId))

      if (newTagIds.length === 0) {
        return res.status(400).json({ error: '所有標籤都已存在關聯' })
      }

      // 批量創建新的關聯
      const newMemeTags = newTagIds.map((tag_id) => ({
        meme_id,
        tag_id,
        lang,
      }))

      const createdMemeTags = await MemeTag.insertMany(newMemeTags)

      // 返回創建結果
      const populatedMemeTags = await MemeTag.find({
        _id: { $in: createdMemeTags.map((mt) => mt._id) },
      })
        .populate('meme_id', 'title')
        .populate('tag_id', 'name')

      return res.status(201).json({
        message: `成功添加 ${createdMemeTags.length} 個標籤關聯`,
        created: populatedMemeTags,
        skipped: existingTagIds.length,
      })
    }

    // 單一創建邏輯
    if (!meme_id || !tag_id) {
      return res.status(400).json({ error: '迷因ID和標籤ID為必填' })
    }

    // 驗證 Meme 是否存在
    const memeExists = await Meme.findById(meme_id)
    if (!memeExists) {
      return res.status(404).json({ error: '指定的迷因不存在' })
    }

    // 驗證 Tag 是否存在
    const tagExists = await Tag.findById(tag_id)
    if (!tagExists) {
      return res.status(404).json({ error: '指定的標籤不存在' })
    }

    // 檢查是否已存在相同的關聯
    const existingMemeTag = await MemeTag.findOne({
      meme_id,
      tag_id,
      lang,
    })

    if (existingMemeTag) {
      return res.status(400).json({
        error: '該迷因已經標記了此標籤',
      })
    }

    const memeTag = new MemeTag({ meme_id, tag_id, lang })
    await memeTag.save()

    // 返回完整信息（populate）
    const populatedMemeTag = await MemeTag.findById(memeTag._id)
      .populate('meme_id', 'title')
      .populate('tag_id', 'name')

    res.status(201).json(populatedMemeTag)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 批量為迷因添加標籤
export const batchCreateMemeTags = async (req, res) => {
  try {
    // 優先從URL參數獲取meme_id，如果沒有則從body獲取
    const meme_id = req.params.memeId || req.body.meme_id
    const { tag_ids, tagIds, lang = 'zh' } = req.body

    // 兼容前端的tagIds格式
    const batchTagIds = tag_ids || tagIds

    if (!Array.isArray(batchTagIds) || batchTagIds.length === 0) {
      return res.status(400).json({ error: '標籤ID陣列不能為空' })
    }

    // 驗證 Meme 是否存在
    const memeExists = await Meme.findById(meme_id)
    if (!memeExists) {
      return res.status(404).json({ error: '指定的迷因不存在' })
    }

    // 驗證所有 Tag 是否存在
    const tagsExist = await Tag.find({ _id: { $in: batchTagIds } })
    if (tagsExist.length !== batchTagIds.length) {
      return res.status(404).json({ error: '部分標籤不存在' })
    }

    // 檢查已存在的關聯
    const existingMemeTags = await MemeTag.find({
      meme_id,
      tag_id: { $in: batchTagIds },
      lang,
    })

    const existingTagIds = existingMemeTags.map((mt) => mt.tag_id.toString())
    const newTagIds = batchTagIds.filter((tagId) => !existingTagIds.includes(tagId))

    if (newTagIds.length === 0) {
      return res.status(400).json({ error: '所有標籤都已存在關聯' })
    }

    // 批量創建新的關聯
    const newMemeTags = newTagIds.map((tag_id) => ({
      meme_id,
      tag_id,
      lang,
    }))

    const createdMemeTags = await MemeTag.insertMany(newMemeTags)

    // 返回創建結果
    const populatedMemeTags = await MemeTag.find({
      _id: { $in: createdMemeTags.map((mt) => mt._id) },
    })
      .populate('meme_id', 'title')
      .populate('tag_id', 'name')

    res.status(201).json({
      message: `成功添加 ${createdMemeTags.length} 個標籤關聯`,
      created: populatedMemeTags,
      skipped: existingTagIds.length,
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 根據迷因ID獲取所有標籤
export const getTagsByMemeId = async (req, res) => {
  try {
    const { memeId } = req.params
    const { lang } = req.query

    // 驗證 Meme 是否存在
    const memeExists = await Meme.findById(memeId)
    if (!memeExists) {
      return res.status(404).json({ error: '指定的迷因不存在' })
    }

    const filter = { meme_id: memeId }
    if (lang) filter.lang = lang

    const memeTags = await MemeTag.find(filter)
      .populate('tag_id', 'name lang')
      .sort({ createdAt: -1 })

    const tags = memeTags.map((mt) => mt.tag_id)

    res.json({
      meme_id: memeId,
      tags,
      total: tags.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 根據標籤ID獲取所有迷因
export const getMemesByTagId = async (req, res) => {
  try {
    const { tagId } = req.params
    const { lang, page = 1, limit = 20 } = req.query

    // 驗證 Tag 是否存在
    const tagExists = await Tag.findById(tagId)
    if (!tagExists) {
      return res.status(404).json({ error: '指定的標籤不存在' })
    }

    const filter = { tag_id: tagId }
    if (lang) filter.lang = lang

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const memeTags = await MemeTag.find(filter)
      .populate('meme_id', 'title image_url author_id status views like_count')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const memes = memeTags.map((mt) => mt.meme_id).filter((meme) => meme) // 過濾可能的 null
    const total = await MemeTag.countDocuments(filter)

    res.json({
      tag_id: tagId,
      memes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得所有迷因標籤關聯（可加分頁、條件查詢）
export const getMemeTags = async (req, res) => {
  try {
    const filter = {}
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    if (req.query.tag_id) filter.tag_id = req.query.tag_id
    if (req.query.lang) filter.lang = req.query.lang

    // 添加分頁支援
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const memeTags = await MemeTag.find(filter)
      .populate('meme_id', 'title image_url')
      .populate('tag_id', 'name lang')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await MemeTag.countDocuments(filter)

    res.json({
      memeTags,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因標籤關聯
export const getMemeTagById = async (req, res) => {
  try {
    const memeTag = await MemeTag.findById(req.params.id)
      .populate('meme_id', 'title image_url author_id')
      .populate('tag_id', 'name lang')

    if (!memeTag) return res.status(404).json({ error: '找不到迷因標籤關聯' })
    res.json(memeTag)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新迷因標籤關聯 (通常不建議更新，只需要刪除重建)
export const updateMemeTag = async (req, res) => {
  try {
    // 迷因標籤關聯通常不需要更新功能，建議使用刪除後重建的方式
    return res.status(400).json({
      error: '迷因標籤關聯不支援更新，請刪除後重新建立',
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除迷因標籤關聯
export const deleteMemeTag = async (req, res) => {
  try {
    const memeTag = await MemeTag.findByIdAndDelete(req.params.id)
    if (!memeTag) return res.status(404).json({ error: '找不到迷因標籤關聯' })

    res.json({
      message: '迷因標籤關聯已刪除',
      deletedMemeTag: memeTag,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 批量刪除迷因的所有標籤
export const deleteMemeAllTags = async (req, res) => {
  try {
    const { memeId } = req.params
    const { lang } = req.query

    // 驗證 Meme 是否存在
    const memeExists = await Meme.findById(memeId)
    if (!memeExists) {
      return res.status(404).json({ error: '指定的迷因不存在' })
    }

    const filter = { meme_id: memeId }
    if (lang) filter.lang = lang

    const result = await MemeTag.deleteMany(filter)

    res.json({
      message: `成功刪除 ${result.deletedCount} 個標籤關聯`,
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
