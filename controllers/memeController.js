import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { body, validationResult } from 'express-validator'
import MemeTag from '../models/MemeTag.js' // Added import for MemeTag
import { processSearchResults, combineSearchFilters } from '../utils/search.js'
import Tag from '../models/Tag.js'
import User from '../models/User.js'

// 建立迷因
export const validateCreateMeme = [
  body('title').isLength({ min: 1, max: 100 }).withMessage('標題必填，且長度需在 1~100 字'),
  body('content').optional().isLength({ max: 1000 }).withMessage('內容長度最多 1000 字'),
]

export const createMeme = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }
  try {
    // 取得圖片網址（多圖上傳，僅取第一張作為主圖）
    let image_url = ''
    if (req.files && req.files.length > 0) {
      image_url = req.files[0].path || req.files[0].url || req.files[0].secure_url || ''
    } else if (req.body.image_url) {
      image_url = req.body.image_url
    }

    // 其他欄位
    const {
      title,
      content = '',
      type,
      detail_markdown,
      tags_cache = [],
      source_url = '',
      video_url = '',
      audio_url = '',
    } = req.body

    // 從認證中間件獲取用戶ID
    const author_id = req.user._id

    // tags_cache 可能是字串（單一標籤），也可能是陣列
    let tagsArr = tags_cache
    if (typeof tags_cache === 'string') {
      try {
        tagsArr = JSON.parse(tags_cache)
      } catch {
        tagsArr = [tags_cache]
      }
    }

    const meme = new Meme({
      title,
      content,
      image_url,
      video_url,
      audio_url,
      author_id,
      type,
      detail_markdown,
      tags_cache: tagsArr,
      source_url,
    })
    await meme.save()
    res.status(201).json({ success: true, data: meme, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有迷因（可加分頁、條件查詢）
export const getMemes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tags,
      search,
      type,
      status,
      sort = 'createdAt',
      order = 'desc',
      useFuzzySearch = 'true', // 新增參數控制是否使用模糊搜尋
    } = req.query

    // 建立基本篩選條件
    const filter = {}

    // 迷因類型篩選
    if (type) {
      filter.type = type
    }

    // 狀態篩選
    if (status) {
      filter.status = status
    }

    // 標籤篩選
    if (tags) {
      let tagArray = tags
      if (typeof tags === 'string') {
        // 支援逗號分隔的標籤字串
        tagArray = tags.split(',').map((tag) => tag.trim())
      }

      // 使用 tags_cache 欄位進行篩選（更高效）
      // tags_cache 是陣列，使用 $or 操作符查詢包含任一標籤的迷因
      const tagConditions = tagArray.map((tag) => ({ tags_cache: tag }))

      // 儲存標籤條件，稍後處理與其他 $or 條件的組合
      filter._tagConditions = tagConditions
    }

    // 排序設定
    const sortObj = {}
    sortObj[sort] = order === 'desc' ? -1 : 1

    // 如果使用模糊搜尋且有搜尋關鍵字，先取得所有符合基本條件的資料
    if (search && useFuzzySearch === 'true') {
      // 建立基本查詢條件（不包含搜尋和標籤條件）
      const baseFilter = {}
      if (type) baseFilter.type = type
      if (status) baseFilter.status = status

      // 先取得所有符合基本篩選條件的迷因
      const allMemesData = await Meme.find(baseFilter)
        .populate('author_id', 'username display_name avatar')
        .lean()

      // 轉換資料結構並扁平化作者資訊，以便 Fuse.js 搜尋
      const memesWithFlattenedAuthor = allMemesData.map((meme) => ({
        ...meme,
        author: meme.author_id,
        author_id: meme.author_id?._id,
        username: meme.author_id?.username || '',
        display_name: meme.author_id?.display_name || '',
      }))

      // 使用 Fuse.js 進行模糊搜尋
      const searchParams = {
        search,
        type,
        status,
        tags: tags
          ? typeof tags === 'string'
            ? tags.split(',').map((tag) => tag.trim())
            : tags
          : [],
      }

      const filteredMemes = combineSearchFilters(memesWithFlattenedAuthor, searchParams)

      // 處理搜尋結果的排序和分頁
      const { results: memes, pagination: searchPagination } = processSearchResults(filteredMemes, {
        page,
        limit,
      })

      res.json({
        memes,
        pagination: searchPagination,
        filters: {
          search,
          tags: tags
            ? typeof tags === 'string'
              ? tags.split(',').map((tag) => tag.trim())
              : tags
            : null,
          type,
          status,
        },
      })
    } else {
      // 使用傳統的 MongoDB 查詢（當 useFuzzySearch 為 false 或沒有搜尋關鍵字時）

      // 建立全新的查詢條件，不依賴原有的 filter 物件
      const mongoQuery = {}

      // 基本篩選條件
      if (type) {
        mongoQuery.type = type
      }

      if (status) {
        mongoQuery.status = status
      }

      // 搜尋和標籤條件
      const orConditions = []

      // 搜尋條件：搜尋標題或內容 (使用 RegExp 避免 Mongoose 轉換問題)
      if (search) {
        const searchRegex = new RegExp(search, 'i')
        orConditions.push({ title: searchRegex }, { content: searchRegex })
      }

      // 標籤條件
      if (tags) {
        let tagArray = tags
        if (typeof tags === 'string') {
          tagArray = tags.split(',').map((tag) => tag.trim())
        }

        // 為每個標籤添加條件
        tagArray.forEach((tag) => {
          orConditions.push({ tags_cache: tag })
        })
      }

      // 如果有搜尋或標籤條件，加入 $or 查詢
      if (orConditions.length > 0) {
        mongoQuery.$or = orConditions
      }

      // 分頁計算
      const skip = (parseInt(page) - 1) * parseInt(limit)
      const limitNum = parseInt(limit)

      // 查詢迷因
      const memesData = await Meme.find(mongoQuery)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('author_id', 'username display_name avatar')

      // 轉換資料結構，將 author_id 改為 author
      const memes = memesData.map((meme) => {
        const memeObj = meme.toObject()
        return {
          ...memeObj,
          author: memeObj.author_id,
          author_id: memeObj.author_id?._id,
        }
      })

      // 計算總數
      const total = await Meme.countDocuments(mongoQuery)

      // 計算總頁數
      const totalPages = Math.ceil(total / limitNum)

      res.json({
        memes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          search,
          tags: tags
            ? typeof tags === 'string'
              ? tags.split(',').map((tag) => tag.trim())
              : tags
            : null,
          type,
          status,
        },
      })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因
export const getMemeById = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json(meme)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新迷因
export const updateMeme = async (req, res) => {
  try {
    const meme = await Meme.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json(meme)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除迷因
export const deleteMeme = async (req, res) => {
  try {
    const meme = await Meme.findByIdAndDelete(req.params.id)
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json({ message: '迷因已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 新增協作者
export const addEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限授權協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    if (meme.editors.map((id) => id.toString()).includes(userId)) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: '該用戶已是協作者' })
    }
    meme.editors.push(userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 移除協作者
export const removeEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限移除協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    meme.editors = meme.editors.filter((id) => id.toString() !== userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
// 使用標籤ID進行進階篩選（使用 MemeTag 關聯表）
export const getMemesByTags = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tagIds,
      search,
      type,
      status,
      sort = 'createdAt',
      order = 'desc',
      useFuzzySearch = 'true', // 新增參數控制是否使用模糊搜尋
    } = req.query

    // 驗證標籤ID參數
    if (!tagIds) {
      return res.status(400).json({ error: '請提供標籤ID參數' })
    }

    let tagIdArray = tagIds
    if (typeof tagIds === 'string') {
      // 支援逗號分隔的標籤ID字串
      tagIdArray = tagIds.split(',').map((id) => id.trim())
    }

    // 排序設定
    const sortObj = {}
    sortObj[sort] = order === 'desc' ? -1 : 1

    // 如果使用模糊搜尋且有搜尋關鍵字
    if (search && useFuzzySearch === 'true') {
      // 先取得所有符合標籤條件的迷因
      const basePipeline = [
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        {
          $group: {
            _id: '$meme_id',
          },
        },
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        {
          $unwind: '$meme',
        },
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'meme.author_id',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: '$meme._id',
            title: '$meme.title',
            content: '$meme.content',
            detail_markdown: '$meme.detail_markdown',
            type: '$meme.type',
            image_url: '$meme.image_url',
            video_url: '$meme.video_url',
            audio_url: '$meme.audio_url',
            status: '$meme.status',
            views: '$meme.views',
            like_count: '$meme.like_count',
            comment_count: '$meme.comment_count',
            tags_cache: '$meme.tags_cache',
            createdAt: '$meme.createdAt',
            updatedAt: '$meme.updatedAt',
            author_id: '$meme.author_id',
            username: '$author.username',
            display_name: '$author.display_name',
            author: {
              _id: '$author._id',
              username: '$author.username',
              display_name: '$author.display_name',
              avatar: '$author.avatar',
            },
          },
        },
      ]

      const allMemes = await MemeTag.aggregate(basePipeline)

      // 使用 Fuse.js 進行模糊搜尋
      const searchParams = {
        search,
        type,
        status,
      }

      const filteredMemes = combineSearchFilters(allMemes, searchParams)

      // 處理搜尋結果的排序和分頁
      const { results: memes, pagination: searchPagination } = processSearchResults(filteredMemes, {
        page,
        limit,
      })

      res.json({
        memes,
        pagination: searchPagination,
        filters: {
          search,
          tagIds: tagIdArray,
          type,
          status,
        },
      })
    } else {
      // 使用傳統的 MongoDB 聚合查詢
      const pipeline = [
        // 第一步：篩選符合標籤的迷因標籤關聯
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        // 第二步：分組去重，取得迷因ID
        {
          $group: {
            _id: '$meme_id',
          },
        },
        // 第三步：查詢迷因詳細資訊
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        // 第四步：展開迷因陣列
        {
          $unwind: '$meme',
        },
        // 第五步：篩選迷因條件
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(search && {
              $or: [
                { 'meme.title': new RegExp(search, 'i') },
                { 'meme.content': new RegExp(search, 'i') },
              ],
            }),
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        // 第六步：排序
        {
          $sort: sortObj,
        },
        // 第七步：分頁
        {
          $skip: (parseInt(page) - 1) * parseInt(limit),
        },
        {
          $limit: parseInt(limit),
        },
        // 第八步：查詢作者資訊
        {
          $lookup: {
            from: 'users',
            localField: 'meme.author_id',
            foreignField: '_id',
            as: 'author',
          },
        },
        // 第九步：展開作者陣列
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        // 第十步：重新整理輸出格式
        {
          $project: {
            _id: '$meme._id',
            title: '$meme.title',
            content: '$meme.content',
            type: '$meme.type',
            image_url: '$meme.image_url',
            video_url: '$meme.video_url',
            audio_url: '$meme.audio_url',
            status: '$meme.status',
            views: '$meme.views',
            like_count: '$meme.like_count',
            comment_count: '$meme.comment_count',
            tags_cache: '$meme.tags_cache',
            createdAt: '$meme.createdAt',
            updatedAt: '$meme.updatedAt',
            author: {
              _id: '$author._id',
              username: '$author.username',
              display_name: '$author.display_name',
              avatar: '$author.avatar',
            },
          },
        },
      ]

      // 執行聚合查詢
      const memes = await MemeTag.aggregate(pipeline)

      // 計算總數（使用類似的聚合管道但只計算數量）
      const countPipeline = [
        {
          $match: {
            tag_id: { $in: tagIdArray },
          },
        },
        {
          $group: {
            _id: '$meme_id',
          },
        },
        {
          $lookup: {
            from: 'memes',
            localField: '_id',
            foreignField: '_id',
            as: 'meme',
          },
        },
        {
          $unwind: '$meme',
        },
        {
          $match: {
            'meme.status': { $ne: 'deleted' },
            ...(search && {
              $or: [
                { 'meme.title': new RegExp(search, 'i') },
                { 'meme.content': new RegExp(search, 'i') },
              ],
            }),
            ...(type && { 'meme.type': type }),
            ...(status && { 'meme.status': status }),
          },
        },
        {
          $count: 'total',
        },
      ]

      const totalResult = await MemeTag.aggregate(countPipeline)
      const total = totalResult.length > 0 ? totalResult[0].total : 0
      const limitNum = parseInt(limit)

      // 計算總頁數
      const totalPages = Math.ceil(total / limitNum)

      res.json({
        memes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          search,
          tagIds: tagIdArray,
          type,
          status,
        },
      })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得搜尋建議
export const getSearchSuggestions = async (req, res) => {
  try {
    const {
      q = '',
      limit = 10,
      type = 'all', // all, keywords, tags, authors
    } = req.query

    const searchTerm = q.trim()
    const limitNum = Math.min(parseInt(limit), 50) // 最多返回50個建議

    const suggestions = {
      keywords: [],
      tags: [],
      authors: [],
    }

    // 如果沒有搜尋詞，返回熱門建議
    if (!searchTerm) {
      // 取得熱門標籤（基於使用頻率）
      if (type === 'all' || type === 'tags') {
        const popularTags = await Meme.aggregate([
          { $match: { status: 'public' } },
          { $unwind: '$tags_cache' },
          { $group: { _id: '$tags_cache', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limitNum },
          { $project: { _id: 0, name: '$_id', count: 1 } },
        ])
        suggestions.tags = popularTags
      }

      // 取得熱門關鍵字（基於最近搜尋的迷因標題）
      if (type === 'all' || type === 'keywords') {
        const popularKeywords = await Meme.aggregate([
          { $match: { status: 'public' } },
          { $sort: { views: -1 } },
          { $limit: limitNum },
          { $project: { _id: 0, title: 1, views: 1 } },
        ])
        suggestions.keywords = popularKeywords.map((item) => ({
          text: item.title,
          views: item.views,
        }))
      }

      // 取得活躍作者
      if (type === 'all' || type === 'authors') {
        const activeAuthors = await Meme.aggregate([
          { $match: { status: 'public' } },
          {
            $group: {
              _id: '$author_id',
              meme_count: { $sum: 1 },
              total_views: { $sum: '$views' },
            },
          },
          { $sort: { meme_count: -1, total_views: -1 } },
          { $limit: limitNum },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },
          {
            $project: {
              _id: 0,
              username: '$author.username',
              display_name: '$author.display_name',
              meme_count: 1,
              total_views: 1,
            },
          },
        ])
        suggestions.authors = activeAuthors
      }

      return res.json({
        success: true,
        data: suggestions,
        query: searchTerm,
      })
    }

    // 有搜尋詞時的建議
    const promises = []

    // 關鍵字建議（基於迷因標題和內容）
    if (type === 'all' || type === 'keywords') {
      promises.push(
        Meme.aggregate([
          {
            $match: {
              status: 'public',
              $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { content: { $regex: searchTerm, $options: 'i' } },
              ],
            },
          },
          { $sort: { views: -1, like_count: -1 } },
          { $limit: limitNum },
          {
            $project: {
              _id: 0,
              title: 1,
              content: { $substr: ['$content', 0, 100] }, // 只取前100字
              views: 1,
              like_count: 1,
            },
          },
        ]).then((results) => {
          suggestions.keywords = results.map((item) => ({
            text: item.title,
            snippet: item.content,
            views: item.views,
            likes: item.like_count,
          }))
        }),
      )
    }

    // 標籤建議
    if (type === 'all' || type === 'tags') {
      promises.push(
        Tag.find({
          name: { $regex: searchTerm, $options: 'i' },
        })
          .limit(limitNum)
          .select('name -_id')
          .then(async (tags) => {
            // 取得每個標籤的使用次數
            const tagStats = await Promise.all(
              tags.map(async (tag) => {
                const count = await Meme.countDocuments({
                  status: 'public',
                  tags_cache: tag.name,
                })
                return {
                  name: tag.name,
                  count,
                }
              }),
            )
            // 按使用次數排序
            suggestions.tags = tagStats.sort((a, b) => b.count - a.count)
          }),
      )
    }

    // 作者建議
    if (type === 'all' || type === 'authors') {
      promises.push(
        User.find({
          $or: [
            { username: { $regex: searchTerm, $options: 'i' } },
            { display_name: { $regex: searchTerm, $options: 'i' } },
          ],
        })
          .limit(limitNum)
          .select('username display_name')
          .then(async (users) => {
            // 取得每個作者的迷因數量
            const authorStats = await Promise.all(
              users.map(async (user) => {
                const meme_count = await Meme.countDocuments({
                  status: 'public',
                  author_id: user._id,
                })
                return {
                  username: user.username,
                  display_name: user.display_name,
                  meme_count,
                }
              }),
            )
            // 按迷因數量排序
            suggestions.authors = authorStats.sort((a, b) => b.meme_count - a.meme_count)
          }),
      )
    }

    // 等待所有查詢完成
    await Promise.all(promises)

    res.json({
      success: true,
      data: suggestions,
      query: searchTerm,
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      data: null,
    })
  }
}
