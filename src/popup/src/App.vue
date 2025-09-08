<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import { useColorMode } from '@vueuse/core'
import { onMounted, ref, computed } from 'vue'
import { StorageService } from '../../shared/services/storage'
import { SinanApiService } from '../../shared/services/api'
import { BookmarkService } from '../../shared/services/bookmark'

const mode = useColorMode({
  modes: {
    light: 'light',
    dark: 'dark',
    auto: 'auto'
  },
  initialValue: 'auto'
})

const isLoading = ref(true)
const lastSyncTime = ref<number | undefined>()
const saveButtonText = ref('保存')
const isSaving = ref(false)
const originalConfig = ref<any>({})
const isSyncing = ref(false)
const syncButtonText = ref('重新同步')
const isDeleting = ref(false)
const deleteButtonText = ref('删除书签目录')
const syncAlert = ref<{ show: boolean; type: 'success' | 'error'; message: string }>({
  show: false,
  type: 'success',
  message: ''
})

// 表单状态持久化
const formValues = ref({
  serverUrl: 'https://sinan.host',
  apiKey: '',
  autoSync: false,
  syncInterval: '30',
  iconSource: 'google-s2' as 'google-s2' | 'sinan',
})


const hasChanges = computed(() => {
  return (
    formValues.value.serverUrl !== originalConfig.value.serverUrl ||
    formValues.value.apiKey !== originalConfig.value.apiKey ||
    formValues.value.autoSync !== originalConfig.value.autoSync ||
    formValues.value.syncInterval !== originalConfig.value.syncInterval ||
    formValues.value.iconSource !== originalConfig.value.iconSource
  )
})

const lastSyncText = computed(() => {
  if (!lastSyncTime.value) return '尚未同步'
  
  const now = Date.now()
  const diff = now - lastSyncTime.value
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
})


onMounted(async () => {
  try {
    const config = await StorageService.getConfig()
    originalConfig.value = { ...config }
    
    // 更新持久化表单值
    formValues.value = {
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      autoSync: config.autoSync,
      syncInterval: config.syncInterval,
      iconSource: config.iconSource,
    }
    
    lastSyncTime.value = config.lastSyncTime
  } catch (error) {
    console.error('Failed to load config:', error)
  } finally {
    isLoading.value = false
  }
})

const onSubmit = async () => {
  if (!hasChanges.value) return
  
  isSaving.value = true
  saveButtonText.value = '保存中...'
  
  try {
    await StorageService.saveConfig({
      serverUrl: formValues.value.serverUrl,
      apiKey: formValues.value.apiKey,
      autoSync: formValues.value.autoSync,
      syncInterval: formValues.value.syncInterval,
      iconSource: formValues.value.iconSource,
    })
    
    // 更新 API 实例以使用新的配置
    await SinanApiService.refreshInstance()
    
    originalConfig.value = { ...formValues.value }
    saveButtonText.value = '保存成功'
    setTimeout(() => {
      saveButtonText.value = '保存'
    }, 2000)
  } catch (error) {
    console.error('Failed to save config:', error)
    saveButtonText.value = '保存失败'
    setTimeout(() => {
      saveButtonText.value = '保存'
    }, 2000)
  } finally {
    isSaving.value = false
  }
}

const handleSync = async () => {
  if (isSyncing.value) return
  
  isSyncing.value = true
  syncButtonText.value = '同步中...'
  syncAlert.value.show = false
  
  try {
    console.log('开始重新同步书签...')
    const result = await BookmarkService.resyncBookmarks()
    
    await StorageService.updateLastSyncTime()
    lastSyncTime.value = Date.now()
    
    const successMsg = `同步成功！删除了 ${result.deleted} 个旧文件夹，创建了 ${result.created} 个书签空间`
    console.log(successMsg)
    
    syncAlert.value = {
      show: true,
      type: 'success',
      message: successMsg
    }
    syncButtonText.value = '同步成功'
    
    setTimeout(() => {
      syncButtonText.value = '重新同步'
      syncAlert.value.show = false
    }, 5000)
  } catch (error) {
    const errorMsg = `重新同步失败: ${error instanceof Error ? error.message : String(error)}`
    console.error('重新同步过程中出错:', error)
    
    syncAlert.value = {
      show: true,
      type: 'error',
      message: errorMsg
    }
    syncButtonText.value = '同步失败'
    
    setTimeout(() => {
      syncButtonText.value = '重新同步'
      syncAlert.value.show = false
    }, 5000)
  } finally {
    isSyncing.value = false
  }
}

const handleOpenSinan = () => {
  const url = 'https://sinan.host'
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url })
  } else {
    // Fallback for development
    window.open(url, '_blank')
  }
}

const handleDeleteBookmarks = async () => {
  if (isDeleting.value) return
  
  isDeleting.value = true
  deleteButtonText.value = '删除中...'
  syncAlert.value.show = false
  
  try {
    console.log('删除Sinan书签目录...')
    const deletedCount = await BookmarkService.deleteAllSinanFolders()
    
    const successMsg = `成功删除 ${deletedCount} 个Sinan书签目录`
    console.log(successMsg)
    
    syncAlert.value = {
      show: true,
      type: 'success',
      message: successMsg
    }
    deleteButtonText.value = '删除成功'
    
    setTimeout(() => {
      deleteButtonText.value = '删除书签目录'
      syncAlert.value.show = false
    }, 5000)
  } catch (error) {
    const errorMsg = `删除书签目录失败: ${error instanceof Error ? error.message : String(error)}`
    console.error('删除书签目录时出错:', error)
    
    syncAlert.value = {
      show: true,
      type: 'error',
      message: errorMsg
    }
    deleteButtonText.value = '删除失败'
    
    setTimeout(() => {
      deleteButtonText.value = '删除书签目录'
      syncAlert.value.show = false
    }, 5000)
  } finally {
    isDeleting.value = false
  }
}
</script>


<template>
  <div :class="mode" class="min-h-full">
    <div class="p-6 w-[360px] bg-background shadow-lg border border-border flex flex-col gap-6">
      <!-- 标题 -->
      <div class="text-lg text-primary flex items-center justify-center">
        <span>Sinan 书签管理</span>
      </div>

      <!-- Tab导航 -->
      <Tabs default-value="main">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="main">基础功能</TabsTrigger>
          <TabsTrigger value="settings">系统配置</TabsTrigger>
        </TabsList>

        <!-- 基础功能页面 -->
        <TabsContent value="main" class="space-y-4">
          <!-- 操作按钮 -->
          <div class="flex flex-col gap-4">
            <Button class="w-full" variant="default" @click="handleOpenSinan">打开Sinan主页</Button>
            <div class="flex gap-2">
              <Button 
                class="flex-1" 
                variant="outline" 
                @click="handleSync"
                :disabled="isSyncing || isLoading || isDeleting"
              >
                {{ syncButtonText }}
              </Button>
              <Button 
                class="flex-1" 
                variant="destructive" 
                @click="handleDeleteBookmarks"
                :disabled="isDeleting || isLoading || isSyncing"
              >
                {{ deleteButtonText }}
              </Button>
            </div>
            
            <!-- 同步状态提示 -->
            <Alert v-if="syncAlert.show" :variant="syncAlert.type === 'error' ? 'destructive' : 'default'">
              <AlertDescription>
                {{ syncAlert.message }}
              </AlertDescription>
            </Alert>
          </div>

          <div class="border-b border-border" />

          <!-- 最后同步时间 -->
          <div class="text-xs text-muted-foreground text-center">最后同步时间：{{ lastSyncText }}</div>
        </TabsContent>

        <!-- 系统配置页面 -->
        <TabsContent value="settings" class="space-y-4">
          <!-- 表单区域 -->
          <div class="space-y-4">
            <!-- Sinan服务器地址 -->
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">服务地址</label>
              <Input 
                v-model="formValues.serverUrl" 
                placeholder="请输入服务器地址" 
                autocomplete="off" 
              />
            </div>

            <!-- 接口密钥地址 -->
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">接口密钥</label>
              <Input 
                v-model="formValues.apiKey" 
                type="password" 
                placeholder="请输入接口密钥" 
                autocomplete="off" 
              />
            </div>

            <!-- 图标来源设置 -->
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">图标来源</label>
              <Select 
                v-model="formValues.iconSource"
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择图标来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google-s2">Google S2 (智能回退)</SelectItem>
                  <SelectItem value="sinan">Sinan服务</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 自动同步和同步间隔 -->
            <div class="flex items-center justify-between gap-4">
              <!-- Switch 开关自动同步书签 -->
              <div class="flex items-center gap-2 space-y-0">
                <label class="text-sm text-foreground font-medium">自动同步</label>
                <Switch 
                  v-model="formValues.autoSync"
                />
              </div>

              <!-- 同步间隔时间 -->
              <div class="flex items-center gap-2 space-y-0">
                <label class="text-sm text-foreground font-medium">间隔</label>
                <Select 
                  v-model="formValues.syncInterval"
                >
                  <SelectTrigger class="w-20">
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                  </SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">分钟</span>
              </div>
            </div>

            <div>
              <Button 
                type="button" 
                class="w-full" 
                variant="default" 
                @click="onSubmit" 
                :disabled="isLoading || !hasChanges || isSaving"
              >
                {{ saveButtonText }}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

<style scoped></style>
