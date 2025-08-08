import dotenv from 'dotenv'
import sgMail from '@sendgrid/mail'

// 載入環境變數
dotenv.config()

console.log('🧪 簡單 SendGrid 測試')
console.log('='.repeat(40))

// 檢查環境變數
console.log('📋 環境變數檢查:')
console.log(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ 已設定' : '❌ 未設定'}`)
console.log(`SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL || '❌ 未設定'}`)
console.log(`TEST_EMAIL: ${process.env.TEST_EMAIL || '❌ 未設定'}`)
console.log('')

if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ 錯誤: SENDGRID_API_KEY 未設定')
  console.log('請在 .env 檔案中設定 SENDGRID_API_KEY')
  process.exit(1)
}

if (!process.env.TEST_EMAIL) {
  console.error('❌ 錯誤: TEST_EMAIL 未設定')
  console.log('請在 .env 檔案中設定 TEST_EMAIL')
  console.log('例如: TEST_EMAIL=your-email@gmail.com')
  process.exit(1)
}

// 設定 SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// 測試 email 內容
const msg = {
  to: process.env.TEST_EMAIL,
  from: process.env.SENDGRID_FROM_EMAIL || 'test@example.com',
  subject: 'MemeDam - SendGrid 測試',
  text: `
    這是一封測試 email，用來確認 SendGrid 設定是否正確。
    
    如果您收到這封 email，表示 SendGrid 設定成功！
    
    測試時間: ${new Date().toLocaleString('zh-TW')}
    
    祝您使用愉快！
    MemeDam 團隊
  `,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>MemeDam - SendGrid 測試</title>
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
          <p>SendGrid 測試成功</p>
        </div>
        <div class="content">
          <div class="success">
            <h3>✅ 恭喜！</h3>
            <p>如果您收到這封 email，表示 SendGrid 設定成功！</p>
          </div>
          <p><strong>測試時間：</strong> ${new Date().toLocaleString('zh-TW')}</p>
          <p>現在您可以開始使用 MemeDam 的 email 功能了！</p>
          <p>下一步：</p>
          <ul>
            <li>整合到註冊流程</li>
            <li>實作密碼重設功能</li>
            <li>加入 email 驗證狀態追蹤</li>
          </ul>
        </div>
        <div class="footer">
          <p>© 2024 MemeDam. 保留所有權利。</p>
        </div>
      </div>
    </body>
    </html>
  `,
}

console.log('📧 發送測試 email...')
console.log(`收件人: ${process.env.TEST_EMAIL}`)
console.log(`發件人: ${process.env.SENDGRID_FROM_EMAIL || 'test@example.com'}`)
console.log('')

// 發送 email
sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Email 發送成功！')
    console.log('請檢查您的 email 收件匣確認是否收到測試信件。')
    console.log('')
    console.log('🎉 SendGrid 設定完成！')
    console.log('現在您可以開始使用 MemeDam 的 email 功能了。')
  })
  .catch((error) => {
    console.error('❌ Email 發送失敗:')
    console.error('錯誤訊息:', error.message)

    if (error.response) {
      console.error('SendGrid 錯誤詳情:')
      console.error(JSON.stringify(error.response.body, null, 2))
    }

    console.log('')
    console.log('🔧 除錯建議:')
    console.log('1. 檢查 SENDGRID_API_KEY 是否正確')
    console.log('2. 確認發送者 email 是否已驗證')
    console.log('3. 檢查 SendGrid 帳戶狀態')
    console.log('4. 確認 API Key 權限設定')
  })
