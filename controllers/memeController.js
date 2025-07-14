import Product from '../models/productModel.js'
import { StatusCodes } from 'http-status-codes'
import validator from 'validator'
import { deleteCloudinaryImage } from '../utils/deleteImgUtils.js'

export const create = async (req, res) => {
  try {
    const product = await Product.create({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      category: req.body.category,
      sell: req.body.sell,
      // 使用上傳的檔案 Cloudinary 網址
      image: req.file?.path,
    })
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '商品建立成功',
      product,
    })
  } catch (error) {
    console.log('controllers/product.js create')
    console.error(error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const getAll = async (req, res) => {
  try {
    const products = await Product.find()
    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品列表取得成功',
      products,
    })
  } catch (error) {
    console.log('controllers/product.js getAll')
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

export const get = async (req, res) => {
  try {
    const products = await Product.find({ sell: true })
    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品列表取得成功',
      products,
    })
  } catch (error) {
    console.log('controllers/product.js getAll')
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

export const update = async (req, res) => {
  try {
    // 檢查商品 ID 格式
    if (!validator.isMongoId(req.params.id)) {
      throw new Error('Product ID format error')
    }
    // 先查詢舊商品資料
    const oldProduct = await Product.findById(req.params.id)
    if (!oldProduct) {
      throw new Error('Product not found')
    }
    // 處理圖片更新
    if (req.file) {
      try {
        await deleteCloudinaryImage(oldProduct.image)
        console.log('刪除舊圖片成功')
      } catch (error) {
        console.error('刪除舊圖片失敗:', error)
        // 可選擇繼續執行或回傳錯誤
      }
      req.body.image = req.file.path
    }

    // 更新商品
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        // 更新不一定要傳圖片，沒有傳圖片就是用舊的
        // 如果沒有傳圖片，就不會有 req.file，就會是 undefined，不會更新
        // 如果有傳圖片，就會用新的圖片路徑
        image: req.file?.path,
      },
      {
        new: true,
        runValidators: true,
      },
    ).orFail(new Error('Product not found'))
    // 返回更新後的商品
    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品修改成功',
      product,
    })
  } catch (error) {
    console.log('controllers/product.js update')
    console.error(error)
    if (error.message === 'Product ID format error') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '商品 ID 格式錯誤',
      })
    } else if (error.message === 'Product not found') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '商品不存在',
      })
    } else if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const getId = async (req, res) => {
  try {
    // 檢查商品 ID 格式
    if (!validator.isMongoId(req.params.id)) {
      throw new Error('Product ID format error')
    }
    // 取得商品
    const product = await Product.findById(req.params.id).orFail(new Error('Product not found'))
    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品取得成功',
      product,
    })
  } catch (error) {
    console.log('controllers/product.js getId')
    console.error(error)
    if (error.message === 'Product ID format error') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    } else if (error.message === 'Product not found') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '商品不存在',
      })
    } else {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}
