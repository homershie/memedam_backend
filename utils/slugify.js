/**
 * Slug 生成工具
 * 將文字轉換為 URL 友好的 slug 格式
 */

/**
 * 將文字轉換為 slug
 * @param {string} text - 要轉換的文字
 * @returns {string} slug 格式的字串
 */
export function toSlug(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  return text
    .toString()
    .toLowerCase()
    .trim()
    // 移除特殊字符，只保留字母、數字、空格和連字符
    .replace(/[^a-z0-9\s-]/g, '')
    // 將多個空格或連字符替換為單一連字符
    .replace(/[\s-]+/g, '-')
    // 移除開頭和結尾的連字符
    .replace(/^-+|-+$/g, '')
}

/**
 * 將文字轉換為 slug，如果結果為空則返回 null
 * @param {string} text - 要轉換的文字
 * @returns {string|null} slug 格式的字串或 null
 */
export function toSlugOrNull(text) {
  const slug = toSlug(text)
  return slug || null
}

export default { toSlug, toSlugOrNull }
