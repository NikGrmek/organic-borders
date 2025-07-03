// Drag Debug Script
// Add this to your browser console to debug drag operations

console.log('Drag Debug Script Loaded');

// Override console.log to show in page
const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    
    // Also show on page if there's a debug element
    const debugEl = document.getElementById('debug-output');
    if (debugEl) {
        const logDiv = document.createElement('div');
        logDiv.style.cssText = 'margin: 2px 0; padding: 4px; background: #f0f0f0; border-radius: 2px; font-family: monospace; font-size: 12px;';
        logDiv.textContent = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        debugEl.appendChild(logDiv);
        debugEl.scrollTop = debugEl.scrollHeight;
    }
};

// Test function to check drag capabilities
function testDragCapabilities() {
    console.log('=== Drag Capabilities Test ===');
    
    // Check if DataTransfer is available
    console.log('DataTransfer available:', typeof DataTransfer !== 'undefined');
    
    // Check if File constructor is available
    console.log('File constructor available:', typeof File !== 'undefined');
    
    // Test creating a file
    try {
        const testBlob = new Blob(['test'], { type: 'text/plain' });
        const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' });
        console.log('File creation test:', testFile.name, testFile.size, 'bytes');
    } catch (error) {
        console.log('File creation error:', error.message);
    }
    
    // Check browser and version
    console.log('User Agent:', navigator.userAgent);
    
    // Check if we're in a secure context
    console.log('Secure context:', window.isSecureContext);
    
    // Check origin
    console.log('Origin:', window.location.origin);
}

// Function to monitor drag events globally
function monitorDragEvents() {
    console.log('=== Setting up drag event monitoring ===');
    
    const events = ['dragstart', 'drag', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'];
    
    events.forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            if (e.target.id === 'dragPsdBtn' || e.target.closest('#dragPsdBtn')) {
                console.log(`${eventName.toUpperCase()}:`, {
                    target: e.target.id || e.target.tagName,
                    types: e.dataTransfer ? Array.from(e.dataTransfer.types) : 'no dataTransfer',
                    files: e.dataTransfer ? e.dataTransfer.files.length : 'no dataTransfer',
                    items: e.dataTransfer && e.dataTransfer.items ? e.dataTransfer.items.length : 'no items',
                    effectAllowed: e.dataTransfer ? e.dataTransfer.effectAllowed : 'no dataTransfer',
                    dropEffect: e.dataTransfer ? e.dataTransfer.dropEffect : 'no dataTransfer'
                });
            }
        }, true);
    });
}

// Auto-run tests
testDragCapabilities();
monitorDragEvents();

console.log('Drag debug setup complete. Try dragging the PSD button now.'); 