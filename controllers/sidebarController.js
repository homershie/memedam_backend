import Meme from '../models/Meme.js'
import {
  getTemplateDefinition,
  validateSidebarData,
  renderSidebar,
  getAllTemplates,
} from '../utils/sidebarTemplates.js'

// 取得所有可用模板
export const getTemplates = async (req, res) => {
  try {
    const templates = getAllTemplates()

    res.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    console.error('取得模板列表失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得模板列表失敗',
      error: error.message,
    })
  }
}

// 取得特定模板定義
export const getTemplate = async (req, res) => {
  try {
    const { templateName } = req.params
    const template = getTemplateDefinition(templateName)

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的模板',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error) {
    console.error('取得模板定義失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得模板定義失敗',
      error: error.message,
    })
  }
}

// 取得迷因的側邊欄資料
export const getMemeSidebar = async (req, res) => {
  try {
    const { memeId } = req.params

    const meme = await Meme.findById(memeId)
    if (!meme) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的迷因',
      })
    }

    const templateName = meme.sidebar_template || 'base'
    const template = getTemplateDefinition(templateName)
    const sidebarData = meme.sidebar_data || template.defaultData

    // 添加迷因的媒體資訊到側邊欄資料中
    const mediaData = {
      ...sidebarData,
      meme_type: meme.type,
      image_url: meme.image_url,
      video_url: meme.video_url,
      audio_url: meme.audio_url,
      content: meme.content,
    }

    // 渲染側邊欄 HTML
    const renderedHtml = renderSidebar(templateName, mediaData)

    res.json({
      success: true,
      data: {
        template: templateName,
        templateDefinition: template,
        data: sidebarData,
        renderedHtml,
        schema: meme.sidebar_schema || template.schema,
      },
    })
  } catch (error) {
    console.error('取得迷因側邊欄失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得迷因側邊欄失敗',
      error: error.message,
    })
  }
}

// 更新迷因的側邊欄資料
export const updateMemeSidebar = async (req, res) => {
  try {
    const { memeId } = req.params
    const { template, data, schema } = req.body

    // 檢查迷因是否存在
    const meme = await Meme.findById(memeId)
    if (!meme) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的迷因',
      })
    }

    // 檢查權限（只有作者或管理員可以編輯）
    const currentUserId = req.user?.id
    const authorId = meme.author_id?.toString()

    if (currentUserId !== authorId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '沒有權限編輯此迷因的側邊欄',
      })
    }

    // 取得模板定義
    const templateDefinition = getTemplateDefinition(template || meme.sidebar_template || 'base')

    // 驗證資料
    const validation = validateSidebarData(data, schema || templateDefinition.schema)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: '側邊欄資料驗證失敗',
        errors: validation.errors,
      })
    }

    // 更新迷因的側邊欄資料
    const updateData = {
      sidebar_template: template || meme.sidebar_template,
      sidebar_data: data || {},
      sidebar_schema: schema || templateDefinition.schema,
    }

    // 標記為已修改
    meme.markAsModified(updateData)

    // 保存更新
    Object.assign(meme, updateData)
    await meme.save()

    // 渲染更新後的側邊欄
    const renderedHtml = renderSidebar(updateData.sidebar_template, updateData.sidebar_data)

    res.json({
      success: true,
      message: '側邊欄更新成功',
      data: {
        template: updateData.sidebar_template,
        templateDefinition,
        data: updateData.sidebar_data,
        renderedHtml,
        schema: updateData.sidebar_schema,
      },
    })
  } catch (error) {
    console.error('更新迷因側邊欄失敗:', error)
    res.status(500).json({
      success: false,
      message: '更新迷因側邊欄失敗',
      error: error.message,
    })
  }
}

// 重置迷因的側邊欄為預設值
export const resetMemeSidebar = async (req, res) => {
  try {
    const { memeId } = req.params
    const { template } = req.query

    // 檢查迷因是否存在
    const meme = await Meme.findById(memeId)
    if (!meme) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的迷因',
      })
    }

    // 檢查權限
    const currentUserId = req.user?.id
    const authorId = meme.author_id?.toString()

    if (currentUserId !== authorId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '沒有權限重置此迷因的側邊欄',
      })
    }

    // 取得模板定義
    const templateName = template || 'base'
    const templateDefinition = getTemplateDefinition(templateName)

    // 重置為預設值
    const updateData = {
      sidebar_template: templateName,
      sidebar_data: templateDefinition.defaultData,
      sidebar_schema: templateDefinition.schema,
    }

    // 標記為已修改
    meme.markAsModified(updateData)

    // 保存更新
    Object.assign(meme, updateData)
    await meme.save()

    // 渲染重置後的側邊欄
    const renderedHtml = renderSidebar(templateName, templateDefinition.defaultData)

    res.json({
      success: true,
      message: '側邊欄重置成功',
      data: {
        template: templateName,
        templateDefinition,
        data: templateDefinition.defaultData,
        renderedHtml,
        schema: templateDefinition.schema,
      },
    })
  } catch (error) {
    console.error('重置迷因側邊欄失敗:', error)
    res.status(500).json({
      success: false,
      message: '重置迷因側邊欄失敗',
      error: error.message,
    })
  }
}

// 預覽側邊欄（不保存）
export const previewSidebar = async (req, res) => {
  try {
    const { template, data } = req.body

    // 取得模板定義
    const templateDefinition = getTemplateDefinition(template || 'base')

    // 驗證資料
    const validation = validateSidebarData(data, templateDefinition.schema)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: '側邊欄資料驗證失敗',
        errors: validation.errors,
      })
    }

    // 渲染側邊欄
    const renderedHtml = renderSidebar(template || 'base', data || {})

    res.json({
      success: true,
      data: {
        template: template || 'base',
        templateDefinition,
        data: data || {},
        renderedHtml,
        schema: templateDefinition.schema,
      },
    })
  } catch (error) {
    console.error('預覽側邊欄失敗:', error)
    res.status(500).json({
      success: false,
      message: '預覽側邊欄失敗',
      error: error.message,
    })
  }
}

// 批次更新多個迷因的側邊欄模板
export const batchUpdateSidebarTemplate = async (req, res) => {
  try {
    const { memeIds, template } = req.body

    // 檢查權限（只有管理員可以批次更新）
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有管理員可以執行批次更新',
      })
    }

    // 驗證模板
    const templateDefinition = getTemplateDefinition(template)
    if (!templateDefinition) {
      return res.status(400).json({
        success: false,
        message: '無效的模板名稱',
      })
    }

    // 批次更新
    const updatePromises = memeIds.map(async (memeId) => {
      const meme = await Meme.findById(memeId)
      if (meme) {
        meme.sidebar_template = template
        meme.sidebar_data = templateDefinition.defaultData
        meme.sidebar_schema = templateDefinition.schema
        meme.markAsModified({
          sidebar_template: template,
          sidebar_data: templateDefinition.defaultData,
          sidebar_schema: templateDefinition.schema,
        })
        return meme.save()
      }
      return null
    })

    const results = await Promise.all(updatePromises)
    const updatedCount = results.filter((result) => result !== null).length

    res.json({
      success: true,
      message: `成功更新 ${updatedCount} 個迷因的側邊欄模板`,
      data: {
        updatedCount,
        template,
        templateDefinition,
      },
    })
  } catch (error) {
    console.error('批次更新側邊欄模板失敗:', error)
    res.status(500).json({
      success: false,
      message: '批次更新側邊欄模板失敗',
      error: error.message,
    })
  }
}
