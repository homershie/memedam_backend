import crypto from 'crypto'

/**
 * 生成 PKCE code_verifier
 * @returns {string} code_verifier
 */
export const generateCodeVerifier = () => {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * 生成 PKCE code_challenge
 * @param {string} codeVerifier - code_verifier
 * @returns {string} code_challenge
 */
export const generateCodeChallenge = (codeVerifier) => {
  const hash = crypto.createHash('sha256')
  hash.update(codeVerifier)
  return hash.digest('base64url')
}

/**
 * 生成完整的 PKCE 參數
 * @returns {object} 包含 code_verifier 和 code_challenge 的物件
 */
export const generatePKCE = () => {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  return {
    code_verifier: codeVerifier,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }
}
