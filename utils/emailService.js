import { sgMail, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME } from '../config/sendgrid.js'
import { logger } from './logger.js'

/**
 * Email 服務類別
 */
class EmailService {
  /**
   * 發送基本 email
   * @param {Object} options - Email 選項
   * @param {string} options.to - 收件人 email
   * @param {string} options.subject - 主旨
   * @param {string} options.text - 純文字內容
   * @param {string} options.html - HTML 內容
   * @param {string} options.from - 發件人 email (可選)
   * @returns {Promise<Object>} 發送結果
   */
  static async sendEmail(options) {
    const { to, subject, text, html, from = DEFAULT_FROM_EMAIL } = options

    const msg = {
      to,
      from: {
        email: from,
        name: DEFAULT_FROM_NAME,
      },
      subject,
      text,
      html,
    }

    try {
      const response = await sgMail.send(msg)
      logger.info(`Email sent successfully to ${to}`)
      return { success: true, response }
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error)
      throw error
    }
  }

  /**
   * 發送驗證 email
   * @param {string} to - 收件人 email
   * @param {string} verificationToken - 驗證 token
   * @param {string} username - 使用者名稱
   * @returns {Promise<Object>} 發送結果
   */
  static async sendVerificationEmail(to, verificationToken, username) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${verificationToken}`

    const subject = 'MemeDam - 請驗證您的 Email'
    const text = `
    親愛的 ${username}，

    感謝您註冊 MemeDam！請點擊以下連結來驗證您的 email：

    ${verificationUrl}

    此連結將在 24 小時後失效。

    如果您沒有註冊 MemeDam，請忽略此 email。

    祝您使用愉快！
    MemeDam 團隊
    `

    const html = `
 <!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <title>驗證你的 Email</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      /* 基本 reset 與行動端排版 */
      body { margin:0; padding:0; background:#f6f7f9; -webkit-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      .container { width:100%; background:#f6f7f9; padding:24px 0; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; }
      .logo {display:inline-block;margin-right:8px}
      .header { padding:24px 32px; font-family:Arial, Helvetica, sans-serif; background:#111827; color:#fff; }
      .brand { display:inline-block;font-size:20px; font-weight:700; letter-spacing:.3px; color:white}
      .content { padding:28px 32px; font-family:Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; }
      .button { display:inline-block; padding:12px 20px; border-radius:10px; text-decoration:none; 
                font-weight:700; background:#ff3399; color:#111827; }
      .muted { color:#6b7280; font-size:12px; }
      .divider { height:1px; background:#e5e7eb; margin:24px 0; }
      .footer { padding:18px 32px 28px; font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; }
      .code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0c0f; }
        .card { background:#111827; }
        .content, .footer { color:#d1d5db; }
        .muted { color:#9ca3af; }
        .header { background:#0b0c0f; }
        .button { background:#ff3399; color:#0b0c0f; }
        .divider { background:#1f2937; }
      }
    </style>
  </head>
  <body>
    <table class="container" role="presentation" width="100%">
      <tr><td>
        <table class="card" role="presentation" width="100%">
          <tr><td class="header">
            <div class="logo">                      
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.80988 47.7037L0.607422 39.1417V0.296326L8.80988 8.85837V47.7037Z"
                fill="white"
              />
              <path
                d="M21.6994 47.7037L13.4969 39.1417V8.85837L21.6994 0.296326V47.7037Z"
                fill="white"
              />
              <path
                d="M33.4172 39.1417L25.2147 47.7037V0.296326L33.4172 8.85837V39.1417Z"
                fill="white"
              />
              <path
                d="M47.4786 39.1417L39.2761 47.7037V8.85837L47.4786 0.296326V39.1417Z"
                fill="white"
              />
            </svg></div>
            <div class="brand">迷因典</br>MemeDam</div>
          </td></tr>
          <tr><td class="content">
            <p>嗨 ${username}，</p>
            <p>歡迎加入 <strong>迷因典 MemeDam</strong>！請點擊以下按鈕完成 Email 驗證：</p>
            <p style="text-align:center; margin:24px 0;">
              <!-- Bulletproof button -->
              <a href="${verificationUrl}" class="button" target="_blank" rel="noopener">完成驗證</a>
            </p>
            <p class="muted">若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</p>
            <p class="code" style="word-break:break-all;">
              ${verificationUrl}
            </p>
            <div class="divider"></div>
            <p class="muted">此連結將於 24 小時後失效。若非你本人操作，請忽略本信。</p>
            <p class="muted">需要協助？請聯絡：<a href="mailto:support@memedam.com" style="color:inherit;">support@memedam.com</a></p>
          </td></tr>
          <tr><td class="footer">
            <div>你會收到這封信，是因為有人以本 Email 註冊 MemeDam 帳號。</div>
            <div style="margin-top:10px;">© ${new Date().getFullYear()} MemeDam. All rights reserved.</div>
            <!-- 如果你用 SendGrid 的 Sender，行銷郵件會自動插入地址資訊；交易信可在此放公司地址 -->
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
    `

    return this.sendEmail({
      to,
      subject,
      text,
      html,
    })
  }

  /**
   * 發送密碼重設 email
   * @param {string} to - 收件人 email
   * @param {string} resetToken - 重設 token
   * @param {string} username - 使用者名稱
   * @returns {Promise<Object>} 發送結果
   */
  static async sendPasswordResetEmail(to, resetToken, username) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

    const subject = 'MemeDam - 密碼重設請求'
    const text = `
    親愛的 ${username}，

    我們收到了您的密碼重設請求。請點擊以下連結來重設您的密碼：

    ${resetUrl}

    此連結將在 1 小時後失效。

    如果您沒有請求重設密碼，請忽略此 email。

    祝您使用愉快！
    MemeDam 團隊
    `

    const html = `
   <!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <title>重設你的密碼</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      /* 基本 reset 與行動端排版 */
      body { margin:0; padding:0; background:#f6f7f9; -webkit-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      .container { width:100%; background:#f6f7f9; padding:24px 0; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; }
      .logo {display:inline-block;margin-right:8px}
      .header { padding:24px 32px; font-family:Arial, Helvetica, sans-serif; background:#111827; color:#fff; }
      .brand { display:inline-block;font-size:20px; font-weight:700; letter-spacing:.3px; color:white }
      .content { padding:28px 32px; font-family:Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; }
      .button { display:inline-block; padding:12px 20px; border-radius:10px; text-decoration:none; 
                font-weight:700; background:#ff3399; color:#111827; }
      .muted { color:#6b7280; font-size:12px; }
      .divider { height:1px; background:#e5e7eb; margin:24px 0; }
      .footer { padding:18px 32px 28px; font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; }
      .code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0c0f; }
        .card { background:#111827; }
        .content, .footer { color:#d1d5db; }
        .muted { color:#9ca3af; }
        .header { background:#0b0c0f; }
        .button { background:#ff3399; color:#0b0c0f; }
        .divider { background:#1f2937; }
      }
    </style>
  </head>
  <body>
    <table class="container" role="presentation" width="100%">
      <tr><td>
        <table class="card" role="presentation" width="100%">
          <tr><td class="header">
            <div class="logo">                      
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.80988 47.7037L0.607422 39.1417V0.296326L8.80988 8.85837V47.7037Z" fill="white"/>
                <path d="M21.6994 47.7037L13.4969 39.1417V8.85837L21.6994 0.296326V47.7037Z" fill="white"/>
                <path d="M33.4172 39.1417L25.2147 47.7037V0.296326L33.4172 8.85837V39.1417Z" fill="white"/>
                <path d="M47.4786 39.1417L39.2761 47.7037V8.85837L47.4786 0.296326V39.1417Z" fill="white"/>
              </svg>
            </div>
            <div class="brand">迷因典</br>MemeDam</div>
          </td></tr>
          <tr><td class="content">
            <p>嗨 ${username}，</p>
            <p>我們收到你在 <strong>迷因典 MemeDam</strong> 的密碼重設請求。請點擊以下按鈕，前往設定新密碼：</p>
            <p style="text-align:center; margin:24px 0;">
              <!-- Bulletproof button -->
              <a href="${resetUrl}" class="button" target="_blank" rel="noopener">重設密碼</a>
            </p>
            <p class="muted">若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</p>
            <p class="code" style="word-break:break-all;">
              ${resetUrl}
            </p>
            <div class="divider"></div>
            <p class="muted">此連結將於 24 小時後失效，並僅能使用一次。若非你本人操作，請忽略本信，你的帳號不會被更動。</p>
            <p class="muted">需要協助？請聯絡：<a href="mailto:support@memedam.com" style="color:inherit;">support@memedam.com</a></p>
          </td></tr>
          <tr><td class="footer">
            <div>你會收到這封信，是因為此 Email 觸發了 MemeDam 的密碼重設流程。</div>
            <div style="margin-top:10px;">© ${new Date().getFullYear()} MemeDam. All rights reserved.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
    `

    return this.sendEmail({
      to,
      subject,
      text,
      html,
    })
  }

  /**
   * 發送測試 email
   * @param {string} to - 收件人 email
   * @returns {Promise<Object>} 發送結果
   */
  static async sendTestEmail(to) {
    const subject = 'MemeDam - Email 測試'
    const text = `
    這是一封測試 email，用來確認 SendGrid 設定是否正確。

    如果您收到這封 email，表示 SendGrid 設定成功！

    時間：${new Date().toLocaleString('zh-TW')}
    `

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>MemeDam - Email 測試</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 MemeDam</h1>
          <p>Email 測試成功</p>
        </div>
        <div class="content">
          <div class="success">
            <h3>✅ 恭喜！</h3>
            <p>如果您收到這封 email，表示 SendGrid 設定成功！</p>
          </div>
          <p><strong>測試時間：</strong> ${new Date().toLocaleString('zh-TW')}</p>
          <p>現在您可以開始使用 MemeDam 的 email 功能了！</p>
        </div>
        <div class="footer">
          <p>© 2024 MemeDam. 保留所有權利。</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to,
      subject,
      text,
      html,
    })
  }
}

export default EmailService
