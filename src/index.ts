import ModelViewer from './ModelViewer.vue'
import type { 
  Props, 
  Emits, 
  TextureMapping, 
  CameraConfig, 
  LightingConfig, 
  ControlsConfig, 
  TextConfig 
} from './ModelViewer.vue'

// 导出组件
export default ModelViewer
export { ModelViewer }

// 导出类型
export type {
  Props as ModelViewerProps,
  Emits as ModelViewerEmits,
  TextureMapping,
  CameraConfig,
  LightingConfig,
  ControlsConfig,
  TextConfig
}

// Vue 插件安装函数
export const install = (app: any) => {
  app.component('ModelViewer', ModelViewer)
}

// 支持 Vue.use() 方式安装
ModelViewer.install = install
