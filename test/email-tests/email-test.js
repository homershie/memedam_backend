import EmailService from '../../utils/emailService.js'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config()

/**
 * Email 測試函數
 */
async function testEmailService() {
  console.log('🚀 開始測試 Email 服務...\n')

  // 檢查環境變數
  console.log('📋 檢查環境變數:')
  console.log(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ 已設定' : '❌ 未設定'}`)
  console.log(`SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL ? '✅ 已設定' : '❌ 未設定'}`)
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL ? '✅ 已設定' : '❌ 未設定'}`)
  console.log('')

  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ 錯誤: SENDGRID_API_KEY 未設定')
    console.log('請在 .env 檔案中設定 SENDGRID_API_KEY')
    return
  }

  // 測試 email 地址 (請替換為您的 email)
  const testEmail = process.env.TEST_EMAIL || 'your-email@example.com'

  if (testEmail === 'your-email@example.com') {
    console.log('⚠️  請設定 TEST_EMAIL 環境變數或修改此檔案中的 testEmail 變數')
    console.log('例如: TEST_EMAIL=your-email@gmail.com')
    console.log('')
  }

  try {
    console.log('📧 發送測試 email...')
    console.log(`收件人: ${testEmail}`)

    const result = await EmailService.sendTestEmail(testEmail)

    console.log('✅ 測試 email 發送成功!')
    console.log('結果:', result)
    console.log('')

    // 測試驗證 email
    console.log('📧 測試驗證 email 模板...')
    const verificationResult = await EmailService.sendVerificationEmail(
      testEmail,
      'test-verification-token-123',
      '測試使用者',
    )

    console.log('✅ 驗證 email 發送成功!')
    console.log('結果:', verificationResult)
    console.log('')

    // 測試密碼重設 email
    console.log('📧 測試密碼重設 email 模板...')
    const resetResult = await EmailService.sendPasswordResetEmail(
      testEmail,
      'test-reset-token-456',
      '測試使用者',
    )

    console.log('✅ 密碼重設 email 發送成功!')
    console.log('結果:', resetResult)
    console.log('')

    console.log('🎉 所有 email 測試完成!')
    console.log('請檢查您的 email 收件匣確認是否收到測試信件。')
  } catch (error) {
    console.error('❌ Email 測試失敗:')
    console.error('錯誤訊息:', error.message)

    if (error.response) {
      console.error('SendGrid 錯誤詳情:')
      console.error(JSON.stringify(error.response.body, null, 2))
    }
  }
}

/**
 * 簡單的 SendGrid 測試 (使用您提供的程式碼)
 */
async function testSendGridBasic() {
  console.log('🧪 執行基本 SendGrid 測試...\n')

  try {
    const sgMail = (await import('@sendgrid/mail')).default
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    const msg = {
      to: process.env.TEST_EMAIL || 'test@example.com',
      from: process.env.SENDGRID_FROM_EMAIL || 'test@example.com',
      subject: 'Sending with SendGrid is Fun',
      text: 'and easy to do anywhere, even with Node.js',
      html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    }

    await sgMail.send(msg)
    console.log('✅ 基本 SendGrid 測試成功!')
    console.log('Email sent')
  } catch (error) {
    console.error('❌ 基本 SendGrid 測試失敗:')
    console.error(error)
  }
}

// 執行測試
async function runTests() {
  console.log('='.repeat(50))
  console.log('📧 MemeDam Email 服務測試')
  console.log('='.repeat(50))
  console.log('')

  // 先執行基本測試
  await testSendGridBasic()
  console.log('')

  // 再執行完整測試
  await testEmailService()
}

// 如果直接執行此檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error)
}

export { testEmailService, testSendGridBasic, runTests }
