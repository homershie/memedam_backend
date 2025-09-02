import Scene from '../models/Scene.js'
import Source from '../models/Source.js'
import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import { translateToEnglish } from '../services/googleTranslate.js'
import { toSlug, toSlugOrNull } from '../utils/slugify.js'

// 取得單一片段及相關資料
export const getSceneBundle = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params
    const include = (req.query.include || '').split(',').filter(Boolean)

    // 查詢片段
    const query = mongoose.Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }

    const scene = await Scene.findOne(query).lean()

    if (!scene) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '片段不存在',
      })
    }

    const result = { scene }

    // 包含來源資料
    if (include.includes('source')) {
      result.source = await Source.findById(scene.source_id)
        .select('title slug type year origin_country thumbnails')
        .lean()
    }

    // 包含使用此片段的迷因
    if (include.includes('memes')) {
      result.memes = await Meme.find({
        scene_id: scene._id,
        status: 'public',
      })
        .select('title slug image_url video_url like_count view_count author_id createdAt')
        .sort({ like_count: -1, createdAt: -1 })
        .limit(30)
        .populate('author_id', 'username display_name avatar')
        .lean()
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 取得來源的所有片段
export const getSourceScenes = async (req, res, next) => {
  try {
    const { sourceId } = req.params
    const { sortBy = 'time', query, page = 1, limit = 20 } = req.query

    // 驗證來源是否存在
    const source = await Source.findById(sourceId)
    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '來源不存在',
      })
    }

    // 如果有查詢參數，使用搜尋功能
    if (query) {
      const scenes = await Scene.searchScenes(query, {
        sourceId,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
      })
      return res.status(StatusCodes.OK).json({
        success: true,
        data: scenes.data,
        pagination: scenes.pagination,
        source: {
          title: source.title,
          slug: source.slug,
          type: source.type,
        },
      })
    }

    // 否則取得所有片段
    const scenes = await Scene.getSourceScenes(sourceId, { sortBy })

    res.status(StatusCodes.OK).json({
      success: true,
      data: scenes,
      source: {
        title: source.title,
        slug: source.slug,
        type: source.type,
      },
    })
  } catch (error) {
    next(error)
  }
}

// 建立新片段
export const createScene = async (req, res, next) => {
  try {
    const {
      source_id,
      title,
      episode,
      start_time,
      end_time,
      quote,
      transcript,
      description,
      images,
      video_url,
      audio_url,
      slug,
      tags,
    } = req.body

    // 驗證來源是否存在
    const source = await Source.findById(source_id)
    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '指定的來源不存在',
      })
    }

    // 處理 slug 自動生成
    let finalSlug = slug
    if (!finalSlug && title) {
      try {
        // 嘗試翻譯標題為英文後生成 slug
        const englishTitle = await translateToEnglish(title, 'zh')
        let baseSlug = toSlug(englishTitle)

        // 如果翻譯失敗或結果為空，直接使用原標題生成 slug
        if (!baseSlug) {
          baseSlug = toSlug(title)
        }

        if (baseSlug) {
          // 檢查 slug 唯一性，如果重複則加上數字後綴
          finalSlug = baseSlug
          let counter = 1

          while (true) {
            const existingSlugScene = await Scene.findOne({ slug: finalSlug })

            if (!existingSlugScene) {
              break
            }

            finalSlug = `${baseSlug}-${counter}`
            counter++
          }
        }
      } catch (error) {
        console.warn('自動生成 slug 失敗，使用原標題:', error.message)
        // 如果翻譯失敗，嘗試直接從標題生成 slug
        finalSlug = toSlugOrNull(title)
      }
    }

    // 檢查 slug 是否已存在
    if (finalSlug) {
      const existingScene = await Scene.findOne({ slug: finalSlug })
      if (existingScene) {
        return res.status(StatusCodes.CONFLICT).json({
          success: false,
          message: 'Slug 已被使用',
        })
      }
    }

    // 驗證時間邏輯
    if (end_time && start_time && end_time <= start_time) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '結束時間必須大於開始時間',
      })
    }

    const scene = new Scene({
      source_id,
      title,
      episode,
      start_time,
      end_time,
      quote,
      transcript,
      description,
      images,
      video_url,
      audio_url,
      slug: finalSlug,
      tags,
    })

    await scene.save()

    // 更新來源的片段計數
    await Source.findByIdAndUpdate(source_id, {
      $inc: { 'counts.scenes': 1 },
    })

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '片段建立成功',
      data: scene,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Slug 已被使用',
      })
    }
    next(error)
  }
}

// 更新片段
export const updateScene = async (req, res, next) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // 移除不應該被更新的欄位
    delete updateData._id
    delete updateData.source_id // 不允許更改所屬來源
    delete updateData.counts
    delete updateData.createdAt
    delete updateData.updatedAt

    // 驗證時間邏輯
    if (
      updateData.end_time &&
      updateData.start_time &&
      updateData.end_time <= updateData.start_time
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '結束時間必須大於開始時間',
      })
    }

    const scene = await Scene.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })

    if (!scene) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '片段不存在',
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '片段更新成功',
      data: scene,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Slug 已被使用',
      })
    }
    next(error)
  }
}

// 刪除片段
export const deleteScene = async (req, res, next) => {
  try {
    const { id } = req.params

    // 檢查是否有相關的迷因
    const memeCount = await Meme.countDocuments({
      scene_id: id,
      status: { $ne: 'deleted' },
    })

    if (memeCount > 0) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: `無法刪除：此片段有 ${memeCount} 個相關迷因`,
      })
    }

    const scene = await Scene.findByIdAndUpdate(
      id,
      { status: 'deleted', deleted_at: new Date() },
      { new: true },
    )

    if (!scene) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '片段不存在',
      })
    }

    // 更新來源的片段計數
    await Source.findByIdAndUpdate(scene.source_id, {
      $inc: { 'counts.scenes': -1 },
    })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '片段已標記為刪除',
    })
  } catch (error) {
    next(error)
  }
}

// 更新片段統計
export const updateSceneStats = async (req, res, next) => {
  try {
    const { id } = req.params

    const scene = await Scene.findById(id)
    if (!scene) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '片段不存在',
      })
    }

    await scene.updateCounts()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '統計數據更新成功',
      data: scene.counts,
    })
  } catch (error) {
    next(error)
  }
}

// 搜尋片段
export const searchScenes = async (req, res, next) => {
  try {
    const { q, sourceId, tags, page = 1, limit = 20 } = req.query

    const options = {
      sourceId,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [],
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    }

    const scenes = await Scene.searchScenes(q, options)

    res.status(StatusCodes.OK).json({
      success: true,
      data: scenes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// 取得熱門片段
export const getPopularScenes = async (req, res, next) => {
  try {
    const { limit = 20, sourceId } = req.query

    const scenes = await Scene.getPopularScenes(parseInt(limit), sourceId)

    res.status(StatusCodes.OK).json({
      success: true,
      data: scenes,
    })
  } catch (error) {
    next(error)
  }
}
