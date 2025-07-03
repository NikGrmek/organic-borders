export default {
  root: '.',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    open: true
  },
  optimizeDeps: {
    include: ['file-saver']
  }
} 