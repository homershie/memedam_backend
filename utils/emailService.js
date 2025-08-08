import { sgMail, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME } from '../config/sendgrid.js'
import logger from './logger.js'

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
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`

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
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>MemeDam - Email 驗證</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎭 MemeDam</h1>
          <p>Email 驗證</p>
        </div>
        <div class="content">
          <h2>親愛的 ${username}，</h2>
          <p>感謝您註冊 MemeDam！我們很高興您加入我們的迷因社群。</p>
          <p>請點擊下面的按鈕來驗證您的 email 地址：</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">驗證 Email</a>
          </div>
          <p><strong>注意：</strong>此連結將在 24 小時後失效。</p>
          <p>如果您沒有註冊 MemeDam，請忽略此 email。</p>
          <p>祝您使用愉快！<br>MemeDam 團隊</p>
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
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>MemeDam - 密碼重設</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 MemeDam</h1>
          <p>密碼重設</p>
        </div>
        <div class="content">
          <h2>親愛的 ${username}，</h2>
          <p>我們收到了您的密碼重設請求。</p>
          <p>請點擊下面的按鈕來重設您的密碼：</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">重設密碼</a>
          </div>
          <div class="warning">
            <p><strong>⚠️ 注意：</strong></p>
            <ul>
              <li>此連結將在 1 小時後失效</li>
              <li>如果您沒有請求重設密碼，請忽略此 email</li>
              <li>為了您的帳戶安全，請不要將此連結分享給他人</li>
            </ul>
          </div>
          <p>祝您使用愉快！<br>MemeDam 團隊</p>
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
