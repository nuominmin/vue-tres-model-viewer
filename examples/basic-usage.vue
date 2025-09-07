<template>
  <div class="example-container">
    <h1>Vue TresJS 3D模型查看器 - 基础用法</h1>
    
    <div class="usage-info">
      <h3>📋 使用说明</h3>
      <ul>
        <li><strong>📁 文件放置：</strong>将3D模型文件放在 <code>public/model/</code> 目录下</li>
        <li><strong>🔗 路径格式：</strong>使用HTTP路径格式，例如：<code>/public/model/芭蕉.FBX</code></li>
        <li><strong>📂 文件选择：</strong>点击"选择本地文件"会自动生成正确的HTTP路径</li>
        <li><strong>🎨 贴图映射：</strong>贴图文件也需要放在同一目录下，路径格式：<code>/public/model/贴图文件名.jpg</code></li>
        <li><strong>📋 支持格式：</strong>FBX, OBJ, GLTF, GLB 等3D模型格式</li>
      </ul>
    </div>
    
    <div class="controls">
      <div class="control-group">
        <label>
          模型文件路径:
          <input v-model="modelUrl" type="text" placeholder="输入本地文件路径或URL" class="file-input" />
        </label>
      </div>
      
      <div class="control-group">
        <label>
          贴图映射数据 (JSON格式):
          <textarea 
            v-model="textureMappingJson" 
            placeholder='输入贴图映射JSON数据，例如：[{"source":"texture.jpg","target":"E:\\path\\to\\texture.jpg"}]'
            class="texture-mapping-input"
            rows="4"
          ></textarea>
        </label>
        <button @click="parseTextureMapping" class="parse-button">解析贴图数据</button>
      </div>
      
      <div class="checkbox-group">
        <label>
          <input v-model="enableDebugMode" type="checkbox" />
          启用调试模式
        </label>
        
        <label>
          <input v-model="enableLightingControl" type="checkbox" />
          启用光照控制
        </label>
        
        <label>
          <input v-model="enableMaterialControl" type="checkbox" />
          启用材质控制
        </label>
      </div>
    </div>

    <ModelViewer
      :model-url="modelUrl"
      :width="800"
      :height="600"
      :texture-mapping="textureMapping"
      :enable-debug-mode="enableDebugMode"
      :enable-lighting-control="enableLightingControl"
      :enable-material-control="enableMaterialControl"
      :text-config="textConfig"
      :message-handler="messageHandler"
      @loaded="onModelLoaded"
      @error="onModelError"
      @progress="onProgress"
    >
      <template #custom-controls="{ model, loading }">
        <button v-if="!loading && model" @click="exportModel" class="custom-button">
          导出模型信息
        </button>
      </template>
      
      <template #overlay="{ loading, error }">
        <div v-if="loading" class="custom-overlay">
          <p>加载进度: {{ progress }}%</p>
        </div>
      </template>
    </ModelViewer>

    <div class="info-panel">
      <h3>模型信息</h3>
      <pre>{{ modelInfo }}</pre>
    </div>

    <div class="preview-panel">
      <h3>模型预览</h3>
      <div class="preview-container">
        <ModelViewer
          :model-url="modelUrl"
          :width="'100%'"
          :height="'400px'"
          :texture-mapping="textureMapping"
          :enable-debug-mode="false"
          :enable-lighting-control="false"
          :enable-material-control="false"
          :text-config="previewTextConfig"
          @loaded="onPreviewLoaded"
          @error="onPreviewError"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ModelViewer } from '../src/index'
import type { TextureMapping, TextConfig } from '../src/index'

// Reactive state
const modelUrl = ref('model/芭蕉.FBX')
const enableDebugMode = ref(true)
const enableLightingControl = ref(true)
const enableMaterialControl = ref(true)
const progress = ref(0)
const modelInfo = ref('')

// Texture mapping configuration
const textureMapping = ref<TextureMapping[]>([
  {"source":"3d66Model-18745261-files-005.jpg","target":"model/3d66Model-18745261-files-005.jpg"},
  {"source":"3d66Model-18745261-files-006.png","target":"model/3d66Model-18745261-files-006.png"}
])

// JSON字符串用于编辑贴图映射
const textureMappingJson = ref(JSON.stringify(textureMapping.value, null, 2))

// 自定义文本配置
const textConfig: TextConfig = {
  loading: '正在加载3D模型...',
  errorSubTitle: '请检查模型文件路径和格式',
  retry: '重试',
  resetCamera: '重置视图',
  wireframe: '线框模式',
  autoRotate: '自动旋转',
  lighting: '光照设置',
  material: '材质设置'
}

// 预览模式的文本配置
const previewTextConfig: TextConfig = {
  loading: '正在加载预览...',
  errorSubTitle: '预览加载失败',
  retry: '重新加载',
  resetCamera: '重置视图',
  wireframe: '线框',
  autoRotate: '旋转',
  lighting: '光照',
  material: '材质'
}

// 自定义消息处理器（演示用浏览器控制台）
const messageHandler = {
  success: (msg: string) => {
    console.log('✅ 成功:', msg)
    // 你可以替换为你喜欢的通知库
    // 例如：ElMessage.success(msg) for Element Plus
  },
  warning: (msg: string) => {
    console.warn('⚠️ 警告:', msg)
  },
  info: (msg: string) => {
    console.info('ℹ️ 信息:', msg)
  },
  error: (msg: string) => {
    console.error('❌ 错误:', msg)
  }
}

// 事件处理器
const onModelLoaded = (model: any) => {
  console.log('模型加载成功:', model)
  
  // 提取模型信息
  let meshCount = 0
  let materialCount = 0
  
  model.traverse((child: any) => {
    if (child.isMesh) {
      meshCount++
      if (Array.isArray(child.material)) {
        materialCount += child.material.length
      } else if (child.material) {
        materialCount++
      }
    }
  })
  
  modelInfo.value = JSON.stringify({
    name: model.name || '未命名',
    meshCount,
    materialCount,
    position: model.position,
    scale: model.scale,
    rotation: model.rotation
  }, null, 2)
}

const onModelError = (error: string) => {
  console.error('模型加载失败:', error)
  modelInfo.value = `错误: ${error}`
}

const onProgress = (progressValue: number) => {
  progress.value = Math.round(progressValue)
}

// 选择本地文件
const selectLocalFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.fbx,.obj,.gltf,.glb'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const file = target.files[0]
      handleFileSelection(file)
    }
  }
  input.click()
}

// 处理文件选择
const handleFileSelection = async (file: File) => {
  const fileName = file.name
  const fileSize = (file.size / 1024 / 1024).toFixed(2) // MB
  const fileType = file.type || '未知类型'
  
  // 生成HTTP服务器路径
  // 基于public/model目录结构
  const suggestedPath = `model/${fileName}`
  
  // 设置建议的路径到输入框
  modelUrl.value = suggestedPath
  
  // 等待DOM更新
  await nextTick()
  
  // 添加调试信息
  console.log('文件名:', fileName)
  console.log('当前目录:', currentDir)
  console.log('建议路径:', suggestedPath)
  console.log('modelUrl.value已更新为:', modelUrl.value)
  
  messageHandler.success(`✅ 已填入建议路径：${fileName} (${fileSize}MB, ${fileType})`)
  messageHandler.info(`📁 建议路径：${suggestedPath}`)
  messageHandler.info('💡 如果路径不正确，请手动修改输入框中的路径')
}

// 处理文件拖拽
const handleFileDrop = (e: DragEvent) => {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files && files[0]) {
    handleFileSelection(files[0])
  }
}

// 解析贴图映射JSON数据
const parseTextureMapping = () => {
  try {
    const parsed = JSON.parse(textureMappingJson.value)
    if (Array.isArray(parsed)) {
      textureMapping.value = parsed
      messageHandler.success('贴图映射数据解析成功')
    } else {
      throw new Error('数据必须是数组格式')
    }
  } catch (error) {
    messageHandler.error(`贴图映射数据解析失败: ${error}`)
  }
}

// 预览加载成功处理
const onPreviewLoaded = (model: any) => {
  console.log('预览模型加载成功:', model)
  messageHandler.success('预览模型加载成功')
}

// 预览加载错误处理
const onPreviewError = (error: string) => {
  console.error('预览模型加载失败:', error)
  messageHandler.error(`预览加载失败: ${error}`)
}

const exportModel = () => {
  const data = {
    modelUrl: modelUrl.value,
    textureMapping: textureMapping.value,
    modelInfo: modelInfo.value,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'model-info.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.example-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 20px;
}

.usage-info {
  background: #e8f4fd;
  border: 1px solid #bee5eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.usage-info h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #0c5460;
}

.usage-info ul {
  margin: 0;
  padding-left: 20px;
}

.usage-info li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.usage-info code {
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #e83e8c;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 500;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.file-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 500px;
  font-family: monospace;
}

.texture-mapping-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 500px;
  font-family: monospace;
  resize: vertical;
}

.file-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.file-button, .parse-button {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.file-button:hover, .parse-button:hover {
  background: #218838;
}

.drop-zone {
  padding: 12px 16px;
  border: 2px dashed #007bff;
  border-radius: 4px;
  background: #f8f9fa;
  color: #007bff;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
  font-size: 14px;
}

.drop-zone:hover {
  background: #e3f2fd;
  border-color: #0056b3;
}

.drop-zone.drag-over {
  background: #e3f2fd;
  border-color: #0056b3;
  transform: scale(1.02);
}

.controls input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.custom-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.custom-button:hover {
  background: #0056b3;
}

.custom-overlay {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  font-size: 14px;
}

.info-panel {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.info-panel h3 {
  margin-top: 0;
  color: #495057;
}

.info-panel pre {
  background: white;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.4;
}

.preview-panel {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.preview-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-panel h3::before {
  content: '👁️';
  font-size: 1.2em;
}

.preview-container {
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
