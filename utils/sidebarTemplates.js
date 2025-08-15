// 側邊欄模板系統
// 重新設計為更貼近迷因語境的模板

// 平台選項
const SOURCES = [
  '電影',
  '電視劇',
  '節目',
  '綜藝',
  '影片',
  '直播',
  '實況',
  '賽事',
  '動畫',
  '漫畫',
  '小說',
  '遊戲',
  '專輯',
  '歌曲',
  '藝術',
  '文學',
  '網站',
  '演講',
  '網路',
  '4chan',
  'Reddit',
  'Twitter/X',
  'YouTube',
  'TikTok',
  'Facebook',
  'Instagram',
  'Discord',
  'Twitch',
  'Telegram',
  'LINE',
  'WhatsApp',
  'Snapchat',
  'LinkedIn',
  'Pinterest',
  'Tumblr',
  'Imgur',
  '9GAG',
  'DeviantArt',
  'Steam',
  'PTT',
  '巴哈姆特',
  'Dcard',
  'Mobile01',
  'Komica',
  '批踢踢',
  '爆料公社',
  '靠北',
  '微博',
  '抖音',
  '小紅書',
  '知乎',
  '嗶哩嗶哩',
  'QQ空間',
  '貼吧',
  'Pixiv',
  'Niconico',
  'Twitter',
  'YouTube Shorts',
  'Instagram Reels',
  'TikTok',
  '其他',
]

// 迷因類別
const MEME_CATEGORIES = [
  '二創',
  '表情符號',
  '網路用語',
  '惡搞',
  '諷刺',
  '影片梗',
  '音樂梗',
  '政治梗',
  '遊戲梗',
  '動漫梗',
  '電影梗',
  '音樂梗',
  '體育梗',
  '新聞梗',
  '廣告梗',
  '商品梗',
  '品牌梗',
  '科技梗',
  '教育梗',
  '生活梗',
  '工作梗',
  '學校梗',
  '交通梗',
  '天氣梗',
  '節日梗',
  '其他',
]

// 內容分級
const CONTENT_RATINGS = [
  '適合所有年齡',
  '適合18歲以上',
  '衝擊性',
  '血腥',
  '政治敏感',
  '暴力',
  '恐怖',
  '噁心',
  '性暗示',
  '粗俗語言',
  '歧視',
  '仇恨言論',
  '自殘',
  '藥物',
  '酒精',
  '賭博',
  '詐騙',
  '兒童不宜',
  '其他',
]

// 版權類型
const COPYRIGHT_TYPES = [
  '不確定',
  'CC0 (公共領域)',
  'CC BY (署名)',
  'CC BY-SA (署名-相同方式分享)',
  'CC BY-NC (署名-非商業)',
  'CC BY-NC-SA (署名-非商業-相同方式分享)',
  'CC BY-ND (署名-禁止改作)',
  'CC BY-NC-ND (署名-非商業-禁止改作)',
  '作者自有',
  '合理使用',
  '商業授權',
  '開源授權',
  'MIT',
  'GPL',
  'Apache',
  '版權所有',
  '已授權',
  '爭議中',
  '其他',
]

// 語言選項
const LANGUAGES = [
  '繁體中文',
  '簡體中文',
  '台語',
  '客語',
  '粵語',
  '英文',
  '日文',
  '韓文',
  '法文',
  '德文',
  '西班牙文',
  '義大利文',
  '俄文',
  '阿拉伯文',
  '印度文',
  '泰文',
  '越南文',
  '馬來文',
  '印尼文',
  '菲律賓文',
  '葡萄牙文',
  '荷蘭文',
  '瑞典文',
  '挪威文',
  '丹麥文',
  '芬蘭文',
  '希臘文',
  '土耳其文',
  '波蘭文',
  '捷克文',
  '匈牙利文',
  '其他',
]

// 文化圈選項
const CULTURAL_REGIONS = [
  '台灣',
  '中國大陸',
  '香港',
  '澳門',
  '新加坡',
  '馬來西亞',
  '日本',
  '韓國',
  '北韓',
  '泰國',
  '越南',
  '菲律賓',
  '印尼',
  '印度',
  '美國',
  '加拿大',
  '英國',
  '法國',
  '德國',
  '義大利',
  '西班牙',
  '俄羅斯',
  '澳洲',
  '紐西蘭',
  '巴西',
  '阿根廷',
  '墨西哥',
  '以色列',
  '沙烏地阿拉伯',
  '土耳其',
  '埃及',
  '南非',
  '歐美',
  '東亞',
  '東南亞',
  '南亞',
  '中東',
  '非洲',
  '拉丁美洲',
  '其他',
]

// 預設模板定義
export const SIDEBAR_TEMPLATES = {
  // 通用基底模板
  default: {
    name: '迷因（預設）',
    description: '適用於所有迷因類型的基礎資訊模板',
    schema: {
      type: 'object',
      properties: {
        short_name: {
          type: 'string',
          title: '迷因簡稱',
          description: '迷因的簡稱',
        },
        long_name: {
          type: 'string',
          title: '迷因全名',
          description: '迷因的全名',
        },
        category: {
          type: 'string',
          title: '迷因類別',
          description: '迷因的主要分類',
          enum: MEME_CATEGORIES,
          enumNames: MEME_CATEGORIES,
        },
        aliases: {
          type: 'array',
          title: '別名（AKA/別稱）',
          description: '迷因的其他稱呼或簡稱，用逗號分隔，例如：「梗圖,梗,迷因」',
          items: {
            type: 'string',
          },
        },
        first_appearance_date: {
          type: 'string',
          title: '首次出現日期',
          description: '迷因首次出現的日期',
          format: 'date',
        },
        first_source: {
          type: 'string',
          title: '首次出現來源',
          description: '迷因首次出現的來源',
          enum: SOURCES,
          enumNames: SOURCES,
        },
        origin_url: {
          type: 'string',
          title: '來源連結',
          description: '迷因的原始來源連結',
          format: 'uri',
        },
        origin_author: {
          type: 'object',
          title: '來源作者',
          description: '迷因的原始創作者資訊',
          properties: {
            name: {
              type: 'string',
              title: '作者名稱',
            },
            handle: {
              type: 'string',
              title: '作者帳號',
            },
            url: {
              type: 'string',
              title: '作者連結',
              format: 'uri',
            },
          },
        },
        languages: {
          type: 'array',
          title: '語言',
          description: '迷因使用的語言',
          items: {
            type: 'string',
            enum: LANGUAGES,
          },
        },
        related_memes: {
          type: 'array',
          title: '相關迷因',
          description: '與此迷因相關的其他迷因，用逗號分隔，例如：「梗圖,梗,迷因」',
          items: {
            type: 'string',
          },
        },
        related_memes_url: {
          type: 'string',
          title: '相關迷因連結',
          description: '與此迷因相關的其他迷因的連結',
          format: 'uri',
        },
        related_people: {
          type: 'array',
          title: '相關人物',
          description: '與此迷因相關的人物、角色、演員、KOL、創作者',
          items: {
            type: 'string',
          },
        },
        cultural_region: {
          type: 'string',
          title: '地區/文化圈',
          description: '迷因的文化背景',
          enum: CULTURAL_REGIONS,
        },
        content_rating: {
          type: 'string',
          title: '內容分級',
          description: '迷因的內容分級',
          enum: CONTENT_RATINGS,
          enumNames: CONTENT_RATINGS,
        },
        copyright: {
          type: 'string',
          title: '版權/授權',
          description: '迷因的版權狀態',
          enum: COPYRIGHT_TYPES,
          enumNames: COPYRIGHT_TYPES,
        },
        source_notes: {
          type: 'string',
          title: '來源備註',
          description: '關於來源的補充說明',
          maxLength: 500,
        },
      },
      required: ['category', 'languages', 'cultural_region', 'content_rating', 'copyright'],
    },
    defaultData: {
      short_name: '',
      long_name: '',
      category: '二創',
      aliases: [],
      first_appearance_date: '',
      first_source: '其他',
      origin_url: '',
      origin_author: {
        name: '',
        handle: '',
        url: '',
      },
      languages: ['繁體中文'],
      related_memes: [],
      related_memes_url: '',
      related_people: [],
      cultural_region: '台灣',
      content_rating: '適合所有年齡',
      copyright: '未知',
      source_notes: '',
    },
  },
}

// 取得模板定義
export const getTemplateDefinition = (templateName) => {
  return SIDEBAR_TEMPLATES[templateName] || SIDEBAR_TEMPLATES.default
}

// 驗證側邊欄資料
export const validateSidebarData = (data, schema) => {
  try {
    // 簡單的驗證邏輯，可以根據需要擴展
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['資料必須是物件'] }
    }

    const errors = []

    // 檢查必填欄位
    if (schema.required) {
      for (const field of schema.required) {
        if (!data[field] || data[field] === '') {
          errors.push(`欄位 "${field}" 為必填`)
        }
      }
    }

    // 檢查欄位類型
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        if (data[fieldName] !== undefined) {
          // 檢查字串長度
          if (fieldSchema.type === 'string' && fieldSchema.maxLength) {
            if (data[fieldName].length > fieldSchema.maxLength) {
              errors.push(`欄位 "${fieldName}" 長度不能超過 ${fieldSchema.maxLength} 個字元`)
            }
          }

          // 檢查數字範圍
          if (fieldSchema.type === 'number') {
            if (typeof data[fieldName] !== 'number') {
              errors.push(`欄位 "${fieldName}" 必須是數字`)
            } else if (fieldSchema.minimum !== undefined && data[fieldName] < fieldSchema.minimum) {
              errors.push(`欄位 "${fieldName}" 不能小於 ${fieldSchema.minimum}`)
            }
          }

          // 檢查枚舉值
          if (fieldSchema.enum) {
            if (!fieldSchema.enum.includes(data[fieldName])) {
              errors.push(`欄位 "${fieldName}" 必須是以下值之一: ${fieldSchema.enum.join(', ')}`)
            }
          }

          // 檢查陣列
          if (fieldSchema.type === 'array' && Array.isArray(data[fieldName])) {
            if (fieldSchema.items && fieldSchema.items.enum) {
              for (const item of data[fieldName]) {
                if (!fieldSchema.items.enum.includes(item)) {
                  errors.push(
                    `陣列項目 "${item}" 必須是以下值之一: ${fieldSchema.items.enum.join(', ')}`,
                  )
                }
              }
            }
          }

          // 檢查物件
          if (fieldSchema.type === 'object' && typeof data[fieldName] === 'object') {
            if (fieldSchema.properties) {
              for (const [propName, propSchema] of Object.entries(fieldSchema.properties)) {
                if (data[fieldName][propName] !== undefined) {
                  if (propSchema.type === 'string' && propSchema.maxLength) {
                    if (data[fieldName][propName].length > propSchema.maxLength) {
                      errors.push(
                        `欄位 "${fieldName}.${propName}" 長度不能超過 ${propSchema.maxLength} 個字元`,
                      )
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`驗證過程發生錯誤: ${error.message}`],
    }
  }
}

// 渲染側邊欄 HTML
export const renderSidebar = (templateName, data) => {
  // 目前只有一個模板，直接使用基底模板
  return renderBaseTemplate(data)
}

// 渲染基底模板
const renderBaseTemplate = (data) => {
  // 生成媒體內容 HTML
  let mediaHtml = ''
  if (data.meme_type === 'image' && data.image_url) {
    mediaHtml = `
      <div class="media-content mb-3">
        <img src="${data.image_url}" alt="${data.alt_text || data.category || '迷因圖片'}" 
             class="w-full h-auto rounded-lg shadow-sm" 
             style="max-height: 200px; object-fit: cover;">
      </div>
    `
  } else if (data.meme_type === 'video' && data.video_url) {
    mediaHtml = `
      <div class="media-content mb-3">
        <video controls class="w-full h-auto rounded-lg shadow-sm" 
               style="max-height: 200px;">
          <source src="${data.video_url}" type="video/mp4">
          您的瀏覽器不支援影片播放。
        </video>
      </div>
    `
  } else if (data.meme_type === 'audio' && data.audio_url) {
    mediaHtml = `
      <div class="media-content mb-3">
        <audio controls class="w-full">
          <source src="${data.audio_url}" type="audio/mpeg">
          您的瀏覽器不支援音訊播放。
        </audio>
      </div>
    `
  }

  // 生成別名 HTML
  const aliasesHtml =
    data.aliases && Array.isArray(data.aliases) && data.aliases.length > 0
      ? `<tr><td class="label">別名</td><td>${data.aliases.join('、')}</td></tr>`
      : ''

  // 生成語言 HTML
  const languagesHtml =
    data.languages && Array.isArray(data.languages) && data.languages.length > 0
      ? `<tr><td class="label">語言</td><td>${data.languages.join('、')}</td></tr>`
      : ''

  // 生成相關迷因 HTML
  const relatedMemesHtml =
    data.related_memes && Array.isArray(data.related_memes) && data.related_memes.length > 0
      ? `<tr><td class="label">相關迷因</td><td>${data.related_memes.join('、')}</td></tr>`
      : ''

  // 生成相關人物 HTML
  const relatedPeopleHtml =
    data.related_people && Array.isArray(data.related_people) && data.related_people.length > 0
      ? `<tr><td class="label">相關人物</td><td>${data.related_people.join('、')}</td></tr>`
      : ''

  // 生成作者 HTML
  const authorHtml =
    data.origin_author && data.origin_author.name
      ? `<tr><td class="label">來源作者</td><td>${data.origin_author.name}${data.origin_author.handle ? ` (@${data.origin_author.handle})` : ''}</td></tr>`
      : ''

  return `
    <div class="sidebar-info-box">
      <div class="info-header">
        <h3>${data.category || '迷因資訊'}</h3>
      </div>
      ${mediaHtml}
      <div class="info-content">
        <table class="info-table">
          <tr><td class="label">類別</td><td>${data.category || '未知'}</td></tr>
          ${aliasesHtml}
          <tr><td class="label">首次出現日期</td><td>${data.first_appearance_date || '未知'}</td></tr>
                     <tr><td class="label">首次來源</td><td>${data.first_source || '未知'}</td></tr>
          <tr><td class="label">起源連結</td><td><a href="${data.origin_url}" target="_blank" class="text-blue-600 hover:underline">查看來源</a></td></tr>
                     ${authorHtml}
           ${languagesHtml}
           ${relatedMemesHtml}
           ${relatedPeopleHtml}
           <tr><td class="label">文化圈</td><td>${data.cultural_region || '未知'}</td></tr>
           <tr><td class="label">內容分級</td><td>${data.content_rating || '未知'}</td></tr>
           <tr><td class="label">版權</td><td>${data.copyright || '未知'}</td></tr>
           ${data.source_notes ? `<tr><td class="label">備註</td><td>${data.source_notes}</td></tr>` : ''}
        </table>
      </div>
    </div>
  `
}

// 取得所有可用模板
export const getAllTemplates = () => {
  return Object.entries(SIDEBAR_TEMPLATES).map(([key, template]) => ({
    key,
    name: template.name,
    description: template.description,
  }))
}
