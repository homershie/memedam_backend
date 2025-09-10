import mongoose from 'mongoose'
import SponsorshipProducts from '../../models/SponsorshipProducts.js'
import { loadEnv } from '../../config/loadEnv.js'
import { connectDB } from '../../config/db.js'

// 初始化商品數據
const initialProducts = [
  {
    direct_link_code: 'c4043b71a4',
    name: '豆漿贊助',
    amount: 30,
    currency: 'USD',
    sponsor_level: 'soy',
    badge_earned: false,
    is_active: true,
    description: '基礎贊助等級，提供網站運營支持',
    category: 'sponsorship',
    sort_order: 1,
    display_name: '豆漿支持者',
    meta_title: '豆漿贊助 - 支持 MemeDam',
    meta_description: '以豆漿等級贊助 MemeDam，支持我們的內容創作和網站運營',
  },
  {
    direct_link_code: 'b7e4575bf6',
    name: '雞肉贊助',
    amount: 60,
    currency: 'USD',
    sponsor_level: 'chicken',
    badge_earned: false,
    is_active: true,
    description: '中級贊助等級，提供更多網站功能支持',
    category: 'sponsorship',
    sort_order: 2,
    display_name: '雞肉支持者',
    meta_title: '雞肉贊助 - 支持 MemeDam',
    meta_description: '以雞肉等級贊助 MemeDam，獲得更多支持和感謝',
  },
  {
    direct_link_code: '25678099a7',
    name: '咖啡贊助',
    amount: 150,
    currency: 'USD',
    sponsor_level: 'coffee',
    badge_earned: true,
    is_active: true,
    description: '高級贊助等級，獲得專屬徽章和特別感謝',
    category: 'sponsorship',
    sort_order: 3,
    display_name: '咖啡支持者',
    meta_title: '咖啡贊助 - 支持 MemeDam',
    meta_description: '以咖啡等級贊助 MemeDam，獲得專屬徽章和永久感謝',
  },
  {
    direct_link_code: '1a2b3c4d5e',
    name: 'Blue',
    amount: 150,
    currency: 'USD',
    sponsor_level: 'coffee',
    badge_earned: true,
    is_active: true,
    description: '高級贊助等級（Blue 變體），測試用',
    category: 'sponsorship',
    sort_order: 4,
    display_name: '咖啡支持者 Blue',
    meta_title: '咖啡贊助 Blue - 支持 MemeDam',
    meta_description: '以咖啡等級（Blue）贊助 MemeDam，測試用商品',
  },
  {
    direct_link_code: 'a1b2c3d4e5',
    name: 'Large',
    amount: 150,
    currency: 'USD',
    sponsor_level: 'coffee',
    badge_earned: true,
    is_active: true,
    description: '高級贊助等級（Large 變體），測試用',
    category: 'sponsorship',
    sort_order: 5,
    display_name: '咖啡支持者 Large',
    meta_title: '咖啡贊助 Large - 支持 MemeDam',
    meta_description: '以咖啡等級（Large）贊助 MemeDam，測試用商品',
  },
]

async function initializeSponsorshipProducts() {
  try {
    console.log('🔄 載入環境變數...')
    loadEnv()

    console.log('🔄 連接到資料庫...')
    await connectDB()

    console.log('🔄 初始化贊助商品數據...')

    for (const productData of initialProducts) {
      const existingProduct = await SponsorshipProducts.findOne({
        direct_link_code: productData.direct_link_code,
      })

      if (existingProduct) {
        console.log(`⚠️  商品 ${productData.name} 已存在，跳過...`)
        continue
      }

      const newProduct = new SponsorshipProducts(productData)
      await newProduct.save()

      console.log(`✅ 已創建商品: ${productData.name} (${productData.direct_link_code})`)
    }

    console.log('✅ 贊助商品數據初始化完成！')

    // 顯示初始化結果
    const totalProducts = await SponsorshipProducts.countDocuments()
    const activeProducts = await SponsorshipProducts.countDocuments({ is_active: true })

    console.log(`📊 總商品數量: ${totalProducts}`)
    console.log(`📊 活躍商品數量: ${activeProducts}`)

    // 顯示所有商品
    const products = await SponsorshipProducts.find({}).sort({ sort_order: 1 })
    console.log('\n📋 商品列表:')
    products.forEach((product) => {
      console.log(
        `  - ${product.name} (${product.direct_link_code}): $${product.amount} ${product.currency} - 等級: ${product.sponsor_level}${product.badge_earned ? ' 🏆' : ''}`,
      )
    })
  } catch (error) {
    console.error('❌ 初始化失敗:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 資料庫連接已關閉')
  }
}

// 如果直接運行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSponsorshipProducts()
}

export default initializeSponsorshipProducts
