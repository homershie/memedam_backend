import cron from 'node-cron'
import User from '../models/User.js'
import { logger } from './logger.js'
import EmailService from './emailService.js'

/**
 * 獲取需要發送提醒的用戶（註冊超過11個月但未驗證的用戶）
 */
const getUsersNeedingReminder = async () => {
  try {
    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)

    const users = await User.find({
      email_verified: false,
      createdAt: { $lte: elevenMonthsAgo },
      status: { $ne: 'deleted' },
    }).select('_id username email createdAt')

    logger.info(`找到 ${users.length} 個需要發送提醒的用戶`)
    return users
  } catch (error) {
    logger.error('獲取需要提醒的用戶失敗:', error)
    return []
  }
}

/**
 * 獲取需要刪除的用戶（註冊超過一年但未驗證的用戶）
 */
const getUsersToDelete = async () => {
  try {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const users = await User.find({
      email_verified: false,
      createdAt: { $lte: oneYearAgo },
      status: { $ne: 'deleted' },
    }).select('_id username email createdAt')

    logger.info(`找到 ${users.length} 個需要刪除的用戶`)
    return users
  } catch (error) {
    logger.error('獲取需要刪除的用戶失敗:', error)
    return []
  }
}

/**
 * 發送帳號刪除提醒 email
 */
const sendDeletionReminderEmail = async (user) => {
  try {
    const subject = 'MemeDam - 重要提醒：您的帳號即將被刪除'
    const text = `
親愛的 ${user.username}，

我們注意到您的 MemeDam 帳號已經註冊超過 11 個月，但尚未驗證您的 email 地址。

根據我們的服務條款，未驗證的帳號將在註冊滿一年後自動刪除。

您的帳號將在 ${new Date(user.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-TW')} 被刪除。

請立即點擊以下連結驗證您的 email，以保留您的帳號：

${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')}/verify

如果您需要重新發送驗證 email，請登入您的帳號並在設定中重新發送。

如果您有任何問題，請聯繫我們的客服團隊。

謝謝！
MemeDam 團隊
    `

    const html = `
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <title>帳號刪除提醒</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      /* 基本 reset 與行動端排版 */
      body { margin:0; padding:0; background:#f6f7f9; -webkit-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      .container { width:100%; background:#f6f7f9; padding:24px 0; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; }
      .header { padding:24px 32px; font-family:Arial, Helvetica, sans-serif; background:#111827; color:#fff; }
      .brand { font-size:20px; font-weight:700; letter-spacing:.3px; color:white}
      .content { padding:28px 32px; font-family:Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; }
      .button { display:inline-block; padding:12px 20px; border-radius:10px; text-decoration:none; 
                font-weight:700; background:#ff3399; color:white; }
      .muted { color:#6b7280; font-size:12px; }
      .divider { height:1px; background:#e5e7eb; margin:24px 0; }
      .warning { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin:16px 0; }
      .footer { padding:18px 32px 28px; font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; }
      .code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0c0f; }
        .card { background:#111827; }
        .content, .footer { color:#d1d5db; }
        .muted { color:#9ca3af; }
        .header { background:#0b0c0f; }
        .button { background:#ff3399; color:white; }
        .divider { background:#1f2937; }
        .warning { background:#1f2937; border-color:#374151; }
      }
    </style>
  </head>
  <body>
    <table class="container" role="presentation" width="100%">
      <tr><td>
        <table class="card" role="presentation" width="100%">
          <tr><td class="header">
            <div class="brand">迷因典<br>MemeDam</div>
          </td></tr>
          <tr><td class="content">
            <p>嗨 ${user.username}，</p>
            <p>我們注意到您的 <strong>迷因典 MemeDam</strong> 帳號已經註冊超過 11 個月，但尚未驗證您的 email 地址。</p>
            
            <div class="warning">
              <strong>⚠️ 重要提醒：</strong><br>
              根據我們的服務條款，未驗證的帳號將在註冊滿一年後自動刪除。
            </div>
            
            <p>您的帳號將在 <strong>${new Date(user.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-TW')}</strong> 被刪除。</p>
            
            <p>請立即點擊以下按鈕驗證您的 email，以保留您的帳號：</p>
            
            <p style="text-align:center; margin:24px 0;">
              <!-- Bulletproof button -->
              <a href="${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')}/verify" class="button" target="_blank" rel="noopener">立即驗證 Email</a>
            </p>
            
            <p class="muted">若按鈕無法點擊，請複製下方連結到瀏覽器開啟：</p>
            <p class="code" style="word-break:break-all;">
              ${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')}/verify
            </p>
            
            <div class="divider"></div>
            <p class="muted">如果您需要重新發送驗證 email，請登入您的帳號並在設定中重新發送。</p>
            <p class="muted">需要協助？請聯絡：<a href="mailto:support@memedam.com" style="color:inherit;">support@memedam.com</a></p>
          </td></tr>
          <tr><td class="footer">
            <div>此 email 由系統自動發送，請勿回覆。如果您沒有註冊 MemeDam，請忽略此 email。</div>
            <div style="margin-top:10px;">© ${new Date().getFullYear()} MemeDam. All rights reserved.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`

    await EmailService.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    })

    logger.info(`已發送刪除提醒 email 給用戶 ${user.username} (${user.email})`)
    return true
  } catch (error) {
    logger.error(`發送刪除提醒 email 失敗 (${user.email}):`, error)
    return false
  }
}

/**
 * 發送帳號刪除通知 email
 */
const sendDeletionNotificationEmail = async (user) => {
  try {
    const subject = 'MemeDam - 您的帳號已被刪除'
    const text = `
親愛的 ${user.username}，

很遺憾地通知您，由於您的 MemeDam 帳號在註冊一年後仍未驗證 email 地址，我們已經按照服務條款刪除了您的帳號。

您的帳號資料已經從我們的系統中永久移除。

如果您希望重新使用 MemeDam，請重新註冊並確保驗證您的 email 地址。

謝謝您曾經使用 MemeDam！

MemeDam 團隊
    `

    const html = `
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <title>帳號已刪除</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      /* 基本 reset 與行動端排版 */
      body { margin:0; padding:0; background:#f6f7f9; -webkit-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      .container { width:100%; background:#f6f7f9; padding:24px 0; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; }
      .header { padding:24px 32px; font-family:Arial, Helvetica, sans-serif; background:#111827; color:#fff; }
      .brand { font-size:20px; font-weight:700; letter-spacing:.3px; color:white }
      .content { padding:28px 32px; font-family:Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; }
      .muted { color:#6b7280; font-size:12px; }
      .divider { height:1px; background:#e5e7eb; margin:24px 0; }
      .footer { padding:18px 32px 28px; font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; }
      .info { background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:16px; margin:16px 0; }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0c0f; }
        .card { background:#111827; }
        .content, .footer { color:#d1d5db; }
        .muted { color:#9ca3af; }
        .header { background:#111827; }
        .divider { background:#1f2937; }
        .info { background:#1f2937; border-color:#374151; }
      }
    </style>
  </head>
  <body>
    <table class="container" role="presentation" width="100%">
      <tr><td>
        <table class="card" role="presentation" width="100%">
          <tr><td class="header">
            <div class="brand">迷因典<br>MemeDam</div>
          </td></tr>
          <tr><td class="content">
            <p>嗨 ${user.username}，</p>
            <p>很遺憾地通知您，由於您的 <strong>迷因典 MemeDam</strong> 帳號在註冊一年後仍未驗證 email 地址，我們已經按照服務條款刪除了您的帳號。</p>
            
            <div class="info">
              <strong>📋 刪除詳情：</strong><br>
              • 刪除時間：${new Date().toLocaleDateString('zh-TW')}<br>
              • 刪除原因：未驗證 email 地址<br>
              • 註冊時間：${user.createdAt.toLocaleDateString('zh-TW')}
            </div>
            
            <p>您的帳號資料已經從我們的系統中永久移除。</p>
            
            <p>如果您希望重新使用 MemeDam，請重新註冊並確保驗證您的 email 地址。</p>
            
            <div class="divider"></div>
            <p class="muted">謝謝您曾經使用 MemeDam！</p>
            <p class="muted">需要協助？請聯絡：<a href="mailto:support@memedam.com" style="color:inherit;">support@memedam.com</a></p>
          </td></tr>
          <tr><td class="footer">
            <div>此 email 由系統自動發送，請勿回覆。如果您沒有註冊 MemeDam，請忽略此 email。</div>
            <div style="margin-top:10px;">© ${new Date().getFullYear()} MemeDam. All rights reserved.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
    `

    await EmailService.sendEmail({
      to: user.email,
      subject,
      text,
      html,
    })

    logger.info(`已發送刪除通知 email 給用戶 ${user.username} (${user.email})`)
    return true
  } catch (error) {
    logger.error(`發送刪除通知 email 失敗 (${user.email}):`, error)
    return false
  }
}

/**
 * 刪除用戶帳號
 */
const deleteUserAccount = async (user) => {
  try {
    // 先發送刪除通知 email
    await sendDeletionNotificationEmail(user)

    // 標記用戶為已刪除狀態（軟刪除）
    await User.findByIdAndUpdate(user._id, {
      status: 'deleted',
      deactivate_at: new Date(),
    })

    logger.info(`已刪除用戶帳號 ${user.username} (${user.email})`)
    return true
  } catch (error) {
    logger.error(`刪除用戶帳號失敗 (${user.email}):`, error)
    return false
  }
}

/**
 * 發送刪除提醒任務
 */
const sendDeletionReminders = async () => {
  try {
    logger.info('開始執行刪除提醒任務...')

    const users = await getUsersNeedingReminder()
    let successCount = 0
    let failCount = 0

    for (const user of users) {
      try {
        const success = await sendDeletionReminderEmail(user)
        if (success) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        logger.error(`處理用戶 ${user.email} 提醒失敗:`, error)
        failCount++
      }
    }

    logger.info(`刪除提醒任務完成：成功 ${successCount} 個，失敗 ${failCount} 個`)
  } catch (error) {
    logger.error('刪除提醒任務執行失敗:', error)
  }
}

/**
 * 刪除未驗證用戶任務
 */
const deleteUnverifiedUsers = async () => {
  try {
    logger.info('開始執行刪除未驗證用戶任務...')

    const users = await getUsersToDelete()
    let successCount = 0
    let failCount = 0

    for (const user of users) {
      try {
        const success = await deleteUserAccount(user)
        if (success) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        logger.error(`刪除用戶 ${user.email} 失敗:`, error)
        failCount++
      }
    }

    logger.info(`刪除未驗證用戶任務完成：成功 ${successCount} 個，失敗 ${failCount} 個`)
  } catch (error) {
    logger.error('刪除未驗證用戶任務執行失敗:', error)
  }
}

/**
 * 啟動用戶清理排程器
 */
export const startUserCleanupScheduler = () => {
  try {
    // 每天凌晨 2 點執行刪除提醒任務
    cron.schedule('0 2 * * *', sendDeletionReminders, {
      scheduled: true,
      timezone: 'Asia/Taipei',
    })

    // 每天凌晨 3 點執行刪除未驗證用戶任務
    cron.schedule('0 3 * * *', deleteUnverifiedUsers, {
      scheduled: true,
      timezone: 'Asia/Taipei',
    })

    logger.info('用戶清理排程器已啟動')
  } catch (error) {
    logger.error('啟動用戶清理排程器失敗:', error)
  }
}

/**
 * 停止用戶清理排程器
 */
export const stopUserCleanupScheduler = () => {
  try {
    cron.getTasks().forEach((task) => {
      if (
        task.name.includes('sendDeletionReminders') ||
        task.name.includes('deleteUnverifiedUsers')
      ) {
        task.stop()
      }
    })
    logger.info('用戶清理排程器已停止')
  } catch (error) {
    logger.error('停止用戶清理排程器失敗:', error)
  }
}

/**
 * 手動執行刪除提醒任務（用於測試）
 */
export const manualSendDeletionReminders = async () => {
  await sendDeletionReminders()
}

/**
 * 手動執行刪除未驗證用戶任務（用於測試）
 */
export const manualDeleteUnverifiedUsers = async () => {
  await deleteUnverifiedUsers()
}

// 導出內部函數供測試使用
export { getUsersNeedingReminder, getUsersToDelete }
