<script setup>
// Define component name to fix linter error
defineOptions({
  name: 'AdminAnnouncements',
})

import { FilterMatchMode } from '@primevue/core/api'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import announcementService from '@/services/announcementService'

const toast = useToast()

// 表格與狀態
const dt = ref()
const loading = ref(false)
const announcements = ref([])
const selectedAnnouncements = ref([])
const totalRecords = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

// 對話框
const announcementDialog = ref(false)
const deleteAnnouncementDialog = ref(false)
const deleteAnnouncementsDialog = ref(false)

// 表單資料
const announcement = ref({})
const submitted = ref(false)

// 篩選器
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  status: { value: '', matchMode: FilterMatchMode.EQUALS },
  priority: { value: '', matchMode: FilterMatchMode.EQUALS },
  type: { value: '', matchMode: FilterMatchMode.EQUALS },
})

// 篩選選單（含「全部」）
const filterStatuses = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已發布', value: 'published' },
  { label: '已下架', value: 'archived' },
]

const filterPriorities = [
  { label: '全部', value: '' },
  { label: '一般', value: 'normal' },
  { label: '重要', value: 'important' },
  { label: '緊急', value: 'urgent' },
]

const filterTypes = [
  { label: '全部', value: '' },
  { label: '一般公告', value: 'general' },
  { label: '系統維護', value: 'maintenance' },
  { label: '功能更新', value: 'update' },
  { label: '活動通知', value: 'event' },
]

// 表單選單（不含「全部」）
const formStatuses = [
  { label: '草稿', value: 'draft' },
  { label: '已發布', value: 'published' },
  { label: '已下架', value: 'archived' },
]

const formPriorities = [
  { label: '一般', value: 'normal' },
  { label: '重要', value: 'important' },
  { label: '緊急', value: 'urgent' },
]

const formTypes = [
  { label: '一般公告', value: 'general' },
  { label: '系統維護', value: 'maintenance' },
  { label: '功能更新', value: 'update' },
  { label: '活動通知', value: 'event' },
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
    if (filters.value.priority.value && filters.value.priority.value !== '') {
      params.priority = filters.value.priority.value
    }
    if (filters.value.type.value && filters.value.type.value !== '') {
      params.type = filters.value.type.value
    }
    if (
      filters.value.global.value &&
      filters.value.global.value.trim() !== ''
    ) {
      params.search = filters.value.global.value.trim()
    }

    const response = await announcementService.getAll(params)

    // 處理後端API響應格式
    if (response.data && response.data.announcements) {
      announcements.value = response.data.announcements
      totalRecords.value = response.data.pagination?.total || 0
    } else if (Array.isArray(response.data)) {
      // 如果直接返回陣列（向後相容）
      announcements.value = response.data
      totalRecords.value = response.data.length
    } else {
      announcements.value = []
      totalRecords.value = 0
    }

    // 清除選擇
    selectedAnnouncements.value = []
  } catch (error) {
    console.error('載入公告數據失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: '載入公告數據失敗',
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
  announcements.value = [
    {
      _id: 1,
      id: 1,
      title: '系統維護通知',
      content: '系統將於今晚 2:00-4:00 進行維護，期間可能無法正常使用服務。',
      type: 'maintenance',
      priority: 'important',
      status: 'published',
      is_pinned: true,
      author: 'admin',
      created_at: '2024-01-15T10:30:00Z',
      published_at: '2024-01-15T10:30:00Z',
      view_count: 1234,
    },
    {
      _id: 2,
      id: 2,
      title: '新功能上線',
      content: '我們新增了標籤搜尋功能，讓您更容易找到喜歡的迷因！',
      type: 'update',
      priority: 'normal',
      status: 'published',
      is_pinned: false,
      author: 'admin',
      created_at: '2024-01-14T15:20:00Z',
      published_at: '2024-01-14T16:00:00Z',
      view_count: 890,
    },
    {
      _id: 3,
      id: 3,
      title: '春節活動',
      content: '春節期間將舉辦特別活動，敬請期待！',
      type: 'event',
      priority: 'urgent',
      status: 'draft',
      is_pinned: false,
      author: 'admin',
      created_at: '2024-01-13T12:45:00Z',
      published_at: null,
      view_count: 0,
    },
    {
      _id: 4,
      id: 4,
      title: '使用條款更新',
      content: '我們更新了使用條款，請用戶詳閱。',
      type: 'general',
      priority: 'normal',
      status: 'archived',
      is_pinned: false,
      author: 'admin',
      created_at: '2024-01-10T09:15:00Z',
      published_at: '2024-01-10T09:15:00Z',
      view_count: 567,
    },
  ]
  totalRecords.value = announcements.value.length
  selectedAnnouncements.value = []
}

onMounted(async () => {
  await loadData()
})

function openNew() {
  announcement.value = {
    status: 'draft',
    priority: 'normal',
    type: 'general',
    is_pinned: false,
  }
  submitted.value = false
  announcementDialog.value = true
}

function hideDialog() {
  announcementDialog.value = false
  submitted.value = false
}

async function saveAnnouncement() {
  submitted.value = true
  const current = announcement.value

  if (!current?.title?.trim() || !current?.content?.trim()) return

  try {
    if (current._id) {
      // 更新現有公告
      await announcementService.update(current._id, current)
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '公告已更新',
        life: 3000,
      })
    } else {
      // 建立新公告
      current.created_at = new Date().toISOString()
      current.author = 'admin'
      current.view_count = 0
      if (current.status === 'published') {
        current.published_at = new Date().toISOString()
      }
      await announcementService.create(current)
      toast.add({
        severity: 'success',
        summary: '成功',
        detail: '公告已建立',
        life: 3000,
      })
    }

    announcementDialog.value = false
    announcement.value = {}
    await loadData() // 重新載入數據
  } catch (error) {
    console.error('儲存公告失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '儲存公告失敗',
      life: 3000,
    })
  }
}

function editAnnouncement(row) {
  announcement.value = { ...row }
  announcementDialog.value = true
}

function confirmDeleteAnnouncement(row) {
  announcement.value = row
  deleteAnnouncementDialog.value = true
}

async function deleteAnnouncement() {
  try {
    await announcementService.remove(announcement.value._id)
    deleteAnnouncementDialog.value = false
    announcement.value = {}
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '公告已刪除',
      life: 3000,
    })
    await loadData() // 重新載入數據
  } catch (error) {
    console.error('刪除公告失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '刪除公告失敗',
      life: 3000,
    })
  }
}

function confirmDeleteSelected() {
  deleteAnnouncementsDialog.value = true
}

async function deleteSelectedAnnouncements() {
  try {
    const ids = selectedAnnouncements.value.map((a) => a._id)
    // 後端未提供批次刪除端點，逐一刪除
    await Promise.all(ids.map((id) => announcementService.remove(id)))
    selectedAnnouncements.value = []
    deleteAnnouncementsDialog.value = false
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '已刪除選取公告',
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

async function publishAnnouncement(announcementId) {
  try {
    await announcementService.update(announcementId, {
      status: 'published',
      published_at: new Date().toISOString(),
    })
    const idx = announcements.value.findIndex((a) => a._id === announcementId)
    if (idx !== -1) {
      announcements.value[idx].status = 'published'
      announcements.value[idx].published_at = new Date().toISOString()
    }
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '公告已發布',
      life: 3000,
    })
  } catch (error) {
    console.error('發布公告失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '發布公告失敗',
      life: 3000,
    })
  }
}

async function unpublishAnnouncement(announcementId) {
  try {
    await announcementService.update(announcementId, { status: 'archived' })
    const idx = announcements.value.findIndex((a) => a._id === announcementId)
    if (idx !== -1) {
      announcements.value[idx].status = 'archived'
    }
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '公告已下架',
      life: 3000,
    })
  } catch (error) {
    console.error('下架公告失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '下架公告失敗',
      life: 3000,
    })
  }
}

async function togglePinAnnouncement(announcementId) {
  try {
    const idx = announcements.value.findIndex((a) => a._id === announcementId)
    if (idx === -1) return

    const newPinnedState = !announcements.value[idx].is_pinned
    await announcementService.update(announcementId, {
      is_pinned: newPinnedState,
    })
    announcements.value[idx].is_pinned = newPinnedState

    const action = newPinnedState ? '置頂' : '取消置頂'
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: `公告已${action}`,
      life: 3000,
    })
  } catch (error) {
    console.error('切換置頂狀態失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: error.response?.data?.message || '切換置頂狀態失敗',
      life: 3000,
    })
  }
}

async function batchPublish() {
  if (!selectedAnnouncements.value || selectedAnnouncements.value.length === 0) {
    toast.add({
      severity: 'warn',
      summary: '警告',
      detail: '請先選擇要發布的公告',
      life: 3000,
    })
    return
  }

  try {
    await Promise.all(
      selectedAnnouncements.value.map((announcement) =>
        publishAnnouncement(announcement._id),
      ),
    )

    selectedAnnouncements.value = []
    toast.add({
      severity: 'success',
      summary: '成功',
      detail: '已批量發布公告',
      life: 3000,
    })
  } catch (error) {
    console.error('批量發布失敗:', error)
    toast.add({
      severity: 'error',
      summary: '錯誤',
      detail: '批量發布失敗',
      life: 3000,
    })
  }
}

async function exportCSV() {
  try {
    const response = await announcementService.exportAnnouncements({
      page: currentPage.value,
      limit: pageSize.value,
    })

    // 創建下載連結
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `announcements-${new Date().toISOString().split('T')[0]}.csv`
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
function getStatusLabel(status) {
  switch (status) {
    case 'published':
      return 'success'
    case 'draft':
      return 'info'
    case 'archived':
      return 'secondary'
    default:
      return null
  }
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 'urgent':
      return 'primary'
    case 'important':
      return 'warn'
    case 'normal':
      return 'secondary'
    default:
      return null
  }
}

function getTypeLabel(type) {
  switch (type) {
    case 'maintenance':
      return 'danger'
    case 'update':
      return 'warn'
    case 'event':
      return 'info'
    case 'general':
      return 'secondary'
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
            label="新增公告"
            icon="pi pi-plus"
            severity="primary"
            class="mr-2"
            @click="openNew"
          />
          <Button
            label="批量發布"
            icon="pi pi-check"
            severity="secondary"
            class="mr-2"
            @click="batchPublish"
            :disabled="!selectedAnnouncements || !selectedAnnouncements.length"
          />
          <Button
            label="刪除"
            icon="pi pi-trash"
            severity="secondary"
            @click="confirmDeleteSelected"
            :disabled="!selectedAnnouncements || !selectedAnnouncements.length"
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
              placeholder="搜尋公告..."
              @input="onFilterChange"
            />
          </IconField>
        </template>
      </Toolbar>

      <DataTable
        ref="dt"
        :value="announcements"
        v-model:selection="selectedAnnouncements"
        dataKey="_id"
        :loading="loading"
        lazy
        paginator
        :totalRecords="totalRecords"
        :rows="pageSize"
        :first="(currentPage - 1) * pageSize"
        :filters="filters"
        :rowsPerPageOptions="[5, 10, 25, 50]"
        currentPageReportTemplate="顯示第 {first} 到 {last} 項，共 {totalRecords} 個公告"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        @page="onPageChange"
      >
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0">公告管理</h4>
            <div class="flex gap-2">
              <Dropdown
                v-model="filters.type.value"
                :options="filterTypes"
                optionLabel="label"
                optionValue="value"
                placeholder="按類型篩選"
                @change="onFilterChange"
              />
              <Dropdown
                v-model="filters.priority.value"
                :options="filterPriorities"
                optionLabel="label"
                optionValue="value"
                placeholder="按優先級篩選"
                @change="onFilterChange"
              />
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
        ></Column>
        <Column field="title" header="標題" sortable style="min-width: 16rem">
          <template #body="slotProps">
            <div class="flex items-center gap-2">
              <span>{{ slotProps.data.title }}</span>
              <i
                v-if="slotProps.data.is_pinned"
                class="pi pi-thumbtack text-orange-500"
              ></i>
            </div>
          </template>
        </Column>
        <Column field="type" header="類型" sortable style="min-width: 10rem">
          <template #body="slotProps">
            <Tag
              :value="
                slotProps.data.type === 'maintenance'
                  ? '系統維護'
                  : slotProps.data.type === 'update'
                    ? '功能更新'
                    : slotProps.data.type === 'event'
                      ? '活動通知'
                      : '一般公告'
              "
              :severity="getTypeLabel(slotProps.data.type)"
            />
          </template>
        </Column>
        <Column
          field="priority"
          header="優先級"
          sortable
          style="min-width: 10rem"
        >
          <template #body="slotProps">
            <Tag
              :value="
                slotProps.data.priority === 'urgent'
                  ? '緊急'
                  : slotProps.data.priority === 'important'
                    ? '重要'
                    : '一般'
              "
              :severity="getPriorityLabel(slotProps.data.priority)"
            />
          </template>
        </Column>
        <Column field="status" header="狀態" sortable style="min-width: 10rem">
          <template #body="slotProps">
            <Tag
              :value="
                slotProps.data.status === 'published'
                  ? '已發布'
                  : slotProps.data.status === 'draft'
                    ? '草稿'
                    : '已下架'
              "
              :severity="getStatusLabel(slotProps.data.status)"
            />
          </template>
        </Column>
        <Column
          field="view_count"
          header="瀏覽數"
          sortable
          style="min-width: 8rem"
        ></Column>
        <Column
          field="created_at"
          header="建立時間"
          sortable
          style="min-width: 12rem"
        >
          <template #body="slotProps">
            {{
              new Date(slotProps.data.created_at).toLocaleDateString('zh-TW')
            }}
          </template>
        </Column>
        <Column
          field="published_at"
          header="發布時間"
          sortable
          style="min-width: 12rem"
        >
          <template #body="slotProps">
            {{
              slotProps.data.published_at
                ? new Date(slotProps.data.published_at).toLocaleDateString(
                    'zh-TW',
                  )
                : '-'
            }}
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 16rem">
          <template #body="slotProps">
            <Button
              icon="pi pi-pencil"
              outlined
              rounded
              class="mr-2"
              @click="editAnnouncement(slotProps.data)"
            />
            <Button
              v-if="slotProps.data.status === 'draft'"
              icon="pi pi-check"
              outlined
              rounded
              severity="success"
              class="mr-2"
              @click="publishAnnouncement(slotProps.data._id)"
            />
            <Button
              v-if="slotProps.data.status === 'published'"
              icon="pi pi-times"
              outlined
              rounded
              severity="warning"
              class="mr-2"
              @click="unpublishAnnouncement(slotProps.data._id)"
            />
            <Button
              :icon="
                slotProps.data.is_pinned ? 'pi pi-thumbtack' : 'pi pi-thumbtack'
              "
              outlined
              rounded
              :severity="slotProps.data.is_pinned ? 'warning' : 'secondary'"
              class="mr-2"
              @click="togglePinAnnouncement(slotProps.data._id)"
            />
            <Button
              icon="pi pi-trash"
              outlined
              rounded
              severity="danger"
              @click="confirmDeleteAnnouncement(slotProps.data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 新增/編輯對話框 -->
    <Dialog
      v-model:visible="announcementDialog"
      :style="{ width: '600px' }"
      header="公告詳細資料"
      :modal="true"
    >
      <div class="flex flex-col gap-6">
        <div>
          <label for="title" class="block font-bold mb-3">標題</label>
          <InputText
            id="title"
            v-model.trim="announcement.title"
            required="true"
            autofocus
            :invalid="submitted && !announcement.title"
            fluid
          />
          <small v-if="submitted && !announcement.title" class="text-red-500"
            >標題為必填項目。</small
          >
        </div>
        <div>
          <label for="content" class="block font-bold mb-3">內容</label>
          <Textarea
            id="content"
            v-model="announcement.content"
            rows="6"
            required="true"
            :invalid="submitted && !announcement.content"
            fluid
          />
          <small v-if="submitted && !announcement.content" class="text-red-500"
            >內容為必填項目。</small
          >
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="type" class="block font-bold mb-3">類型</label>
            <Dropdown
              id="type"
              v-model="announcement.type"
              :options="formTypes"
              optionLabel="label"
              optionValue="value"
              placeholder="選擇類型"
              fluid
            ></Dropdown>
          </div>
          <div>
            <label for="priority" class="block font-bold mb-3">優先級</label>
            <Dropdown
              id="priority"
              v-model="announcement.priority"
              :options="formPriorities"
              optionLabel="label"
              optionValue="value"
              placeholder="選擇優先級"
              fluid
            ></Dropdown>
          </div>
          <div>
            <label for="status" class="block font-bold mb-3">狀態</label>
            <Dropdown
              id="status"
              v-model="announcement.status"
              :options="formStatuses"
              optionLabel="label"
              optionValue="value"
              placeholder="選擇狀態"
              fluid
            ></Dropdown>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <InputSwitch v-model="announcement.is_pinned" />
          <label class="text-sm">置頂公告</label>
        </div>
      </div>

      <template #footer>
        <Button label="取消" icon="pi pi-times" text @click="hideDialog" />
        <Button label="儲存" icon="pi pi-check" @click="saveAnnouncement" />
      </template>
    </Dialog>

    <!-- 單筆刪除確認 -->
    <Dialog
      v-model:visible="deleteAnnouncementDialog"
      :style="{ width: '450px' }"
      header="確認"
      :modal="true"
    >
      <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle !text-3xl" />
        <span v-if="announcement"
          >您確定要刪除公告 <b>{{ announcement.title }}</b> 嗎？</span
        >
      </div>
      <template #footer>
        <Button
          label="否"
          icon="pi pi-times"
          text
          @click="deleteAnnouncementDialog = false"
        />
        <Button label="是" icon="pi pi-check" @click="deleteAnnouncement" />
      </template>
    </Dialog>

    <!-- 多筆刪除確認 -->
    <Dialog
      v-model:visible="deleteAnnouncementsDialog"
      :style="{ width: '450px' }"
      header="確認"
      :modal="true"
    >
      <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle !text-3xl" />
        <span>您確定要刪除選取的公告嗎？</span>
      </div>
      <template #footer>
        <Button
          label="否"
          icon="pi pi-times"
          text
          @click="deleteAnnouncementsDialog = false"
        />
        <Button
          label="是"
          icon="pi pi-check"
          text
          @click="deleteSelectedAnnouncements"
        />
      </template>
    </Dialog>
  </div>
</template>

<route lang="yaml">
meta:
  layout: admin
  title: '公告管理'
  admin: true
</route>