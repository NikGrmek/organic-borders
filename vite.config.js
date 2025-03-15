export default {
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    open: true
  },
  optimizeDeps: {
    include: ['file-saver']
  }
} 