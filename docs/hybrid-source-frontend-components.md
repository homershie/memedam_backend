# 三層模型前端組件架構文件

## 概述
本文件說明如何在前端實作 Source/Scene/Meme 三層模型的組件架構，包含詳情頁組件拆分、資料流程和 SEO 處理。

## 組件結構

### 1. 迷因詳情頁組件架構

```vue
<!-- pages/meme/[idOrSlug].vue -->
<template>
  <div class="meme-detail-page">
    <!-- 主要迷因展示區 -->
    <MemeHero 
      :meme="meme"
      @like="handleLike"
      @share="handleShare"
      @collect="handleCollect"
    />
    
    <!-- 梗點解析 -->
    <MemeAnalysis 
      v-if="meme.body"
      :content="meme.body"
      :author="meme.author_id"
    />
    
    <!-- 出處資訊卡片（可展開） -->
    <SourceCard 
      v-if="source || scene"
      :source="source"
      :scene="scene"
      :expandable="true"
      :default-expanded="false"
    />
    
    <!-- 變體/混剪族譜 -->
    <VariantGallery 
      v-if="variants && variants.length > 0"
      :variants="variants"
      :current-meme-id="meme._id"
      :lineage="meme.lineage"
    />
    
    <!-- 同來源的其他迷因 -->
    <RelatedFromSource 
      v-if="fromSource && fromSource.length > 0"
      :memes="fromSource"
      :source="source"
      :current-meme-id="meme._id"
    />
    
    <!-- 留言區 -->
    <CommentSection :meme-id="meme._id" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMemeStore } from '@/stores/meme'

const route = useRoute()
const memeStore = useMemeStore()

const meme = ref(null)
const source = ref(null)
const scene = ref(null)
const variants = ref([])
const fromSource = ref([])

onMounted(async () => {
  const { idOrSlug } = route.params
  
  // 使用 bundle API 一次取得所有資料
  const response = await fetch(
    `/api/memes/${idOrSlug}/bundle?include=scene,source,variants,from_source`
  )
  const data = await response.json()
  
  if (data.success) {
    meme.value = data.data.meme
    source.value = data.data.source
    scene.value = data.data.scene
    variants.value = data.data.variants || []
    fromSource.value = data.data.from_source || []
  }
})

// SEO 處理
const canonicalUrl = computed(() => {
  // 如果是近似重複（媒體相同且正文極短），指向 root
  if (shouldUseRootCanonical()) {
    const rootMeme = variants.value.find(v => v._id === meme.value.lineage?.root)
    return rootMeme ? `/meme/${rootMeme.slug}` : `/meme/${meme.value.slug}`
  }
  // 否則使用自己的 canonical
  return `/meme/${meme.value.slug}`
})

const shouldUseRootCanonical = () => {
  if (!meme.value.variant_of) return false
  if (!meme.value.body || meme.value.body.length < 50) {
    // 檢查是否與原始迷因媒體相同
    const rootMeme = variants.value.find(v => v._id === meme.value.lineage?.root)
    if (rootMeme) {
      return (
        rootMeme.image_url === meme.value.image_url &&
        rootMeme.video_url === meme.value.video_url
      )
    }
  }
  return false
}
</script>
```

### 2. MemeHero 組件

```vue
<!-- components/meme/MemeHero.vue -->
<template>
  <div class="meme-hero">
    <h1 class="meme-title">{{ meme.title }}</h1>
    
    <!-- 主媒體展示 -->
    <div class="meme-media">
      <img v-if="meme.type === 'image'" :src="meme.image_url" :alt="meme.title" />
      <video v-else-if="meme.type === 'video'" :src="meme.video_url" controls />
      <audio v-else-if="meme.type === 'audio'" :src="meme.audio_url" controls />
      <div v-else class="text-content">{{ meme.content }}</div>
    </div>
    
    <!-- 互動按鈕 -->
    <div class="meme-actions">
      <button @click="$emit('like')" class="btn-like">
        <Icon name="thumb-up" />
        {{ meme.like_count }}
      </button>
      <button @click="$emit('share')" class="btn-share">
        <Icon name="share" />
        分享
      </button>
      <button @click="$emit('collect')" class="btn-collect">
        <Icon name="bookmark" />
        收藏
      </button>
    </div>
    
    <!-- 作者資訊 -->
    <div class="meme-author">
      <Avatar :user="meme.author_id" />
      <div>
        <router-link :to="`/user/${meme.author_id.username}`">
          {{ meme.author_id.display_name || meme.author_id.username }}
        </router-link>
        <time :datetime="meme.createdAt">
          {{ formatDate(meme.createdAt) }}
        </time>
      </div>
    </div>
  </div>
</template>
```

### 3. SourceCard 組件

```vue
<!-- components/meme/SourceCard.vue -->
<template>
  <div class="source-card" :class="{ expanded }">
    <div class="source-header" @click="toggleExpand">
      <h3>出處資訊</h3>
      <Icon :name="expanded ? 'chevron-up' : 'chevron-down'" />
    </div>
    
    <transition name="expand">
      <div v-show="expanded" class="source-content">
        <!-- 片段資訊 -->
        <div v-if="scene" class="scene-info">
          <h4>片段資訊</h4>
          <div v-if="scene.episode" class="scene-episode">
            集數：{{ scene.episode }}
          </div>
          <div v-if="scene.quote" class="scene-quote">
            <Icon name="quote" />
            {{ scene.quote }}
          </div>
          <div v-if="scene.start_time" class="scene-time">
            時間：{{ formatTime(scene.start_time) }}
            <span v-if="scene.end_time"> - {{ formatTime(scene.end_time) }}</span>
          </div>
          <div v-if="scene.images?.length" class="scene-screenshots">
            <img 
              v-for="(img, idx) in scene.images.slice(0, 3)" 
              :key="idx"
              :src="img"
              @click="openLightbox(img)"
            />
          </div>
        </div>
        
        <!-- 作品資訊 -->
        <div v-if="source" class="source-info">
          <h4>作品資訊</h4>
          <router-link :to="`/source/${source.slug}`" class="source-title">
            {{ source.title }}
          </router-link>
          
          <div class="source-meta">
            <span v-if="source.year">{{ source.year }}年</span>
            <span v-if="source.origin_country">{{ source.origin_country }}</span>
            <span class="source-type">{{ getTypeLabel(source.type) }}</span>
          </div>
          
          <div v-if="source.synopsis" class="source-synopsis">
            {{ truncate(source.synopsis, 200) }}
          </div>
          
          <div v-if="source.context" class="source-context">
            <h5>背景說明</h5>
            {{ truncate(source.context, 300) }}
          </div>
          
          <div v-if="source.links?.length" class="source-links">
            <a 
              v-for="link in source.links" 
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener"
            >
              {{ link.label }}
            </a>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  source: Object,
  scene: Object,
  expandable: { type: Boolean, default: true },
  defaultExpanded: { type: Boolean, default: false }
})

const expanded = ref(props.defaultExpanded)

const toggleExpand = () => {
  if (props.expandable) {
    expanded.value = !expanded.value
  }
}

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const getTypeLabel = (type) => {
  const labels = {
    video: '影片',
    film: '電影',
    tv: '電視劇',
    ad: '廣告',
    web: '網路影片',
    article: '文章',
    other: '其他'
  }
  return labels[type] || type
}
</script>
```

### 4. VariantGallery 組件

```vue
<!-- components/meme/VariantGallery.vue -->
<template>
  <div class="variant-gallery">
    <div class="section-header">
      <h3>變體與混剪</h3>
      <span class="variant-count">共 {{ variants.length }} 個變體</span>
    </div>
    
    <!-- 系譜樹狀圖（可選） -->
    <div v-if="showLineageTree" class="lineage-tree">
      <LineageTree 
        :variants="variants"
        :current-id="currentMemeId"
        :root-id="lineage?.root"
      />
    </div>
    
    <!-- 變體列表 -->
    <div class="variants-grid">
      <div 
        v-for="variant in sortedVariants" 
        :key="variant._id"
        class="variant-card"
        :class="{ 'is-parent': variant._id === meme.variant_of }"
      >
        <router-link :to="`/meme/${variant.slug}`">
          <div class="variant-media">
            <img v-if="variant.image_url" :src="variant.image_url" />
            <video v-else-if="variant.video_url" :src="variant.video_url" />
            <div v-else class="text-preview">{{ variant.title }}</div>
          </div>
          
          <div class="variant-info">
            <h4>{{ variant.title }}</h4>
            <div class="variant-meta">
              <span class="depth-badge">
                第 {{ variant.lineage.depth }} 代
              </span>
              <span class="stats">
                <Icon name="thumb-up" /> {{ variant.like_count }}
              </span>
            </div>
            <div class="variant-author">
              by {{ variant.author_id.display_name || variant.author_id.username }}
            </div>
          </div>
        </router-link>
      </div>
    </div>
    
    <button v-if="hasMore" @click="loadMore" class="btn-load-more">
      載入更多變體
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  variants: Array,
  currentMemeId: String,
  lineage: Object
})

const sortedVariants = computed(() => {
  return [...props.variants].sort((a, b) => {
    // 先按深度排序，再按讚數排序
    if (a.lineage.depth !== b.lineage.depth) {
      return a.lineage.depth - b.lineage.depth
    }
    return b.like_count - a.like_count
  })
})
</script>
```

### 5. RelatedFromSource 組件

```vue
<!-- components/meme/RelatedFromSource.vue -->
<template>
  <div class="related-from-source">
    <div class="section-header">
      <h3>同來源迷因</h3>
      <router-link 
        v-if="source" 
        :to="`/source/${source.slug}`"
        class="view-all-link"
      >
        查看全部 →
      </router-link>
    </div>
    
    <div class="memes-carousel">
      <div 
        v-for="meme in memes" 
        :key="meme._id"
        class="related-meme-card"
      >
        <router-link :to="`/meme/${meme.slug}`">
          <div class="meme-thumbnail">
            <img v-if="meme.image_url" :src="meme.image_url" />
            <video v-else-if="meme.video_url" :src="meme.video_url" />
          </div>
          
          <div class="meme-info">
            <h4>{{ meme.title }}</h4>
            
            <!-- 顯示片段資訊 -->
            <div v-if="meme.scene_id" class="scene-badge">
              <Icon name="film" />
              {{ meme.scene_id.quote || formatTime(meme.scene_id.start_time) }}
            </div>
            
            <div class="meme-stats">
              <span><Icon name="eye" /> {{ meme.view_count }}</span>
              <span><Icon name="thumb-up" /> {{ meme.like_count }}</span>
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
```

## API 使用範例

### Bundle API 調用

```javascript
// 取得迷因及所有相關資料
async function fetchMemeBundle(idOrSlug) {
  const response = await fetch(
    `/api/memes/${idOrSlug}/bundle?include=scene,source,variants,from_source`,
    {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
  
  const data = await response.json()
  
  if (data.success) {
    return {
      meme: data.data.meme,
      source: data.data.source,
      scene: data.data.scene,
      variants: data.data.variants || [],
      fromSource: data.data.from_source || []
    }
  }
  
  throw new Error(data.message || '載入失敗')
}
```

### 來源頁面資料載入

```javascript
// 取得來源及相關資料
async function fetchSourceBundle(slug) {
  const response = await fetch(
    `/api/sources/${slug}?include=scenes,memes`,
    {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
  
  const data = await response.json()
  
  if (data.success) {
    return {
      source: data.data.source,
      scenes: data.data.scenes || [],
      memes: data.data.memes || []
    }
  }
  
  throw new Error(data.message || '載入失敗')
}
```

## 投稿表單整合

```vue
<!-- components/meme/CreateMemeForm.vue -->
<template>
  <form @submit.prevent="handleSubmit">
    <!-- 基本資訊 -->
    <div class="form-group">
      <label>標題</label>
      <input v-model="form.title" required />
    </div>
    
    <!-- 來源選擇 -->
    <div class="form-group">
      <label>選擇來源作品</label>
      <SourceSelector 
        v-model="form.source_id"
        @change="onSourceChange"
      />
      <button type="button" @click="showCreateSource = true">
        找不到？新增來源
      </button>
    </div>
    
    <!-- 片段選擇（可選） -->
    <div v-if="form.source_id" class="form-group">
      <label>選擇片段（可選）</label>
      <SceneSelector 
        v-model="form.scene_id"
        :source-id="form.source_id"
      />
      <button type="button" @click="showCreateScene = true">
        新增片段
      </button>
    </div>
    
    <!-- 變體關係 -->
    <div class="form-group">
      <label>
        <input type="checkbox" v-model="isVariant" />
        這是其他迷因的變體/混剪
      </label>
      
      <div v-if="isVariant">
        <MemeSelector 
          v-model="form.variant_of"
          placeholder="搜尋原始迷因..."
        />
      </div>
    </div>
    
    <!-- 梗點解析（重要！） -->
    <div class="form-group">
      <label>梗點解析 *</label>
      <textarea 
        v-model="form.body"
        placeholder="解釋這個迷因為什麼好笑/有趣（請寫出獨特的見解）"
        rows="5"
        required
      />
    </div>
    
    <!-- 媒體上傳 -->
    <div class="form-group">
      <MediaUploader 
        v-model="form.media"
        :type="form.type"
      />
    </div>
    
    <button type="submit">發布迷因</button>
  </form>
</template>

<script setup>
import { ref, watch } from 'vue'

const form = ref({
  title: '',
  body: '',
  type: 'image',
  source_id: null,
  scene_id: null,
  variant_of: null,
  media: null
})

const isVariant = ref(false)

watch(isVariant, (newVal) => {
  if (!newVal) {
    form.value.variant_of = null
  }
})

const handleSubmit = async () => {
  // 提交表單資料
  const response = await fetch('/api/memes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(form.value)
  })
  
  if (response.ok) {
    // 成功處理
  }
}
</script>
```

## SEO 最佳實踐

### Meta Tags 設定

```javascript
// composables/useSEO.js
export function useMemeSEO(meme, source, scene) {
  const { $meta } = useNuxtApp()
  
  // 設定標題
  const title = computed(() => {
    let t = meme.value.title
    if (source.value) {
      t += ` - ${source.value.title}`
    }
    return t
  })
  
  // 設定描述
  const description = computed(() => {
    if (meme.value.body) {
      return truncate(meme.value.body, 160)
    }
    if (scene.value?.quote) {
      return `「${scene.value.quote}」- ${meme.value.title}`
    }
    return meme.value.content || meme.value.title
  })
  
  // 設定 canonical URL
  const canonical = computed(() => {
    // 檢查是否應該使用 root 的 canonical
    if (shouldUseRootCanonical(meme.value)) {
      return `https://www.memedam.com/meme/${meme.value.lineage?.root}`
    }
    return `https://www.memedam.com/meme/${meme.value.slug || meme.value._id}`
  })
  
  // 設定 structured data
  const structuredData = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: meme.value.title,
    description: description.value,
    image: meme.value.image_url,
    author: {
      '@type': 'Person',
      name: meme.value.author_id.display_name
    },
    isBasedOn: source.value ? {
      '@type': 'CreativeWork',
      name: source.value.title
    } : undefined
  }))
  
  return {
    title,
    description,
    canonical,
    structuredData
  }
}
```

## 效能優化建議

1. **使用 Bundle API**：一次請求取得所有相關資料，減少網路往返
2. **延遲載入**：變體和同來源迷因可以使用 Intersection Observer 延遲載入
3. **快取策略**：
   - Source 資料可以快取較長時間（1 天）
   - Scene 資料可以快取中等時間（1 小時）
   - Meme 資料需要較短快取（5 分鐘）
4. **圖片優化**：使用 Cloudinary 的響應式圖片功能
5. **虛擬滾動**：變體列表超過 50 個時使用虛擬滾動

## 資料一致性維護

1. **編輯迷因時**：
   - 如果更改 scene_id，自動更新 source_id
   - 如果更改 variant_of，重新計算 lineage

2. **刪除/合併迷因時**：
   - 更新相關來源和片段的統計數據
   - 處理變體關係的重新連結

3. **定期維護任務**：
   - 每日重新計算來源和片段的統計數據
   - 檢查並修復循環引用的 lineage
   - 清理孤立的變體關係