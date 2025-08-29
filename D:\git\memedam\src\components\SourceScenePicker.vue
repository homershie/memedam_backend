<template>
  <div class="source-scene-picker">
    <!-- Source 選擇區 -->
    <div class="field">
      <label class="block font-semibold mb-2">
        選擇來源作品 <span class="text-primary-500">*</span>
      </label>
      
      <div class="flex gap-2">
        <AutoComplete
          v-model="selectedSource"
          :suggestions="sourceSuggestions"
          @complete="searchSources"
          @item-select="onSourceSelect"
          :dropdown-mode="dropdownMode"
          placeholder="搜尋來源作品（輸入至少2個字）..."
          class="flex-1"
          fluid
          :min-length="2"
        >
          <template #option="slotProps">
            <div class="flex flex-col">
              <div class="font-medium">{{ slotProps.option.title }}</div>
              <div class="text-sm text-surface-500">
                <span v-if="slotProps.option.year">{{ slotProps.option.year }}年</span>
                <span v-if="slotProps.option.type" class="ml-2">
                  {{ getTypeLabel(slotProps.option.type) }}
                </span>
              </div>
            </div>
          </template>
        </AutoComplete>
        
        <Button
          type="button"
          icon="pi pi-plus"
          label="新增來源"
          @click="showCreateSourceDialog = true"
          severity="secondary"
        />
      </div>
      
      <small v-if="sourceError" class="text-primary-500">{{ sourceError }}</small>
    </div>

    <!-- Scene 選擇區（僅在選擇了 Source 後顯示） -->
    <div v-if="source_id" class="field">
      <label class="block font-semibold mb-2">
        選擇片段（選填）
      </label>
      
      <div class="flex gap-2">
        <AutoComplete
          v-model="selectedScene"
          :suggestions="sceneSuggestions"
          @complete="searchScenes"
          @item-select="onSceneSelect"
          :dropdown-mode="dropdownMode"
          placeholder="搜尋片段..."
          class="flex-1"
          fluid
        >
          <template #option="slotProps">
            <div class="flex flex-col">
              <div v-if="slotProps.option.title" class="font-medium">
                {{ slotProps.option.title }}
              </div>
              <div class="text-sm text-surface-500">
                <span v-if="slotProps.option.quote">「{{ slotProps.option.quote }}」</span>
                <span v-else-if="slotProps.option.start_time">
                  {{ formatTime(slotProps.option.start_time) }}
                </span>
              </div>
            </div>
          </template>
        </AutoComplete>
        
        <Button
          type="button"
          icon="pi pi-plus"
          label="新增片段"
          @click="showCreateSceneDialog = true"
          severity="secondary"
        />
      </div>
    </div>

    <!-- 新增來源對話框 -->
    <Dialog
      v-model:visible="showCreateSourceDialog"
      header="新增來源作品"
      :modal="true"
      :style="{ width: '500px' }"
      :closable="true"
    >
      <div class="space-y-4">
        <!-- 類型 -->
        <div class="field">
          <label for="new-source-type" class="block font-semibold mb-2">
            類型 <span class="text-primary-500">*</span>
          </label>
          <Dropdown
            id="new-source-type"
            v-model="newSource.type"
            :options="sourceTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="選擇類型"
            class="w-full"
            :class="{ 'p-invalid': newSourceErrors.type }"
          />
          <small v-if="newSourceErrors.type" class="text-primary-500">
            {{ newSourceErrors.type }}
          </small>
        </div>

        <!-- 標題 -->
        <div class="field">
          <label for="new-source-title" class="block font-semibold mb-2">
            標題 <span class="text-primary-500">*</span>
          </label>
          <InputText
            id="new-source-title"
            v-model="newSource.title"
            placeholder="輸入作品標題"
            class="w-full"
            :class="{ 'p-invalid': newSourceErrors.title }"
          />
          <small v-if="newSourceErrors.title" class="text-primary-500">
            {{ newSourceErrors.title }}
          </small>
        </div>

        <!-- Slug -->
        <div class="field">
          <label for="new-source-slug" class="block font-semibold mb-2">
            Slug（網址識別碼）
          </label>
          <InputText
            id="new-source-slug"
            v-model="newSource.slug"
            @input="onSourceSlugInput"
            placeholder="自動產生或手動輸入"
            class="w-full"
            :class="{ 'p-invalid': !sourceSlugOk }"
          />
          <small v-if="!sourceSlugOk" class="text-primary-500">
            {{ sourceSlugError }}
          </small>
          <small v-else class="text-surface-500">
            預覽：https://memedam.com/source/{{ newSource.slug || '...' }}
          </small>
        </div>

        <!-- 年份 -->
        <div class="field">
          <label for="new-source-year" class="block font-semibold mb-2">
            年份
          </label>
          <InputNumber
            id="new-source-year"
            v-model="newSource.year"
            :min="1900"
            :max="new Date().getFullYear() + 1"
            placeholder="例：2024"
            class="w-full"
          />
        </div>

        <!-- 簡介 -->
        <div class="field">
          <label for="new-source-synopsis" class="block font-semibold mb-2">
            簡介
          </label>
          <Textarea
            id="new-source-synopsis"
            v-model="newSource.synopsis"
            placeholder="簡單描述作品內容"
            rows="3"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="取消"
          icon="pi pi-times"
          @click="showCreateSourceDialog = false"
          severity="secondary"
        />
        <Button
          label="創建"
          icon="pi pi-check"
          @click="createSource"
          :loading="creatingSource"
          :disabled="!sourceSlugOk"
        />
      </template>
    </Dialog>

    <!-- 新增片段對話框 -->
    <Dialog
      v-model:visible="showCreateSceneDialog"
      header="新增片段"
      :modal="true"
      :style="{ width: '500px' }"
      :closable="true"
    >
      <div class="space-y-4">
        <!-- 標題 -->
        <div class="field">
          <label for="new-scene-title" class="block font-semibold mb-2">
            片段標題
          </label>
          <InputText
            id="new-scene-title"
            v-model="newScene.title"
            placeholder="輸入片段標題（選填）"
            class="w-full"
          />
        </div>

        <!-- 開始時間 -->
        <div class="field">
          <label for="new-scene-start" class="block font-semibold mb-2">
            開始時間（秒）
          </label>
          <InputNumber
            id="new-scene-start"
            v-model="newScene.start_time"
            :min="0"
            placeholder="例：120（2分鐘）"
            class="w-full"
          />
        </div>

        <!-- 結束時間 -->
        <div class="field">
          <label for="new-scene-end" class="block font-semibold mb-2">
            結束時間（秒）
          </label>
          <InputNumber
            id="new-scene-end"
            v-model="newScene.end_time"
            :min="0"
            placeholder="例：180（3分鐘）"
            class="w-full"
          />
        </div>

        <!-- 引言 -->
        <div class="field">
          <label for="new-scene-quote" class="block font-semibold mb-2">
            經典台詞
          </label>
          <Textarea
            id="new-scene-quote"
            v-model="newScene.quote"
            placeholder="輸入經典台詞或對話"
            rows="2"
            class="w-full"
          />
        </div>

        <!-- 圖片連結 -->
        <div class="field">
          <label class="block font-semibold mb-2">
            截圖連結
          </label>
          <div v-for="(img, index) in newScene.images" :key="index" class="flex gap-2 mb-2">
            <InputText
              v-model="newScene.images[index]"
              placeholder="輸入圖片 URL"
              class="flex-1"
            />
            <Button
              icon="pi pi-times"
              severity="danger"
              text
              @click="removeSceneImage(index)"
            />
          </div>
          <Button
            label="新增圖片"
            icon="pi pi-plus"
            severity="secondary"
            size="small"
            @click="addSceneImage"
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="取消"
          icon="pi pi-times"
          @click="showCreateSceneDialog = false"
          severity="secondary"
        />
        <Button
          label="創建"
          icon="pi pi-check"
          @click="createScene"
          :loading="creatingScene"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useDebounceFn } from '@vueuse/core'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import sourceService from '@/services/sourceService'
import sceneService from '@/services/sceneService'

const props = defineProps({
  source_id: {
    type: String,
    default: null
  },
  scene_id: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:source_id', 'update:scene_id'])

const toast = useToast()

// 狀態
const selectedSource = ref('')
const selectedScene = ref('')
const sourceSuggestions = ref([])
const sceneSuggestions = ref([])
const sourceError = ref('')
const dropdownMode = ref('blank')

// 對話框狀態
const showCreateSourceDialog = ref(false)
const showCreateSceneDialog = ref(false)
const creatingSource = ref(false)
const creatingScene = ref(false)

// 新來源表單
const newSource = ref({
  type: '',
  title: '',
  slug: '',
  year: null,
  synopsis: ''
})

const newSourceErrors = ref({
  type: '',
  title: ''
})

// Slug 相關
const userEditedSourceSlug = ref(false)
const sourceSlugOk = ref(true)
const sourceSlugError = ref('')

// 新片段表單
const newScene = ref({
  title: '',
  start_time: null,
  end_time: null,
  quote: '',
  images: []
})

// 來源類型選項
const sourceTypeOptions = [
  { label: '影片', value: 'video' },
  { label: '電影', value: 'film' },
  { label: '電視劇', value: 'tv' },
  { label: '廣告', value: 'ad' },
  { label: '網路影片', value: 'web' },
  { label: '文章', value: 'article' },
  { label: '其他', value: 'other' }
]

// 工具函數
const getTypeLabel = (type) => {
  const option = sourceTypeOptions.find(opt => opt.value === type)
  return option ? option.label : type
}

const formatTime = (seconds) => {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const slugify = (text) => {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}

// 搜尋來源
const searchSources = async (event) => {
  const query = event.query
  if (query.length < 2) {
    sourceSuggestions.value = []
    return
  }

  try {
    const { data } = await sourceService.search(query, 10)
    sourceSuggestions.value = data.data || []
  } catch (error) {
    console.error('搜尋來源失敗:', error)
    sourceSuggestions.value = []
  }
}

// 選擇來源
const onSourceSelect = (event) => {
  const source = event.value
  if (source && source._id) {
    emit('update:source_id', source._id)
    selectedSource.value = source.title
    sourceError.value = ''
    // 清空場景選擇
    emit('update:scene_id', null)
    selectedScene.value = ''
    sceneSuggestions.value = []
  }
}

// 搜尋場景
const searchScenes = async (event) => {
  if (!props.source_id) return

  const query = event.query
  try {
    const { data } = await sourceService.getScenes(props.source_id, query, 1)
    sceneSuggestions.value = data.data || []
  } catch (error) {
    console.error('搜尋場景失敗:', error)
    sceneSuggestions.value = []
  }
}

// 選擇場景
const onSceneSelect = (event) => {
  const scene = event.value
  if (scene && scene._id) {
    emit('update:scene_id', scene._id)
    selectedScene.value = scene.title || scene.quote || formatTime(scene.start_time)
  }
}

// Slug 輸入處理
const onSourceSlugInput = () => {
  userEditedSourceSlug.value = true
  newSource.value.slug = slugify(newSource.value.slug)
  checkSourceSlugAvailable(newSource.value.slug)
}

// 檢查 Slug 可用性
const checkSourceSlugAvailable = useDebounceFn(async (slug) => {
  if (!slug || slug.length < 3) {
    sourceSlugOk.value = false
    sourceSlugError.value = 'Slug 至少需要 3 個字元'
    return
  }

  try {
    const { data } = await sourceService.checkSlugAvailable(slug)
    sourceSlugOk.value = data.ok
    sourceSlugError.value = data.ok ? '' : data.reason
  } catch (error) {
    sourceSlugOk.value = false
    sourceSlugError.value = '無法驗證 slug 的唯一性'
  }
}, 500)

// 監聽標題變化自動生成 slug
watch(() => newSource.value.title, (newTitle) => {
  if (!userEditedSourceSlug.value && newTitle) {
    newSource.value.slug = slugify(newTitle)
    checkSourceSlugAvailable(newSource.value.slug)
  }
})

// 創建來源
const createSource = async () => {
  // 驗證
  newSourceErrors.value = { type: '', title: '' }
  let isValid = true

  if (!newSource.value.type) {
    newSourceErrors.value.type = '請選擇類型'
    isValid = false
  }

  if (!newSource.value.title?.trim()) {
    newSourceErrors.value.title = '請輸入標題'
    isValid = false
  }

  if (!isValid || !sourceSlugOk.value) return

  creatingSource.value = true
  try {
    const sourceData = {
      type: newSource.value.type,
      title: newSource.value.title.trim(),
      slug: newSource.value.slug || undefined,
      year: newSource.value.year || undefined,
      synopsis: newSource.value.synopsis?.trim() || undefined
    }

    const { data } = await sourceService.create(sourceData)
    
    if (data.data && data.data._id) {
      // 設定選中的來源
      emit('update:source_id', data.data._id)
      selectedSource.value = data.data.title
      sourceError.value = ''
      
      // 關閉對話框
      showCreateSourceDialog.value = false
      
      // 重置表單
      newSource.value = {
        type: '',
        title: '',
        slug: '',
        year: null,
        synopsis: ''
      }
      userEditedSourceSlug.value = false
      
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '來源作品已創建',
        life: 3000
      })
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '創建失敗',
      detail: error.message || '創建來源失敗',
      life: 5000
    })
  } finally {
    creatingSource.value = false
  }
}

// 場景圖片管理
const addSceneImage = () => {
  newScene.value.images.push('')
}

const removeSceneImage = (index) => {
  newScene.value.images.splice(index, 1)
}

// 創建場景
const createScene = async () => {
  if (!props.source_id) {
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: '請先選擇來源作品',
      life: 3000
    })
    return
  }

  creatingScene.value = true
  try {
    const sceneData = {
      source_id: props.source_id,
      title: newScene.value.title?.trim() || undefined,
      start_time: newScene.value.start_time || undefined,
      end_time: newScene.value.end_time || undefined,
      quote: newScene.value.quote?.trim() || undefined,
      images: newScene.value.images.filter(img => img.trim())
    }

    const { data } = await sceneService.create(sceneData)
    
    if (data.data && data.data._id) {
      // 設定選中的場景
      emit('update:scene_id', data.data._id)
      selectedScene.value = data.data.title || data.data.quote || formatTime(data.data.start_time)
      
      // 關閉對話框
      showCreateSceneDialog.value = false
      
      // 重置表單
      newScene.value = {
        title: '',
        start_time: null,
        end_time: null,
        quote: '',
        images: []
      }
      
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '片段已創建',
        life: 3000
      })
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '創建失敗',
      detail: error.message || '創建片段失敗',
      life: 5000
    })
  } finally {
    creatingScene.value = false
  }
}

// 驗證來源是否已選擇
const validateSource = () => {
  if (!props.source_id) {
    sourceError.value = '請選擇或創建來源作品'
    return false
  }
  sourceError.value = ''
  return true
}

// 暴露驗證方法給父組件
defineExpose({
  validateSource
})
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}
</style>