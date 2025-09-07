import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      copyDtsFiles: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueTresModelViewer',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`
    },
    rollupOptions: {
      external: ['vue', '@tresjs/core', '@tresjs/cientos', 'three'],
      output: {
        globals: {
          vue: 'Vue',
          '@tresjs/core': 'TresCore',
          '@tresjs/cientos': 'TresCientos',
          three: 'THREE'
        }
      }
    }
  }
})
