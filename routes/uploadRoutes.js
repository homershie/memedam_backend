import express from 'express'
import { singleUpload } from '../middleware/upload.js'
import { uploadImage } from '../controllers/uploadController.js'

const router = express.Router()

router.post('/image', singleUpload('image'), uploadImage)

export default router
