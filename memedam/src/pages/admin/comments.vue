<script setup>
defineOptions({
  name: 'AdminComments',
})

import { FilterMatchMode } from '@primevue/core/api'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import commentService from '@/services/commentService'
import CustomTag from '@/components/CustomTag.vue'

const toast = useToast()

// 表格與狀態
const dt = ref()
const loading = ref(false)
const comments = ref([])
const selectedComments = ref([])
const totalRecords = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

// 對話框
const commentDialog = ref(false)
const deleteCommentDialog = ref(false)
const deleteCommentsDialog = ref(false)

// 表單資料
const comment = ref({})
const submitted = ref(false)

// 篩選器
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  status: { value: '', matchMode: FilterMatchMode.EQUALS },
})

// 篩選選單（含「全部」）
const filterStatuses = [
  { label: '全部', value: '' },
  { label: '可見', value: 'visible' },
  { label: '隱藏', value: 'hidden' },
  { label: '待審核', value: 'pending' },
  { label: '已標記', value: 'flagged' },
]

// 表單選單（不含「全部」）
const formStatuses = [
  { label: '可見', value: 'visible' },
  { label: '隱藏', value: 'hidden' },
  { label: '待審核', value: 'pending' },
  { label: '已標記', value: 'flagged' },
]

// 載入真實數據
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      sort: 'createdAt',
      order: 'desc',
    }

    // 添加篩選條件
    if (filters.value.status.value && filters.value.status.value !== '') {
      params.status = filters.value.status.value
    }
    if (
      filters.value.global.value &&
      filters.value.global.value.trim() !== ''
    ) {
      params.search = filters.value.global.value.trim()
    }

    const response = await commentService.getAll(params)

    // 處理後端API響應格式
    if (response.data && response.data.comments) {
      comments.value = response.data.comments
      totalRecords.value = response.data.pagination?.total || 0
    } else if (Array.isArray(response.data)) {
      // 如果直接返回陣列（向後相容）
      comments.value = response.data
      totalRecords.value = response.data.length
    } else {
      comments.value = []
      totalRecords.value = 0
    }

    // 清除選擇
    selectedComments.value = []
  } catch (error) {
    console.error('載入評論數據失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: '載入評論數據失敗',
      life: 3000,
    })
    // 載入假資料作為備用
    loadFallbackData()
  } finally {
    loading.value = false
  }
}

// 備用假資料
const loadFallbackData = () => {
  comments.value = [
    {
      _id: 'C-1001',
      id: 'C-1001',
      content: '這個迷因太好笑了！',
      meme: {
        _id: 'M-1001',
        title: '經典迷因 1',
      },
      author: { username: 'user1', display_name: '用戶一' },
      status: 'visible',
      likeCount: 12,
      replyCount: 2,
      createdAt: '2024-01-14T10:30:00Z',
    },
    {
      _id: 'C-1000',
      id: 'C-1000',
      content: '內容有點不妥，已檢舉。',
      meme: {
        _id: 'M-1002',
        title: '熱門迷因 2',
      },
      author: { username: 'user2', display_name: '用戶二' },
      status: 'flagged',
      likeCount: 1,
      replyCount: 0,
      createdAt: '2024-01-13T15:12:00Z',
    },
    {
      _id: 'C-0999',
      id: 'C-0999',
      content: '請問有原圖嗎？',
      meme: {
        _id: 'M-1003',
        title: '冷門迷因 3',
      },
      author: { username: 'user3', display_name: '用戶三' },
      status: 'pending',
      likeCount: 0,
      replyCount: 1,
      createdAt: '2024-01-12T08:45:00Z',
    },
    {
      _id: 'C-0998',
      id: 'C-0998',
      content: '已隱藏的測試評論',
      meme: {
        _id: 'M-1004',
        title: '經典迷因 4',
      },
      author: { username: 'moderator', display_name: '版主' },
      status: 'hidden',
      likeCount: 0,
      replyCount: 0,
      createdAt: '2024-01-11T21:05:00Z',
    },
  ]
  totalRecords.value = comments.value.length
  selectedComments.value = []
}

onMounted(async () => {
  await loadData()
})

function openNew() {
  comment.value = {
    status: 'visible',
  }
  submitted.value = false
  commentDialog.value = true
}

function hideDialog() {
  commentDialog.value = false
  submitted.value = false
}

async function saveComment() {
  submitted.value = true
  const current = comment.value
  if (!current?.content?.trim()) return

  try {
    if (current._id) {
      // 更新現有評論
      await commentService.update(current._id, current)
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '評論已更新',
        life: 3000,
      })
    } else {
      // 建立新評論
      await commentService.create(current)
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '評論已建立',
        life: 3000,
      })
    }

    commentDialog.value = false
    comment.value = {}
    await loadData() // 重新載入數據
  } catch (error) {
    console.error('儲存評論失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '儲存評論失敗',
      life: 3000,
    })
  }
}

function editComment(row) {
  comment.value = { ...row }
  commentDialog.value = true
}

function confirmDeleteComment(row) {
  comment.value = row
  deleteCommentDialog.value = true
}

async function deleteComment() {
  try {
    await commentService.remove(comment.value._id)
    deleteCommentDialog.value = false
    comment.value = {}
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '評論已刪除',
      life: 3000,
    })
    await loadData() // 重新載入數據
  } catch (error) {
    console.error('刪除評論失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '刪除評論失敗',
      life: 3000,
    })
  }
}

function confirmDeleteSelected() {
  deleteCommentsDialog.value = true
}

async function deleteSelectedComments() {
  try {
    const ids = selectedComments.value.map((c) => c._id)
    // 後端未提供批次刪除端點，逐一刪除
    await Promise.all(ids.map((id) => commentService.remove(id)))
    selectedComments.value = []
    deleteCommentsDialog.value = false
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '已刪除選取評論',
      life: 3000,
    })
    await loadData() // 重新載入數據
  } catch (error) {
    console.error('批量刪除失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '批量刪除失敗',
      life: 3000,
    })
  }
}

async function hideOne(commentId) {
  try {
    await commentService.update(commentId, { status: 'hidden' })
    const idx = comments.value.findIndex((c) => c._id === commentId)
    if (idx !== -1) {
      comments.value[idx].status = 'hidden'
    }
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '已隱藏評論',
      life: 3000,
    })
  } catch (error) {
    console.error('隱藏評論失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '隱藏評論失敗',
      life: 3000,
    })
  }
}

async function unhideOne(commentId) {
  try {
    await commentService.update(commentId, { status: 'visible' })
    const idx = comments.value.findIndex((c) => c._id === commentId)
    if (idx !== -1) {
      comments.value[idx].status = 'visible'
    }
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '已顯示評論',
      life: 3000,
    })
  } catch (error) {
    console.error('顯示評論失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '顯示評論失敗',
      life: 3000,
    })
  }
}

async function exportCSV() {
  try {
    const response = await commentService.exportComments({
      page: currentPage.value,
      limit: pageSize.value,
    })

    // 創建下載連結
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `comments-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '數據已匯出',
      life: 3000,
    })
  } catch (error) {
    console.error('匯出失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: '匯出失敗',
      life: 3000,
    })
  }
}

// 工具函數
function getStatusSeverity(status) {
  switch (status) {
    case 'visible':
      return 'success'
    case 'hidden':
      return 'secondary'
    case 'pending':
      return 'warn'
    case 'flagged':
      return 'danger'
    default:
      return null
  }
}

// 分頁事件處理
function onPageChange(event) {
  pageSize.value = event.rows
  currentPage.value = event.page + 1
  loadData()
}

// 篩選器變更處理
function onFilterChange() {
  currentPage.value = 1
  loadData()
}
</script>

<template>
  <div>
    <div class="card">
      <Toolbar class="mb-6">
        <template #start>
          <Button
            label="新增"
            icon="pi pi-plus"
            severity="primary"
            class="mr-2"
            @click="openNew"
          />
          <Button
            label="刪除"
            icon="pi pi-trash"
            severity="secondary"
            class="mr-2"
            :disabled="!selectedComments?.length"
            @click="confirmDeleteSelected"
          />
        </template>

        <template #end>
          <Button
            label="匯出"
            icon="pi pi-upload"
            severity="secondary"
            class="mr-2"
            @click="exportCSV"
          />
          <IconField>
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText
              v-model="filters['global'].value"
              placeholder="搜尋評論..."
              @input="onFilterChange"
            />
          </IconField>
        </template>
      </Toolbar>

      <DataTable
        ref="dt"
        :value="comments"
        v-model:selection="selectedComments"
        dataKey="_id"
        :loading="loading"
        lazy
        paginator
        :totalRecords="totalRecords"
        :rows="pageSize"
        :first="(currentPage - 1) * pageSize"
        :filters="filters"
        :rowsPerPageOptions="[5, 10, 25, 50]"
        currentPageReportTemplate="顯示第 {first} 到 {last} 項，共 {totalRecords} 則評論"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        @page="onPageChange"
      >
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0">評論管理</h4>
            <div class="flex gap-2">
              <Dropdown
                v-model="filters.status.value"
                :options="filterStatuses"
                optionLabel="label"
                optionValue="value"
                placeholder="按狀態篩選"
                @change="onFilterChange"
              />
            </div>
          </div>
        </template>

        <Column
          selectionMode="multiple"
          style="width: 3rem"
          :exportable="false"
        />
        <Column field="content" header="內容" style="min-width: 16rem">
          <template #body="{ data }">
            {{
              data.content?.length > 60
                ? data.content.slice(0, 60) + '…'
                : data.content
            }}
          </template>
        </Column>
        <Column
          field="meme.title"
          header="迷因"
          sortable
          style="min-width: 12rem"
        >
          <template #body="{ data }">{{
            data.meme?.title || '未知迷因'
          }}</template>
        </Column>
        <Column field="author" header="作者" sortable style="min-width: 10rem">
          <template #body="{ data }">{{
            data.author?.display_name || data.author?.username || '未知'
          }}</template>
        </Column>
        <Column field="status" header="狀態" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <CustomTag
              :value="
                data.status === 'visible'
                  ? '可見'
                  : data.status === 'hidden'
                    ? '隱藏'
                    : data.status === 'pending'
                      ? '待審核'
                      : '已標記'
              "
              :severity="getStatusSeverity(data.status)"
            />
          </template>
        </Column>
        <Column
          field="likeCount"
          header="讚"
          sortable
          style="min-width: 6rem"
        />
        <Column
          field="replyCount"
          header="回覆"
          sortable
          style="min-width: 6rem"
        />
        <Column
          field="createdAt"
          header="建立時間"
          sortable
          style="min-width: 12rem"
        >
          <template #body="{ data }">{{
            new Date(data.createdAt).toLocaleDateString('zh-TW')
          }}</template>
        </Column>
        <Column :exportable="false" style="min-width: 16rem">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              outlined
              rounded
              severity="success"
              class="mr-2"
              @click="editComment(data)"
            />
            <Button
              v-if="data.status !== 'hidden'"
              icon="pi pi-eye-slash"
              outlined
              rounded
              severity="warning"
              class="mr-2"
              @click="hideOne(data._id)"
            />
            <Button
              v-else
              icon="pi pi-eye"
              outlined
              rounded
              severity="success"
              class="mr-2"
              @click="unhideOne(data._id)"
            />
            <Button
              icon="pi pi-trash"
              outlined
              rounded
              severity="secondary"
              @click="confirmDeleteComment(data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 新增/編輯對話框 -->
    <Dialog
      v-model:visible="commentDialog"
      :style="{ width: '500px' }"
      header="評論詳細"
      :modal="true"
    >
      <div class="flex flex-col gap-6">
        <div>
          <label for="content" class="block font-bold mb-3">內容</label>
          <Textarea
            id="content"
            v-model.trim="comment.content"
            rows="4"
            fluid
            :invalid="submitted && !comment.content"
          />
          <small v-if="submitted && !comment.content" class="text-red-500"
            >內容為必填項目。</small
          >
        </div>
        <div>
          <label for="status" class="block font-bold mb-3">狀態</label>
          <Dropdown
            id="status"
            v-model="comment.status"
            :options="formStatuses"
            optionLabel="label"
            optionValue="value"
            placeholder="選擇狀態"
            fluid
          />
        </div>
      </div>
      <template #footer>
        <Button label="取消" icon="pi pi-times" text @click="hideDialog" />
        <Button label="儲存" icon="pi pi-check" @click="saveComment" />
      </template>
    </Dialog>

    <!-- 單筆刪除確認 -->
    <Dialog
      v-model:visible="deleteCommentDialog"
      :style="{ width: '450px' }"
      header="確認"
      :modal="true"
    >
      <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle !text-3xl" />
        <span v-if="comment">您確定要刪除評論嗎？</span>
      </div>
      <template #footer>
        <Button
          label="否"
          icon="pi pi-times"
          text
          @click="deleteCommentDialog = false"
        />
        <Button label="是" icon="pi pi-check" @click="deleteComment" />
      </template>
    </Dialog>

    <!-- 多筆刪除確認 -->
    <Dialog
      v-model:visible="deleteCommentsDialog"
      :style="{ width: '450px' }"
      header="確認"
      :modal="true"
    >
      <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle !text-3xl" />
        <span>您確定要刪除選取的評論嗎？</span>
      </div>
      <template #footer>
        <Button
          label="否"
          icon="pi pi-times"
          text
          @click="deleteCommentsDialog = false"
        />
        <Button
          label="是"
          icon="pi pi-check"
          text
          @click="deleteSelectedComments"
        />
      </template>
    </Dialog>
  </div>
</template>

<route lang="yaml">
meta:
  layout: admin
  title: '評論管理'
  admin: true
</route>