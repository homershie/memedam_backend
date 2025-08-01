import express from 'express'

const router = express.Router()

router.get('/test', (req, res) => {
  res.json({ message: 'Test route works' })
})

router.get('/categories', (req, res) => {
  res.json({
    message: 'Categories route works',
    categories: {
      memeTypes: [
        { _id: 'text', name: '用語', count: 0 },
        { _id: 'image', name: '圖片', count: 0 },
        { _id: 'video', name: '影片', count: 0 },
        { _id: 'audio', name: '音訊', count: 0 },
      ],
      popularTags: [],
      allTags: [],
    },
  })
})

export default router
