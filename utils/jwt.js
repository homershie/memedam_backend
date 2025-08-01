import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// 產生 JWT
export function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
    ...(options || {}),
  })
}

// 驗證 JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// 解碼 JWT（不驗證）
export function decodeToken(token) {
  return jwt.decode(token)
}

// 刷新 JWT（回傳新 token）
export function refreshToken(oldToken) {
  const payload = decodeToken(oldToken)
  if (!payload || !payload._id) return null
  // 移除 iat, exp 等舊欄位
  // eslint-disable-next-line no-unused-vars
  const { iat: _, exp: __, nbf: ___, jti: ____, ...rest } = payload
  return signToken(rest)
}
