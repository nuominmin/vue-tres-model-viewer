<template>
  <div class="universal-model-viewer">
    <div ref="containerRef" class="viewer-container" :style="{ width, height }">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
        <p>{{ loadingText }}</p>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="error" class="error-overlay">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <h3>{{ error }}</h3>
          <p>{{ errorSubTitle }}</p>
          <button class="retry-button" @click="retryLoad">{{ retryText }}</button>
        </div>
      </div>
      
      <!-- 3D场景 -->
      <TresCanvas v-if="!loading && !error" v-bind="canvasOptions">
        <!-- 相机 -->
        <TresPerspectiveCamera 
          ref="cameraRef"
          :fov="cameraConfig.fov" 
          :aspect="1" 
          :near="cameraConfig.near" 
          :far="cameraConfig.far"
          :position="cameraPosition"
        />
        
        <!-- 光照系统 -->
        <TresAmbientLight 
          :color="lightingConfig.ambientColor" 
          :intensity="lightingIntensity.ambient"
        />
        
        <TresHemisphereLight 
          :color="lightingConfig.skyColor" 
          :ground-color="lightingConfig.groundColor" 
          :intensity="lightingIntensity.hemisphere"
          :position="lightingConfig.hemispherePosition"
        />
        
        <TresDirectionalLight 
          :color="lightingConfig.mainLightColor" 
          :intensity="lightingIntensity.directional"
          :position="lightingConfig.mainLightPosition"
          :cast-shadow="enableShadows"
        />
        
        <TresDirectionalLight 
          :color="lightingConfig.fillLightColor" 
          :intensity="lightingIntensity.fill"
          :position="lightingConfig.fillLightPosition"
          :cast-shadow="false"
        />
        
        <!-- 模型容器 -->
        <TresGroup ref="modelGroupRef">
          <primitive v-if="currentModel" :object="currentModel" />
        </TresGroup>
        
        <!-- 相机控制器 -->
        <OrbitControls
          ref="controlsRef"
          :enable-damping="controlsConfig.enableDamping"
          :damping-factor="controlsConfig.dampingFactor"
          :auto-rotate="autoRotate"
          :auto-rotate-speed="controlsConfig.autoRotateSpeed"
          :enable-zoom="controlsConfig.enableZoom"
          :enable-pan="controlsConfig.enablePan"
          :min-distance="controlsConfig.minDistance"
          :max-distance="controlsConfig.maxDistance"
        />
      </TresCanvas>
    </div>
    
    <!-- 控制面板 -->
    <div v-if="showControls" class="controls-panel" :class="controlsPanelClass">
      <div class="controls-wrapper" :style="{ gap: typeof controlsSpacing === 'number' ? `${controlsSpacing}px` : controlsSpacing }">
        <!-- 基础控制 -->
        <button @click="resetCamera" class="control-button" :title="resetCameraText">
          <span class="icon">🔄</span>
          {{ resetCameraText }}
        </button>
        
        <button @click="toggleWireframe" class="control-button" :title="wireframeText">
          <span class="icon">📐</span>
          {{ wireframe ? wireframeModeTexts.solid : wireframeModeTexts.wireframe }}
        </button>
        
        <button @click="toggleAutoRotate" class="control-button" :title="autoRotateText">
          <span class="icon">🔄</span>
          {{ autoRotate ? autoRotateTexts.stop : autoRotateTexts.start }}
        </button>
        
        <!-- 光照控制 -->
        <div v-if="enableLightingControl" class="dropdown">
          <button class="control-button dropdown-trigger">
            <span class="icon">💡</span>
            {{ lightingText }}
            <span class="dropdown-arrow">▼</span>
          </button>
          <div class="dropdown-menu">
            <button @click="setLightingMode('bright')" class="dropdown-item">
              {{ lightingModes.bright }}
            </button>
            <button @click="setLightingMode('normal')" class="dropdown-item">
              {{ lightingModes.normal }}
            </button>
            <button @click="setLightingMode('soft')" class="dropdown-item">
              {{ lightingModes.soft }}
            </button>
          </div>
        </div>
        
        <!-- 材质控制 -->
        <div v-if="enableMaterialControl" class="dropdown">
          <button class="control-button dropdown-trigger">
            <span class="icon">👁️</span>
            {{ materialText }}
            <span class="dropdown-arrow">▼</span>
          </button>
          <div class="dropdown-menu">
            <button @click="setMaterialMode('double')" class="dropdown-item">
              {{ materialModes.double }}
            </button>
            <button @click="setMaterialMode('front')" class="dropdown-item">
              {{ materialModes.front }}
            </button>
            <button @click="setMaterialMode('basic')" class="dropdown-item">
              {{ materialModes.basic }}
            </button>
          </div>
        </div>
        
        <!-- 调试控制 -->
        <template v-if="enableDebugMode">
          <button @click="showDebugInfo" class="control-button">
            <span class="icon">🐛</span>
            {{ debugTexts.info }}
          </button>
          
          <button @click="forceReapplyTextures" class="control-button">
            <span class="icon">🖼️</span>
            {{ debugTexts.reapplyTextures }}
          </button>
          
          <button @click="fixLeafMaterials" class="control-button">
            <span class="icon">🧪</span>
            {{ debugTexts.fixLeafMaterials }}
          </button>
          
          <button @click="disableAllTransparency" class="control-button primary">
            <span class="icon">👁️</span>
            {{ debugTexts.disableTransparency }}
          </button>
        </template>
        
        <!-- 自定义控制按钮插槽 -->
        <slot name="custom-controls" :model="currentModel" :loading="loading" :error="error"></slot>
      </div>
    </div>
    
    <!-- 自定义内容插槽 -->
    <slot name="overlay" :model="currentModel" :loading="loading" :error="error"></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, nextTick } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { OrbitControls } from '@tresjs/cientos';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// 贴图映射接口
export interface TextureMapping {
  source: string; // 原文件名
  target: string; // 目标URL
}

// 相机配置接口
export interface CameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
}

// 光照配置接口
export interface LightingConfig {
  ambientColor?: number;
  skyColor?: number;
  groundColor?: number;
  mainLightColor?: number;
  fillLightColor?: number;
  hemispherePosition?: [number, number, number];
  mainLightPosition?: [number, number, number];
  fillLightPosition?: [number, number, number];
}

// 控制器配置接口
export interface ControlsConfig {
  enableDamping?: boolean;
  dampingFactor?: number;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
}

// 文本配置接口
export interface TextConfig {
  loading?: string;
  errorSubTitle?: string;
  retry?: string;
  resetCamera?: string;
  wireframe?: string;
  autoRotate?: string;
  lighting?: string;
  material?: string;
  wireframeModes?: {
    solid: string;
    wireframe: string;
  };
  autoRotateTexts?: {
    start: string;
    stop: string;
  };
  lightingModes?: {
    bright: string;
    normal: string;
    soft: string;
  };
  materialModes?: {
    double: string;
    front: string;
    basic: string;
  };
  debugTexts?: {
    info: string;
    reapplyTextures: string;
    fixLeafMaterials: string;
    disableTransparency: string;
  };
}

// 主要Props接口
export interface Props {
  // 基础配置
  modelUrl?: string;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  
  // 功能开关
  showControls?: boolean;
  autoRotate?: boolean;
  enableShadows?: boolean;
  enableLightingControl?: boolean;
  enableMaterialControl?: boolean;
  enableDebugMode?: boolean;
  
  // 高级配置
  textureMapping?: TextureMapping[];
  cameraConfig?: CameraConfig;
  lightingConfig?: LightingConfig;
  controlsConfig?: ControlsConfig;
  
  // 默认模式
  defaultMaterialMode?: 'double' | 'front' | 'basic';
  defaultLightingMode?: 'bright' | 'normal' | 'soft';
  
  // 样式配置
  controlsPanelClass?: string;
  controlsSpacing?: number | string;
  
  // 文本配置（支持国际化）
  textConfig?: TextConfig;
  
  // 模型缩放配置
  modelScale?: number;
  autoFitModel?: boolean;
  
  // 性能配置
  enableCache?: boolean;
  maxTextureSize?: number;
  
  // 消息提示函数（可选，用于替代ant-design-vue的message）
  messageHandler?: {
    success: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface Emits {
  (e: 'error', error: string): void;
  (e: 'loaded', model: THREE.Object3D): void;
  (e: 'progress', progress: number): void;
  (e: 'camera-change', position: [number, number, number]): void;
  (e: 'material-change', mode: string): void;
  (e: 'lighting-change', mode: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  // 基础配置
  width: '100%',
  height: '400px',
  backgroundColor: '#f0f0f0',
  
  // 功能开关
  showControls: true,
  autoRotate: true,
  enableShadows: true,
  enableLightingControl: false,
  enableMaterialControl: false,
  enableDebugMode: false,
  
  // 高级配置
  textureMapping: () => [],
  cameraConfig: () => ({
    fov: 75,
    near: 0.1,
    far: 1000,
    position: [0, 0, 5]
  }),
  lightingConfig: () => ({
    ambientColor: 0xffffff,
    skyColor: 0xffffff,
    groundColor: 0x888888,
    mainLightColor: 0xffffff,
    fillLightColor: 0xffffff,
    hemispherePosition: [0, 20, 0],
    mainLightPosition: [5, 10, 7.5],
    fillLightPosition: [-3, 5, -5]
  }),
  controlsConfig: () => ({
    enableDamping: true,
    dampingFactor: 0.05,
    autoRotateSpeed: 2.0,
    enableZoom: true,
    enablePan: true,
    minDistance: 1,
    maxDistance: 100
  }),
  
  // 默认模式
  defaultMaterialMode: 'double',
  defaultLightingMode: 'normal',
  
  // 样式配置
  controlsPanelClass: '',
  controlsSpacing: 8,
  
  // 文本配置
  textConfig: () => ({
    loading: '正在加载模型...',
    errorSubTitle: '请检查模型文件是否正确',
    retry: '重新加载',
    resetCamera: '重置相机',
    wireframe: '线框模式',
    autoRotate: '自动旋转',
    lighting: '光照',
    material: '材质',
    wireframeModes: {
      solid: '实体',
      wireframe: '线框'
    },
    autoRotateTexts: {
      start: '开始旋转',
      stop: '停止旋转'
    },
    lightingModes: {
      bright: '明亮模式',
      normal: '标准模式',
      soft: '柔和模式'
    },
    materialModes: {
      double: '双面材质',
      front: '正面材质',
      basic: '基础材质'
    },
    debugTexts: {
      info: '调试信息',
      reapplyTextures: '重新应用贴图',
      fixLeafMaterials: '修复树叶材质',
      disableTransparency: '禁用透明度'
    }
  }),
  
  // 模型配置
  modelScale: 3,
  autoFitModel: true,
  
  // 性能配置
  enableCache: true,
  maxTextureSize: 2048
});

const emit = defineEmits<Emits>();

// 默认消息处理器
const defaultMessageHandler = {
  success: (msg: string) => console.log('✅', msg),
  warning: (msg: string) => console.warn('⚠️', msg),
  info: (msg: string) => console.info('ℹ️', msg),
  error: (msg: string) => console.error('❌', msg)
};

const message = computed(() => props.messageHandler || defaultMessageHandler);

// 响应式状态
const containerRef = ref<HTMLElement>();
const cameraRef = ref();
const controlsRef = ref();
const modelGroupRef = ref();
const loading = ref(false);
const error = ref('');
const wireframe = ref(false);
const autoRotate = ref(props.autoRotate);
const materialMode = ref<'double' | 'front' | 'basic'>(props.defaultMaterialMode);
const currentModel = shallowRef<THREE.Object3D | null>(null);

// 计算属性 - 配置合并
const cameraConfig = computed(() => ({
  fov: 75,
  near: 0.1,
  far: 1000,
  position: [0, 0, 5] as [number, number, number],
  ...props.cameraConfig
}));

const cameraPosition = ref<[number, number, number]>(cameraConfig.value.position);

const lightingConfig = computed(() => ({
  ambientColor: 0xffffff,
  skyColor: 0xffffff,
  groundColor: 0x888888,
  mainLightColor: 0xffffff,
  fillLightColor: 0xffffff,
  hemispherePosition: [0, 20, 0] as [number, number, number],
  mainLightPosition: [5, 10, 7.5] as [number, number, number],
  fillLightPosition: [-3, 5, -5] as [number, number, number],
  ...props.lightingConfig
}));

const controlsConfig = computed(() => ({
  enableDamping: true,
  dampingFactor: 0.05,
  autoRotateSpeed: 2.0,
  enableZoom: true,
  enablePan: true,
  minDistance: 1,
  maxDistance: 100,
  ...props.controlsConfig
}));

// 计算属性 - 文本配置
const textConfig = computed(() => ({
  loading: '正在加载模型...',
  errorSubTitle: '请检查模型文件是否正确',
  retry: '重新加载',
  resetCamera: '重置相机',
  wireframe: '线框模式',
  autoRotate: '自动旋转',
  lighting: '光照',
  material: '材质',
  wireframeModes: {
    solid: '实体',
    wireframe: '线框'
  },
  autoRotateTexts: {
    start: '开始旋转',
    stop: '停止旋转'
  },
  lightingModes: {
    bright: '明亮模式',
    normal: '标准模式',
    soft: '柔和模式'
  },
  materialModes: {
    double: '双面材质',
    front: '正面材质',
    basic: '基础材质'
  },
  debugTexts: {
    info: '调试信息',
    reapplyTextures: '重新应用贴图',
    fixLeafMaterials: '修复树叶材质',
    disableTransparency: '禁用透明度'
  },
  ...props.textConfig
}));

// 文本计算属性
const loadingText = computed(() => textConfig.value.loading);
const errorSubTitle = computed(() => textConfig.value.errorSubTitle);
const retryText = computed(() => textConfig.value.retry);
const resetCameraText = computed(() => textConfig.value.resetCamera);
const wireframeText = computed(() => textConfig.value.wireframe);
const autoRotateText = computed(() => textConfig.value.autoRotate);
const lightingText = computed(() => textConfig.value.lighting);
const materialText = computed(() => textConfig.value.material);
const wireframeModeTexts = computed(() => textConfig.value.wireframeModes);
const autoRotateTexts = computed(() => textConfig.value.autoRotateTexts);
const lightingModes = computed(() => textConfig.value.lightingModes);
const materialModes = computed(() => textConfig.value.materialModes);
const debugTexts = computed(() => textConfig.value.debugTexts);

// 贴图缓存，防止重复加载
const textureCache = new Map<string, THREE.Texture>();

console.log('🎯 Vue TresJS ModelViewer 初始化完成 v1.0.0');
console.log('Props检查:', props.modelUrl ? '有模型URL' : '无模型URL');

// TresJS Canvas 配置
const canvasOptions = computed(() => ({
  antialias: true,
  alpha: false,
  clearColor: props.backgroundColor,
  shadowMapEnabled: true,
  outputColorSpace: THREE.SRGBColorSpace,
}));

// 光照强度配置
const lightingIntensity = ref({
  ambient: 1.2,
  directional: 2.0,
  fill: 0.8,
  top: 0.6,
  hemisphere: 1.0,
  side: 0.5,
});

// 创建贴图加载管理器
const createTextureLoadingManager = () => {
  const manager = new THREE.LoadingManager();
  
  // 创建贴图映射表
  const textureMap = new Map<string, string>();
  if (props.textureMapping && props.textureMapping.length > 0) {
    console.log('=== 贴图映射配置 ===');
    props.textureMapping.forEach(mapping => {
      // 将原始文件名映射到目标URL
      textureMap.set(mapping.source, mapping.target);
      textureMap.set(mapping.source.toLowerCase(), mapping.target);
      
      // 映射不带路径的文件名
      const filename = mapping.source.split('/').pop() || mapping.source;
      textureMap.set(filename, mapping.target);
      textureMap.set(filename.toLowerCase(), mapping.target);
      
      console.log(`映射: ${mapping.source} -> ${mapping.target}`);
      console.log(`文件名映射: ${filename} -> ${mapping.target}`);
    });
    console.log('=== 贴图映射配置结束 ===');
  } else {
    console.log('警告: 没有配置贴图映射');
  }

  // 重写URL解析器 - 这是关键部分
  manager.setURLModifier((url: string) => {
    console.log(`原始贴图URL: ${url}`);
    
    // 提取文件名（去除路径）
    const filename = url.split('/').pop() || url;
    const lowerFilename = filename.toLowerCase();
    
    // 尝试匹配贴图映射
    if (textureMap.has(filename)) {
      const mappedUrl = textureMap.get(filename)!;
      console.log(`✅ 贴图路径替换成功: ${filename} -> ${mappedUrl}`);
      return mappedUrl;
    }
    
    if (textureMap.has(lowerFilename)) {
      const mappedUrl = textureMap.get(lowerFilename)!;
      console.log(`✅ 贴图路径替换成功 (小写): ${lowerFilename} -> ${mappedUrl}`);
      return mappedUrl;
    }
    
    // 尝试匹配完整的原始URL
    if (textureMap.has(url)) {
      const mappedUrl = textureMap.get(url)!;
      console.log(`✅ 完整URL替换成功: ${url} -> ${mappedUrl}`);
      return mappedUrl;
    }
    
    // 如果没有找到映射，返回原始URL（但会导致加载失败）
    console.log(`❌ 贴图路径未找到映射: ${url}`);
    console.log(`可用的映射键:`, Array.from(textureMap.keys()));
    return url;
  });

  // 处理贴图加载错误和跨域问题
  manager.onLoad = () => {
    console.log('✅ 所有资源加载完成');
  };
  
  manager.onError = (url) => {
    console.error('❌ 资源加载失败:', url);
  };

  return manager;
};

// 加载模型
const loadModel = async () => {
  if (!props.modelUrl) return;

  loading.value = true;
  error.value = '';

  try {
    // 移除之前的模型
    if (currentModel.value) {
      currentModel.value = null;
    }

    const fileExtension = props.modelUrl.split('.').pop()?.toLowerCase();
    let loader: GLTFLoader | OBJLoader | FBXLoader;

    // 创建自定义加载管理器来处理贴图路径替换
    const loadingManager = createTextureLoadingManager();

    // 设置贴图的跨域属性
    THREE.Cache.enabled = true;

    switch (fileExtension) {
      case 'gltf':
      case 'glb':
        loader = new GLTFLoader(loadingManager);
        break;
      case 'obj':
        loader = new OBJLoader(loadingManager);
        break;
      case 'fbx':
        loader = new FBXLoader(loadingManager);
        break;
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    // 加载模型
    const loadedModel = await new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(
        props.modelUrl!,
        (result: any) => {
          console.log('模型加载完成，开始处理贴图...');
          if (result.scene) {
            resolve(result.scene);
          } else {
            resolve(result);
          }
        },
        (progress) => {
          const progressPercent = progress.total > 0 ? (progress.loaded / progress.total * 100) : 0;
          console.log(`加载进度: ${progressPercent.toFixed(2)}%`);
          emit('progress', progressPercent);
        },
        (error) => {
          reject(error);
        }
      );
    });

    console.log('✅ 模型加载完成，开始处理材质和贴图...');
    
    // 调试模型贴图信息
    debugModelTextures(loadedModel);
    
    // 先处理材质，将MeshPhongMaterial转换为MeshStandardMaterial
    convertMaterials(loadedModel);
    
    // 应用双面材质和贴图处理
    applyModelSettings(loadedModel);
    
    // 手动应用贴图映射（确保贴图正确加载）
    applyTextureMapping(loadedModel);
    
    // 调整模型大小和位置
    fitModelToView(loadedModel);
    
    // 确保模型可见
    loadedModel.visible = true;
    loadedModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
        child.visible = true;
        console.log(`Mesh "${child.name}" 设置为可见`);
      }
    });
    
    // 设置当前模型（TresJS将通过reactive方式自动渲染）
    currentModel.value = loadedModel;
    
    console.log('✅ 模型已设置到TresJS并准备渲染');
    console.log('currentModel.value:', currentModel.value);
    console.log('模型最终位置:', loadedModel.position);
    console.log('模型缩放:', loadedModel.scale);
    console.log('模型是否可见:', loadedModel.visible);
    
    // 强制触发Vue的响应式更新
    nextTick(() => {
      console.log('🔄 nextTick后，currentModel状态:', !!currentModel.value);
      if (containerRef.value) {
        const rect = containerRef.value.getBoundingClientRect();
        console.log('🔄 容器尺寸:', rect.width, 'x', rect.height);
      }
    });
    
    loading.value = false;
    handleModelLoaded();
    
  } catch (err: any) {
    console.error('模型加载失败:', err);
    const errorMsg = err instanceof Error ? err.message : 'Model loading failed';
    error.value = errorMsg;
    handleModelError(errorMsg);
    loading.value = false;
  }
};

// 转换材质为标准材质
const convertMaterials = (model: THREE.Object3D) => {
  console.log('开始转换材质...');
  let convertedCount = 0;
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map(mat => {
          if (mat instanceof THREE.MeshPhongMaterial) {
            convertedCount++;
            console.log(`转换材质: ${mat.name || 'unnamed'} 从 MeshPhongMaterial 到 MeshStandardMaterial`);
            
            // 检查是否是树叶材质（通过名称或贴图判断）
            const isLeafMaterial = isLeafOrTransparentMaterial(mat, child.name);
            
            // 创建新的标准材质
            const standardMaterial = new THREE.MeshStandardMaterial({
              color: mat.color.getHex() === 0x000000 ? 0xffffff : mat.color,
              map: mat.map,
              normalMap: mat.normalMap,
              transparent: mat.transparent || isLeafMaterial,
              opacity: mat.opacity,
              side: isLeafMaterial ? THREE.DoubleSide : mat.side,
              alphaTest: mat.alphaTest || (isLeafMaterial ? 0.5 : 0),
              metalness: isLeafMaterial ? 0.0 : 0.1,
              roughness: isLeafMaterial ? 0.9 : 0.8,
              depthWrite: !isLeafMaterial,
            });
            
            // 复制名称
            standardMaterial.name = mat.name;
            
            // 如果是树叶材质，额外设置
            if (isLeafMaterial) {
              console.log(`检测到树叶材质: ${mat.name || 'unnamed'}，应用特殊设置`);
              standardMaterial.transparent = true;
              standardMaterial.alphaTest = 0.1;
              standardMaterial.side = THREE.DoubleSide;
              standardMaterial.depthWrite = true;
            }
            
            // 释放旧材质
            mat.dispose();
            
            return standardMaterial;
          }
          return mat;
        });
      } else if (child.material instanceof THREE.MeshPhongMaterial) {
        convertedCount++;
        console.log(`转换材质: ${child.material.name || 'unnamed'} 从 MeshPhongMaterial 到 MeshStandardMaterial`);
        
        const mat = child.material;
        const isLeafMaterial = isLeafOrTransparentMaterial(mat, child.name);
        
        const standardMaterial = new THREE.MeshStandardMaterial({
          color: mat.color.getHex() === 0x000000 ? 0xffffff : mat.color,
          map: mat.map,
          normalMap: mat.normalMap,
          transparent: mat.transparent || isLeafMaterial,
          opacity: mat.opacity,
          side: isLeafMaterial ? THREE.DoubleSide : mat.side,
          alphaTest: mat.alphaTest || (isLeafMaterial ? 0.5 : 0),
          metalness: isLeafMaterial ? 0.0 : 0.1,
          roughness: isLeafMaterial ? 0.9 : 0.8,
          depthWrite: !isLeafMaterial,
        });
        
        standardMaterial.name = mat.name;
        
        // 如果是树叶材质，额外设置
        if (isLeafMaterial) {
          console.log(`检测到树叶材质: ${mat.name || 'unnamed'}，应用特殊设置`);
          standardMaterial.transparent = true;
          standardMaterial.alphaTest = 0.1;
          standardMaterial.side = THREE.DoubleSide;
          standardMaterial.depthWrite = true;
        }
        
        mat.dispose();
        child.material = standardMaterial;
      }
    }
  });
  
  console.log(`材质转换完成，共转换 ${convertedCount} 个材质`);
};

// 应用模型设置
const applyModelSettings = (model: THREE.Object3D) => {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      
      // 设置材质模式
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (materialMode.value === 'double') {
              mat.side = THREE.DoubleSide;
            } else if (materialMode.value === 'front') {
              mat.side = THREE.FrontSide;
            }
            if ('wireframe' in mat) {
              (mat as any).wireframe = wireframe.value;
            }
          });
        } else {
          if (materialMode.value === 'double') {
            child.material.side = THREE.DoubleSide;
          } else if (materialMode.value === 'front') {
            child.material.side = THREE.FrontSide;
          }
          if ('wireframe' in child.material) {
            (child.material as any).wireframe = wireframe.value;
          }
        }
      }
    }
  });
};

// 智能材质类型分析器
const analyzeMaterialType = (material: THREE.Material, meshName?: string) => {
  const materialName = (material.name || '').toLowerCase();
  const objectName = (meshName || '').toLowerCase();
  
  // 分析材质类型的关键词权重
  const typeScores = {
    leaf: 0,
    trunk: 0,
    flower: 0,
    generic: 0
  };
  
  // 树叶材质关键词
  const leafKeywords = ['leaf', 'leaves', '叶子', '树叶', '叶', 'foliage', 'plant'];
  // 树干材质关键词  
  const trunkKeywords = ['trunk', 'bark', 'wood', '树干', '枝干', '枝', 'branch', 'stem'];
  // 花朵材质关键词
  const flowerKeywords = ['flower', 'petal', '花', '花朵', '花瓣', 'bloom', 'blossom'];
  
  // 计算各类型得分
  leafKeywords.forEach(keyword => {
    if (materialName.includes(keyword) || objectName.includes(keyword)) {
      typeScores.leaf += 10;
    }
  });
  
  trunkKeywords.forEach(keyword => {
    if (materialName.includes(keyword) || objectName.includes(keyword)) {
      typeScores.trunk += 10;
    }
  });
  
  flowerKeywords.forEach(keyword => {
    if (materialName.includes(keyword) || objectName.includes(keyword)) {
      typeScores.flower += 10;
    }
  });
  
  // 基于材质属性推测
  if (material.transparent || (material.opacity < 1.0)) {
    typeScores.leaf += 5;
    typeScores.flower += 3;
  }
  
  // 如果没有明确匹配，设为通用材质
  if (Math.max(...Object.values(typeScores)) === 0) {
    typeScores.generic = 1;
  }
  
  const maxScore = Math.max(...Object.values(typeScores));
  const detectedType = Object.keys(typeScores).find(key => typeScores[key as keyof typeof typeScores] === maxScore) as keyof typeof typeScores;
  
  return {
    type: detectedType,
    confidence: maxScore,
    scores: typeScores
  };
};

// 判断是否是树叶或透明材质
const isLeafOrTransparentMaterial = (material: THREE.Material, meshName?: string): boolean => {
  const analysis = analyzeMaterialType(material, meshName);
  
  const isLeafType = analysis.type === 'leaf' || analysis.type === 'flower';
  const hasTransparency = material.transparent || (material.opacity < 1.0);
  
  // 检查是否有植物相关的贴图映射
  let hasPlantTextures = false;
  if (props.textureMapping) {
    hasPlantTextures = props.textureMapping.some(mapping => {
      const sourceName = mapping.source.toLowerCase();
      return sourceName.includes('leaf') || sourceName.includes('叶') || 
             sourceName.includes('flower') || sourceName.includes('花') ||
             sourceName.includes('plant') || sourceName.includes('foliage');
    });
  }
  
  const result = isLeafType || (hasTransparency && hasPlantTextures);
  
  if (result) {
    console.log(`智能识别为树叶/透明材质: ${material.name || 'unnamed'} (类型: ${analysis.type}, 置信度: ${analysis.confidence}, 透明度: ${hasTransparency}, 植物贴图: ${hasPlantTextures})`);
  }
  
  return result;
};

// 调试模型贴图信息
const debugModelTextures = (object: THREE.Object3D) => {
  console.log('=== 模型贴图调试信息 ===');
  let meshCount = 0;
  let textureCount = 0;
  let leafMaterialCount = 0;
  
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;
      console.log(`Mesh ${meshCount}: ${child.name || 'unnamed'}`);
      
      if (Array.isArray(child.material)) {
        child.material.forEach((mat, index) => {
          const isLeaf = isLeafOrTransparentMaterial(mat, child.name);
          if (isLeaf) leafMaterialCount++;
          
          console.log(`  材质 ${index}:`, mat.constructor.name, isLeaf ? '(树叶材质)' : '');
          console.log(`    透明度: ${mat.transparent}, 不透明度: ${mat.opacity}, Alpha测试: ${mat.alphaTest}`);
          console.log(`    面渲染: ${mat.side === THREE.DoubleSide ? '双面' : mat.side === THREE.FrontSide ? '正面' : '背面'}`);
          
          if (mat.map) {
            textureCount++;
            const textureUrl = mat.map.image?.src || mat.map.source?.data?.src || '未知';
            console.log(`    漫反射贴图:`, textureUrl);
            console.log(`    贴图加载状态:`, mat.map.image?.complete ? '已加载' : '加载中');
            console.log(`    贴图尺寸:`, mat.map.image?.width || '未知', 'x', mat.map.image?.height || '未知');
            console.log(`    颜色空间:`, mat.map.colorSpace);
          } else {
            console.log(`    没有漫反射贴图`);
          }
          
          if (mat instanceof THREE.MeshStandardMaterial) {
            console.log(`    金属度: ${mat.metalness}, 粗糙度: ${mat.roughness}`);
            console.log(`    深度写入: ${mat.depthWrite}`);
          }
        });
      } else if (child.material) {
        const isLeaf = isLeafOrTransparentMaterial(child.material, child.name);
        if (isLeaf) leafMaterialCount++;
        
        console.log(`  材质:`, child.material.constructor.name, isLeaf ? '(树叶材质)' : '');
        console.log(`    透明度: ${child.material.transparent}, 不透明度: ${child.material.opacity}, Alpha测试: ${child.material.alphaTest}`);
        console.log(`    面渲染: ${child.material.side === THREE.DoubleSide ? '双面' : child.material.side === THREE.FrontSide ? '正面' : '背面'}`);
        
        if (child.material.map) {
          textureCount++;
          const textureUrl = child.material.map.image?.src || child.material.map.source?.data?.src || '未知';
          console.log(`    漫反射贴图:`, textureUrl);
          console.log(`    贴图加载状态:`, child.material.map.image?.complete ? '已加载' : '加载中');
          console.log(`    贴图尺寸:`, child.material.map.image?.width || '未知', 'x', child.material.map.image?.height || '未知');
          console.log(`    颜色空间:`, child.material.map.colorSpace);
        } else {
          console.log(`    没有漫反射贴图`);
        }
        
        if (child.material instanceof THREE.MeshStandardMaterial) {
          console.log(`    金属度: ${child.material.metalness}, 粗糙度: ${child.material.roughness}`);
          console.log(`    深度写入: ${child.material.depthWrite}`);
        }
      }
    }
  });
  
  console.log(`总计: ${meshCount} 个Mesh, ${textureCount} 个贴图, ${leafMaterialCount} 个树叶材质`);
  console.log('=== 调试信息结束 ===');
};

// 手动应用贴图映射
const applyTextureMapping = (object: THREE.Object3D) => {
  if (!props.textureMapping || props.textureMapping.length === 0) {
    console.log('没有配置贴图映射，跳过手动应用');
    return;
  }
  
  console.log('=== 开始手动应用贴图映射 ===');
  
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      console.log(`处理Mesh: ${child.name || 'unnamed'}`);
      
      if (Array.isArray(child.material)) {
        child.material.forEach((mat, index) => {
          applyTexturesToMaterial(mat, index, child.name);
        });
      } else if (child.material) {
        applyTexturesToMaterial(child.material, 0, child.name);
      }
    }
  });
  
  console.log('=== 手动应用贴图映射完成 ===');
};

// 为材质应用贴图
const applyTexturesToMaterial = (material: THREE.Material, materialIndex: number, meshName?: string) => {
  console.log(`为材质 ${materialIndex} 应用贴图 (Mesh: ${meshName || 'unknown'})`);
  
  if (!props.textureMapping || props.textureMapping.length === 0) {
    return;
  }
  
  // 如果材质已经有贴图，检查是否需要替换
  const meshMaterial = material as any;
  if (meshMaterial.map && meshMaterial.map.image?.src) {
    console.log(`材质已有贴图: ${meshMaterial.map.image.src}`);
    // 如果贴图加载失败，尝试替换
    if (!meshMaterial.map.image.complete || meshMaterial.map.image.naturalWidth === 0) {
      console.log('贴图加载失败，尝试替换...');
      replaceTexture(material, materialIndex, meshName);
    }
    return;
  }
  
  // 尝试为没有贴图的材质添加贴图
  replaceTexture(material, materialIndex, meshName);
};

// 替换贴图
const replaceTexture = (material: THREE.Material, materialIndex: number, meshName?: string) => {
  console.log(`开始为材质 ${materialIndex} (${material.name || 'unnamed'}) 查找贴图`);
  
  // 获取材质相关的所有贴图
  const materialTextures = findTexturesForMaterial(material, materialIndex, meshName);
  
  if (materialTextures.albedo || materialTextures.opacity) {
    console.log(`找到材质贴图:`, materialTextures);
    loadAndApplyMultipleTextures(materialTextures, material);
  } else {
    console.log(`材质 ${materialIndex} 没有找到贴图映射`);
  }
};

// FBX贴图路径分析器
const analyzeFBXTexturePath = (texturePath: string) => {
  const fileName = texturePath.split('/').pop()?.toLowerCase() || texturePath.toLowerCase();
  
  const channelPatterns = {
    baseColor: [
      /base.*color/i, /diffuse/i, /albedo/i, /color/i, /_c\./i, /_col\./i,
      /^(?!.*normal)(?!.*rough)(?!.*metal)(?!.*spec)(?!.*occ)(?!.*ao)(?!.*opacity)(?!.*alpha).*\.(jpg|jpeg|png|tga|bmp)$/i
    ],
    normal: [
      /normal/i, /norm/i, /bump/i, /_n\./i, /_nrm\./i, /_normal\./i
    ],
    roughness: [
      /rough/i, /roughness/i, /_r\./i, /_rough\./i
    ],
    metalness: [
      /metal/i, /metallic/i, /metalness/i, /_m\./i, /_met\./i, /_metal\./i
    ],
    opacity: [
      /opacity/i, /alpha/i, /transparent/i, /mask/i, /_o\./i, /_a\./i, /_alpha\./i, /_opacity\./i
    ],
    specular: [
      /spec/i, /specular/i, /gloss/i, /glossiness/i, /_s\./i, /_spec\./i, /_gloss\./i
    ],
    emissive: [
      /emissive/i, /emission/i, /glow/i, /_e\./i, /_emit\./i
    ],
    ao: [
      /ao/i, /ambient.*occlusion/i, /occlusion/i, /_ao\./i, /_occ\./i
    ]
  };
  
  const scores: Record<string, number> = {};
  
  Object.entries(channelPatterns).forEach(([channel, patterns]) => {
    scores[channel] = 0;
    patterns.forEach(pattern => {
      if (pattern.test(fileName)) {
        scores[channel] += 10;
      }
    });
  });
  
  if (Math.max(...Object.values(scores)) === 0) {
    if (/\.(jpg|jpeg|png|tga|bmp)$/i.test(fileName)) {
      scores.baseColor = 1;
    }
  }
  
  const maxScore = Math.max(...Object.values(scores));
  const detectedChannel = Object.keys(scores).find(key => scores[key] === maxScore) || 'baseColor';
  
  return {
    channel: detectedChannel,
    confidence: maxScore,
    scores: scores,
    fileName: fileName
  };
};

// 基于FBX材质通道的贴图查找
const findTexturesForMaterial = (material: THREE.Material, materialIndex: number, meshName?: string) => {
  console.log(`\n=== 开始FBX材质通道分析: ${material.name || 'unnamed'} ===`);
  
  const result = {
    albedo: null as string | null,
    opacity: null as string | null,
    glossiness: null as string | null,
    normal: null as string | null
  };
  
  if (!props.textureMapping || props.textureMapping.length === 0) {
    console.log(`没有可用的贴图映射`);
    return result;
  }
  
  // 分析所有可用贴图的通道类型
  const textureAnalysis = props.textureMapping.map(mapping => ({
    ...mapping,
    analysis: analyzeFBXTexturePath(mapping.source)
  }));
  
  console.log(`贴图通道分析结果:`);
  textureAnalysis.forEach(t => {
    console.log(`  ${t.source} -> ${t.analysis.channel} (置信度: ${t.analysis.confidence})`);
  });
  
  // 材质类型分析
  const materialAnalysis = analyzeMaterialType(material, meshName);
  console.log(`材质类型: ${materialAnalysis.type} (置信度: ${materialAnalysis.confidence})`);
  
  // 根据材质类型筛选相关贴图
  let relevantTextures = textureAnalysis;
  if (materialAnalysis.type !== 'generic') {
    const materialKeywords = {
      leaf: ['leaf', '叶'],
      trunk: ['trunk', 'bark', '枝干', 'petiole'],
      flower: ['flower', '花']
    };
    
    const keywords = materialKeywords[materialAnalysis.type as keyof typeof materialKeywords] || [];
    const filtered = textureAnalysis.filter(texture => {
      const sourceName = texture.source.toLowerCase();
      return keywords.some(keyword => sourceName.includes(keyword));
    });
    
    if (filtered.length > 0) {
      relevantTextures = filtered;
      console.log(`根据材质类型筛选出 ${filtered.length} 个相关贴图`);
    }
  }
  
  // 重新按通道分组（仅相关贴图）
  const relevantByChannel = {
    baseColor: relevantTextures.filter(t => t.analysis.channel === 'baseColor'),
    opacity: relevantTextures.filter(t => t.analysis.channel === 'opacity'),
    normal: relevantTextures.filter(t => t.analysis.channel === 'normal'),
    roughness: relevantTextures.filter(t => t.analysis.channel === 'roughness'),
    specular: relevantTextures.filter(t => t.analysis.channel === 'specular')
  };
  
  // 分配贴图到结果
  if (relevantByChannel.baseColor.length > 0) {
    const index = materialIndex % relevantByChannel.baseColor.length;
    result.albedo = relevantByChannel.baseColor[index].target;
    console.log(`✅ 分配baseColor: ${relevantByChannel.baseColor[index].source}`);
  }
  
  if (relevantByChannel.opacity.length > 0) {
    result.opacity = relevantByChannel.opacity[0].target;
    console.log(`✅ 分配opacity: ${relevantByChannel.opacity[0].source}`);
  }
  
  if (relevantByChannel.normal.length > 0) {
    result.normal = relevantByChannel.normal[0].target;
    console.log(`✅ 分配normal: ${relevantByChannel.normal[0].source}`);
  }
  
  if (relevantByChannel.roughness.length > 0 || relevantByChannel.specular.length > 0) {
    const roughnessTexture = relevantByChannel.roughness[0] || relevantByChannel.specular[0];
    result.glossiness = roughnessTexture.target;
    console.log(`✅ 分配roughness/specular: ${roughnessTexture.source}`);
  }
  
  // 如果没有找到baseColor，尝试使用任何可用的贴图
  if (!result.albedo && relevantTextures.length > 0) {
    const fallbackTexture = relevantTextures[materialIndex % relevantTextures.length];
    result.albedo = fallbackTexture.target;
    console.log(`⚠️ 使用fallback贴图: ${fallbackTexture.source}`);
  }
  
  console.log(`=== 材质 ${material.name || 'unnamed'} 贴图分配完成 ===\n`);
  return result;
};

// 加载贴图（带缓存）
const loadTextureWithCache = (url: string, isAlphaTexture: boolean = false): Promise<THREE.Texture> => {
  return new Promise((resolve, reject) => {
    // 检查缓存
    if (textureCache.has(url)) {
      console.log(`✅ 使用缓存贴图: ${url}`);
      resolve(textureCache.get(url)!);
      return;
    }
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    
    textureLoader.load(
      url,
      (texture) => {
        console.log(`✅ 贴图加载成功: ${url}`);
        setupTextureProperties(texture, isAlphaTexture);
        
        // 缓存贴图
        textureCache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (error) => {
        console.error(`❌ 贴图加载失败: ${url}`, error);
        reject(error);
      }
    );
  });
};

// 加载并应用多种贴图
const loadAndApplyMultipleTextures = (textures: {
  albedo: string | null;
  opacity: string | null;
  glossiness: string | null;
  normal: string | null;
}, material: THREE.Material) => {
  console.log(`开始为材质 ${material.name || 'unnamed'} 加载多种贴图:`, textures);
  
  const isLeafMaterial = isLeafOrTransparentMaterial(material);
  
  // 加载漫反射贴图
  if (textures.albedo) {
    loadTextureWithCache(textures.albedo, false).then(texture => {
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
        material.map = texture;
        material.color.setHex(0xFFFFFF);
        material.needsUpdate = true;
        console.log(`✅ 漫反射贴图已应用到材质: ${material.name || 'unnamed'}`);
      }
    }).catch(error => {
      console.error(`❌ 漫反射贴图应用失败: ${textures.albedo}`, error);
    });
  }
  
  // 加载透明度贴图
  if (textures.opacity) {
    loadTextureWithCache(textures.opacity, true).then(texture => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.alphaMap = texture;
        material.transparent = true;
        material.alphaTest = 0.1;
        material.side = THREE.DoubleSide;
        material.depthWrite = true;
        material.needsUpdate = true;
        console.log(`✅ 透明度贴图已应用到材质: ${material.name || 'unnamed'}`);
      }
    }).catch(error => {
      console.error(`❌ 透明度贴图应用失败: ${textures.opacity}`, error);
    });
  }
  
  // 加载光泽度贴图
  if (textures.glossiness && material instanceof THREE.MeshStandardMaterial) {
    loadTextureWithCache(textures.glossiness, false).then(texture => {
      material.roughnessMap = texture;
      material.roughness = 1.0;
      material.needsUpdate = true;
      console.log(`✅ 光泽度贴图已应用到材质: ${material.name || 'unnamed'}`);
    }).catch(error => {
      console.error(`❌ 光泽度贴图应用失败: ${textures.glossiness}`, error);
    });
  }
  
  // 加载法线贴图
  if (textures.normal && material instanceof THREE.MeshStandardMaterial) {
    loadTextureWithCache(textures.normal, false).then(texture => {
      material.normalMap = texture;
      material.needsUpdate = true;
      console.log(`✅ 法线贴图已应用到材质: ${material.name || 'unnamed'}`);
    }).catch(error => {
      console.error(`❌ 法线贴图应用失败: ${textures.normal}`, error);
    });
  }
  
  // 如果是树叶材质但没有透明度贴图，设置基本透明度
  if (isLeafMaterial && !textures.opacity && material instanceof THREE.MeshStandardMaterial) {
    console.log(`树叶材质没有透明度贴图，设置基本透明度配置`);
    material.transparent = false;
    material.alphaTest = 0.0;
    material.side = THREE.DoubleSide;
    material.depthWrite = true;
    material.needsUpdate = true;
  }
  
  // 强制触发重新渲染
  if (currentModel.value) {
    currentModel.value.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          if (child.material.includes(material as any)) {
            child.material.forEach(mat => mat.needsUpdate = true);
          }
        } else if (child.material === material) {
          child.material.needsUpdate = true;
        }
      }
    });
  }
};

// 设置贴图属性
const setupTextureProperties = (texture: THREE.Texture, isAlphaTexture: boolean = false) => {
  if (isAlphaTexture) {
    texture.colorSpace = THREE.LinearSRGBColorSpace;
  } else {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = false;
  texture.flipY = false;
  texture.needsUpdate = true;
};

// 调整模型大小和位置
const fitModelToView = (model: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  console.log(`模型尺寸: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
  console.log(`模型中心点: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
  console.log(`最大尺寸: ${maxDimension.toFixed(2)}`);

  if (props.autoFitModel) {
    let scale = 1;
    if (maxDimension > 2) {
      scale = 2 / maxDimension;
    }
    
    scale *= props.modelScale;
    
    model.scale.setScalar(scale);
    console.log(`模型已自动缩放: ${scale.toFixed(6)} (用户缩放: ${props.modelScale})`);
  } else {
    model.scale.setScalar(props.modelScale);
    console.log(`模型已应用用户缩放: ${props.modelScale}`);
  }
  
  // 重新计算缩放后的包围盒和中心点
  box.setFromObject(model);
  center.copy(box.getCenter(new THREE.Vector3()));
  
  // 将模型移动到原点
  model.position.set(-center.x, -center.y, -center.z);
  
  console.log(`模型已居中，位置: ${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)}`);
};

// 重新加载
const retryLoad = () => {
  loadModel();
};

// 重置相机
const resetCamera = () => {
  try {
    cameraPosition.value = [...cameraConfig.value.position];
    
    if (controlsRef.value && controlsRef.value.target) {
      controlsRef.value.target.set(0, 0, 0);
      if (typeof controlsRef.value.update === 'function') {
        controlsRef.value.update();
      }
    }
    
    emit('camera-change', cameraPosition.value);
    console.log('相机已重置到初始位置:', cameraPosition.value);
  } catch (error) {
    console.error('重置相机失败:', error);
  }
};

// 切换线框模式
const toggleWireframe = () => {
  wireframe.value = !wireframe.value;
  if (currentModel.value) {
    applyModelSettings(currentModel.value);
  }
};

// 切换自动旋转
const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value;
};

// 设置光照模式
const setLightingMode = (mode: 'bright' | 'normal' | 'soft') => {
  switch (mode) {
    case 'bright':
      lightingIntensity.value.ambient = 1.8;
      lightingIntensity.value.hemisphere = 1.5;
      lightingIntensity.value.directional = 2.5;
      lightingIntensity.value.fill = 1.0;
      message.value.success(lightingModes.value.bright);
      break;
    case 'normal':
      lightingIntensity.value.ambient = 1.2;
      lightingIntensity.value.hemisphere = 1.0;
      lightingIntensity.value.directional = 2.0;
      lightingIntensity.value.fill = 0.8;
      message.value.success(lightingModes.value.normal);
      break;
    case 'soft':
      lightingIntensity.value.ambient = 0.8;
      lightingIntensity.value.hemisphere = 0.7;
      lightingIntensity.value.directional = 1.2;
      lightingIntensity.value.fill = 0.5;
      message.value.success(lightingModes.value.soft);
      break;
  }
  
  emit('lighting-change', mode);
};

// 设置材质模式
const setMaterialMode = (mode: 'double' | 'front' | 'basic') => {
  materialMode.value = mode;
  
  if (currentModel.value) {
    applyModelSettings(currentModel.value);
  }
  
  emit('material-change', mode);
  
  switch (mode) {
    case 'double':
      message.value.success(materialModes.value.double);
      break;
    case 'front':
      message.value.success(materialModes.value.front);
      break;
    case 'basic':
      message.value.success(materialModes.value.basic);
      break;
  }
};

// 显示调试信息
const showDebugInfo = () => {
  console.log('=== Vue TresJS ModelViewer 调试信息 ===');
  console.log('模型URL:', props.modelUrl);
  console.log('当前模型:', currentModel.value);
  console.log('贴图映射数量:', props.textureMapping?.length || 0);
  console.log('当前材质模式:', materialMode.value);
  console.log('相机位置:', cameraPosition.value);
  console.log('自动旋转:', autoRotate.value);
  console.log('线框模式:', wireframe.value);
  console.log('光照强度:', lightingIntensity.value);
  
  if (props.textureMapping && props.textureMapping.length > 0) {
    console.log('贴图映射详情:');
    props.textureMapping.forEach((mapping, index) => {
      console.log(`  ${index}: ${mapping.source} -> ${mapping.target}`);
    });
  }
  
  if (currentModel.value) {
    console.log('模型统计:');
    let meshCount = 0;
    let materialCount = 0;
    currentModel.value.traverse((child) => {
    if (child instanceof THREE.Mesh) {
        meshCount++;
      if (Array.isArray(child.material)) {
          materialCount += child.material.length;
      } else if (child.material) {
          materialCount++;
      }
    }
  });
    console.log(`  Mesh数量: ${meshCount}`);
    console.log(`  材质数量: ${materialCount}`);
  }
  
  message.value.info('Debug information has been output to the console, please press F12 to view');
};

// 强制重新应用贴图
const forceReapplyTextures = () => {
  if (!props.textureMapping || props.textureMapping.length === 0) {
    message.value.warning('No texture mapping configured');
    return;
  }
  
  if (!currentModel.value) {
    message.value.warning('No loaded model');
    return;
  }
  
  console.log('=== 强制重新应用贴图 ===');
  applyTextureMapping(currentModel.value);
  message.value.success('Reapplying textures...');
};

// 修复树叶材质
const fixLeafMaterials = () => {
  if (!currentModel.value) {
    message.value.warning('No loaded model');
    return;
  }
  
  console.log('=== 开始修复树叶材质 ===');
  let fixedCount = 0;
  
  currentModel.value.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat, index) => {
          if (isLeafOrTransparentMaterial(mat, child.name)) {
            fixedCount++;
            applyLeafMaterialFix(mat, `${child.name || 'unnamed'}_${index}`);
          }
        });
      } else if (child.material && isLeafOrTransparentMaterial(child.material, child.name)) {
        fixedCount++;
        applyLeafMaterialFix(child.material, child.name || 'unnamed');
      }
    }
  });
  
  console.log(`=== 树叶材质修复完成，共修复 ${fixedCount} 个材质 ===`);
  message.value.success(`Fixed ${fixedCount} leaf materials`);
};

// 应用树叶材质修复
const applyLeafMaterialFix = (material: THREE.Material, name: string) => {
  console.log(`修复树叶材质: ${name}`);
  
  if (material instanceof THREE.MeshStandardMaterial) {
    material.transparent = true;
    material.alphaTest = 0.5;
    material.side = THREE.DoubleSide;
    material.depthWrite = false;
    material.metalness = 0.0;
    material.roughness = 0.9;
    material.color.setHex(0xFFFFFF);
    
    if (!material.map) {
      material.color.setHex(0x90EE90);
      console.log(`为 ${name} 设置默认绿色`);
    }
    
    material.needsUpdate = true;
    console.log(`✅ 树叶材质修复完成: ${name}`);
  } else {
    console.log(`材质 ${name} 不是 MeshStandardMaterial，跳过修复`);
  }
};

// 禁用所有材质的透明度
const disableAllTransparency = () => {
  if (!currentModel.value) {
    message.value.warning('No loaded model');
    return;
  }
  
  console.log('=== 开始禁用所有材质的透明度 ===');
  let processedCount = 0;
  
  currentModel.value.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat, index) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            processedCount++;
            mat.transparent = false;
            mat.alphaTest = 0.0;
            mat.alphaMap = null;
            mat.depthWrite = true;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            console.log(`禁用材质透明度: ${mat.name || 'unnamed'}_${index}`);
          }
        });
      } else if (child.material instanceof THREE.MeshStandardMaterial) {
        processedCount++;
        child.material.transparent = false;
        child.material.alphaTest = 0.0;
        child.material.alphaMap = null;
        child.material.depthWrite = true;
        child.material.side = THREE.FrontSide;
        child.material.needsUpdate = true;
        console.log(`禁用材质透明度: ${child.material.name || 'unnamed'}`);
      }
    }
  });
  
  console.log(`=== 透明度禁用完成，共处理 ${processedCount} 个材质 ===`);
  message.value.success(`Disabled transparency for ${processedCount} materials, model should reappear`);
};

// 处理模型加载完成
const handleModelLoaded = () => {
  loading.value = false;
  error.value = '';
  if (currentModel.value) {
    emit('loaded', currentModel.value);
  }
  message.value.success('Model loaded successfully');
};

// 处理模型加载错误
const handleModelError = (errorMsg: string) => {
  loading.value = false;
  error.value = errorMsg;
  emit('error', errorMsg);
};

// 监听模型URL变化
watch(() => props.modelUrl, (newUrl, oldUrl) => {
  if (newUrl && newUrl !== oldUrl) {
    console.log('模型URL发生变化，重新加载:', newUrl);
    currentModel.value = null;
    loadModel();
  }
});

// 组件挂载
onMounted(async () => {
  await nextTick();
  console.log('=== Vue TresJS ModelViewer 组件挂载 ===');
  console.log('Props:', {
    modelUrl: props.modelUrl,
    width: props.width,
    height: props.height,
    backgroundColor: props.backgroundColor,
    textureMapping: props.textureMapping
  });
  console.log('相机初始位置:', cameraPosition.value);
  console.log('光照强度配置:', lightingIntensity.value);
  console.log('Canvas options:', canvasOptions.value);
  
  if (props.modelUrl) {
    console.log('🚀 开始加载模型:', props.modelUrl);
    loadModel();
  } else {
    console.log('❌ 没有模型URL，跳过加载');
  }
});
</script>

<style scoped>
.universal-model-viewer {
  position: relative;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.viewer-container {
  position: relative;
  background: #f0f0f0;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.loading-spinner {
  margin-bottom: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-overlay p {
  margin-top: 16px;
  color: #666;
}

.error-content {
  text-align: center;
  padding: 24px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-content h3 {
  margin: 0 0 8px 0;
  color: #ff4d4f;
  font-size: 18px;
}

.error-content p {
  margin: 0 0 16px 0;
  color: #666;
}

.retry-button {
  background: #1890ff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: #40a9ff;
}

.controls-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.controls-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.control-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.5;
  transition: all 0.2s;
}

.control-button:hover {
  border-color: #40a9ff;
  color: #40a9ff;
}

.control-button.primary {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.control-button.primary:hover {
  background: #40a9ff;
  border-color: #40a9ff;
}

.icon {
  font-size: 14px;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  position: relative;
}

.dropdown-arrow {
  margin-left: 4px;
  font-size: 10px;
  transition: transform 0.2s;
}

.dropdown:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 120px;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: all 0.2s;
}

.dropdown:hover .dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.dropdown-item:first-child {
  border-radius: 4px 4px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 4px 4px;
}
</style>
