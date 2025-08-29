<template>
  <div class="meme-remote-select">
    <div class="field">
      <label class="block font-semibold mb-2">
        選擇原始迷因 <span class="text-primary-500">*</span>
      </label>
      
      <AutoComplete
        v-model="selectedMeme"
        :suggestions="memeSuggestions"
        @complete="searchMemes"
        @item-select="onMemeSelect"
        :dropdown-mode="dropdownMode"
        placeholder="搜尋迷因標題..."
        class="w-full"
        fluid
        :min-length="2"
      >
        <template #option="slotProps">
          <div class="flex items-center gap-3">
            <!-- 縮圖 -->
            <div class="w-16 h-16 flex-shrink-0">
              <img
                v-if="slotProps.option.image_url"
                :src="getThumbnail(slotProps.option.image_url)"
                :alt="slotProps.option.title"
                class="w-full h-full object-cover rounded"
                @error="handleImageError"
              />
              <div
                v-else
                class="w-full h-full bg-surface-200 dark:bg-surface-700 rounded flex items-center justify-center"
              >
                <i class="pi pi-image text-surface-400"></i>
              </div>
            </div>
            
            <!-- 資訊 -->
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ slotProps.option.title }}</div>
              <div class="text-sm text-surface-500">
                作者：{{ slotProps.option.author_id?.display_name || slotProps.option.author_id?.username || '未知' }}
              </div>
              <div class="text-xs text-surface-400">
                <i class="pi pi-eye mr-1"></i>{{ slotProps.option.view_count || 0 }}
                <i class="pi pi-thumbs-up ml-2 mr-1"></i>{{ slotProps.option.like_count || 0 }}
              </div>
            </div>
          </div>
        </template>
      </AutoComplete>
      
      <small v-if="error" class="text-primary-500">{{ error }}</small>
      <small v-else-if="modelValue" class="text-surface-500">
        <i class="pi pi-info-circle mr-1"></i>
        後端會自動計算變體系譜（lineage）
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'

const props = defineProps({
  modelValue: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

// 狀態
const selectedMeme = ref('')
const memeSuggestions = ref([])
const dropdownMode = ref('blank')
const error = ref('')

// 搜尋迷因
const searchMemes = async (event) => {
  const query = event.query
  if (query.length < 2) {
    memeSuggestions.value = []
    return
  }

  try {
    const response = await fetch(`/api/memes/search?q=${encodeURIComponent(query)}&limit=10`)
    const data = await response.json()
    
    if (data.success) {
      memeSuggestions.value = data.data || []
    } else {
      memeSuggestions.value = []
    }
  } catch (error) {
    console.error('搜尋迷因失敗:', error)
    memeSuggestions.value = []
  }
}

// 選擇迷因
const onMemeSelect = (event) => {
  const meme = event.value
  if (meme && meme._id) {
    emit('update:modelValue', meme._id)
    selectedMeme.value = meme.title
    error.value = ''
  }
}

// 獲取縮圖 URL（使用 Cloudinary 轉換）
const getThumbnail = (imageUrl) => {
  if (!imageUrl) return ''
  
  // 如果是 Cloudinary URL，添加轉換參數
  if (imageUrl.includes('cloudinary.com')) {
    // 在 /upload/ 後插入轉換參數
    return imageUrl.replace('/upload/', '/upload/w_64,h_64,c_fill,f_auto,q_auto/')
  }
  
  return imageUrl
}

// 處理圖片載入錯誤
const handleImageError = (event) => {
  event.target.style.display = 'none'
  event.target.parentElement.innerHTML = '<i class="pi pi-image text-surface-400"></i>'
}

// 驗證方法
const validate = () => {
  if (!props.modelValue) {
    error.value = '請選擇原始迷因'
    return false
  }
  error.value = ''
  return true
}

// 清空選擇
const clear = () => {
  selectedMeme.value = ''
  emit('update:modelValue', null)
  error.value = ''
}

// 暴露方法給父組件
defineExpose({
  validate,
  clear
})
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}
</style>