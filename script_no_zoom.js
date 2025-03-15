document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const fileUpload = document.getElementById('imageUpload');
    const imageCanvas = document.getElementById('imageCanvas');
    const borderCanvas = document.getElementById('borderCanvas');
    // Add a dedicated canvas for control points that will sit on top
    let controlPointsCanvas;
    const generateBtn = document.getElementById('processBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const thicknessSlider = document.getElementById('thicknessSlider');
    const thicknessValue = document.getElementById('thicknessValue');
    const simplificationSlider = document.getElementById('simplificationSlider');
    const simplificationValue = document.getElementById('simplificationValue');
    const cornerStyleSelect = document.getElementById('cornerStyle');
    const lowPolyCheckbox = document.getElementById('lowPoly');
    const borderColor = document.getElementById('borderColor');
    const fillBorderCheckbox = document.getElementById('fillBorder');
    const fillColor = document.getElementById('fillColor');
    const fillOpacity = document.getElementById('fillOpacity');
    const opacityValue = document.getElementById('opacityValue');
    const edgeSelectionCheckbox = document.getElementById('edgeSelectionMode');
    const editorArea = document.querySelector('.editor-area');
    
    // New UI elements
    const browseLink = document.querySelector('.browse-link');
    const imageDropArea = document.querySelector('.image-drop-area');
    const borderControls = document.querySelector('.border-controls');
    
    // Canvas contexts
    const imageCtx = imageCanvas.getContext('2d');
    const borderCtx = borderCanvas.getContext('2d');
    let controlPointsCtx;
    
    // Store original image
    let originalImage = null;
    // Edge points from the contour detection
    let edgePoints = [];
    // Points for the polygon border
    let polygonPoints = [];
    // Selected control points for custom beveling
    let controlPoints = [];
    // Selected edges for beveling
    let selectedEdges = new Set();
    // Store simplified contours for edge selection
    let simplifiedContours = [];
    // Flag for edge selection mode
    let edgeSelectionMode = false;
    
    // Hide download button initially
    downloadBtn.style.display = 'none';
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize the drag and drop area with proper styling
    initializeDropArea();
    
    // Function to set up event listeners
    function setupEventListeners() {
        // File upload event listener
        fileUpload.addEventListener('change', handleImageUpload);
        
        // Browse link click handler (triggers file upload)
        if (browseLink) {
            browseLink.addEventListener('click', () => {
                fileUpload.click();
            });
        }
        
        // Drag and drop functionality for the drop area
        if (imageDropArea) {
            imageDropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageDropArea.classList.add('drag-over');
            });
            
            imageDropArea.addEventListener('dragleave', () => {
                imageDropArea.classList.remove('drag-over');
            });
            
            imageDropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                imageDropArea.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length) {
                    fileUpload.files = e.dataTransfer.files;
                    handleImageUpload({ target: { files: e.dataTransfer.files } });
                }
            });
        }
        
        // Button event listeners
        generateBtn.addEventListener('click', generateBorder);
        downloadBtn.addEventListener('click', downloadResult);
        
        // Edge selection mode toggle
        if (edgeSelectionCheckbox) {
            edgeSelectionCheckbox.addEventListener('change', function() {
                edgeSelectionMode = this.checked;
                toggleEdgeSelectionMode();
                generateBorder();
            });
        }
        
        // Sliders and input events
        thicknessSlider.addEventListener('input', function() {
            thicknessValue.textContent = this.value;
            generateBorder();
        });
        
        simplificationSlider.addEventListener('input', function() {
            simplificationValue.textContent = this.value;
            generateBorder();
        });
        
        cornerStyleSelect.addEventListener('change', generateBorder);
        lowPolyCheckbox.addEventListener('change', generateBorder);
        borderColor.addEventListener('input', generateBorder);
        
        // Fill options
        fillBorderCheckbox.addEventListener('change', function() {
            toggleFillOptions();
            generateBorder();
        });
        
        fillColor.addEventListener('input', generateBorder);
        
        fillOpacity.addEventListener('input', function() {
            opacityValue.textContent = this.value + '%';
            generateBorder();
        });
        
        // Initialize fill options visibility
        toggleFillOptions();
        
        // Prevent context menu on right-click
        if (editorArea) {
            editorArea.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
        }
    }
    
    // Toggle edge selection mode
    function toggleEdgeSelectionMode() {
        if (edgeSelectionMode) {
            // Create control points canvas if it doesn't exist, or show it
            if (!controlPointsCanvas) {
                createControlPointsCanvas();
            } else {
                controlPointsCanvas.style.display = 'block';
            }
        } else {
            // Reset selection when turning off
            selectedEdges.clear();
            
            // Hide the control points canvas
            if (controlPointsCanvas) {
                controlPointsCanvas.style.display = 'none';
            }
        }
    }
    
    // Function to create the control points canvas
    function createControlPointsCanvas() {
        // Remove existing canvas if it exists
        const existingCanvas = document.getElementById('controlPointsCanvas');
        if (existingCanvas) {
            existingCanvas.parentNode.removeChild(existingCanvas);
        }
        
        // Create new canvas element
        controlPointsCanvas = document.createElement('canvas');
        controlPointsCanvas.id = 'controlPointsCanvas';
        controlPointsCanvas.width = imageCanvas.width;
        controlPointsCanvas.height = imageCanvas.height;
        
        // Style the canvas to sit on top
        controlPointsCanvas.style.position = 'absolute';
        controlPointsCanvas.style.top = '0';
        controlPointsCanvas.style.left = '0';
        controlPointsCanvas.style.zIndex = '10'; // Higher than both image and border canvases
        
        // Add canvas to the document
        const container = imageCanvas.parentNode;
        container.appendChild(controlPointsCanvas);
        
        // Get the context
        controlPointsCtx = controlPointsCanvas.getContext('2d');
        
        // Add click event listener
        controlPointsCanvas.addEventListener('click', handleCanvasClick);
        
        return controlPointsCanvas;
    }
    
    function toggleFillOptions() {
        const fillOptions = document.getElementById('fillColorContainer');
        if (fillOptions) {
            fillOptions.style.display = fillBorderCheckbox.checked ? 'block' : 'none';
        }
    }
    
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Make sure it's a PNG file
        if (!file.type.match('image/png')) {
            alert('Please select a PNG image with transparency.');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Set canvas dimensions to match the original image size
                imageCanvas.width = img.width;
                imageCanvas.height = img.height;
                borderCanvas.width = img.width;
                borderCanvas.height = img.height;
                
                // Create or resize control points canvas
                if (controlPointsCanvas) {
                    controlPointsCanvas.width = img.width;
                    controlPointsCanvas.height = img.height;
                } else if (edgeSelectionMode) {
                    createControlPointsCanvas();
                }
                
                // Clear all canvases
                imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
                borderCtx.clearRect(0, 0, borderCanvas.width, borderCanvas.height);
                if (controlPointsCtx) {
                    controlPointsCtx.clearRect(0, 0, controlPointsCanvas.width, controlPointsCanvas.height);
                }
                
                // Draw the full image on the canvas
                imageCtx.drawImage(img, 0, 0);
                
                // Store the original image
                originalImage = img;
                
                // For compatibility with existing code, still detect bounds but don't use them for canvas sizing
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0);
                
                // Detect the bounds of the actual object in the image
                const bounds = detectObjectBounds(tempCtx, img.width, img.height);
                
                // Calculate padding - more padding for smaller objects
                const minPadding = 20; // Minimum padding in pixels
                const paddingPercentage = 0.1; // 10% padding
                const paddingX = Math.max(minPadding, Math.round(bounds.width * paddingPercentage));
                const paddingY = Math.max(minPadding, Math.round(bounds.height * paddingPercentage));
                
                // Store bounds and padding info for edge detection
                originalImage.bounds = bounds;
                originalImage.paddingX = paddingX;
                originalImage.paddingY = paddingY;
                
                // Hide the image upload area
                if (imageDropArea) {
                    imageDropArea.style.display = 'none';
                }
                
                // Show download button and make sure border controls are visible
                downloadBtn.style.display = 'inline-block';
                
                // Detect edges
                detectEdges();
                
                // Generate border with initial settings
                generateBorder();
            };
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    function handleCanvasClick(event) {
        if (!edgeSelectionMode) return;
        
        // Get position without transformations
        const rect = controlPointsCanvas.getBoundingClientRect();
        
        // Calculate click position relative to the canvas
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Convert to canvas coordinates (natural size)
        
        // Check if click is on any control point
        for (let i = 0; i < controlPoints.length; i++) {
            const point = controlPoints[i];
            const distance = Math.sqrt(Math.pow(naturalX - point.x, 2) + Math.pow(naturalY - point.y, 2));
            
            // Use a fixed detection radius
            const detectionRadius = 12;
            
            // If click is within the control point's radius
            if (distance <= detectionRadius) {
                // Toggle selection
                if (selectedEdges.has(point.edgeId)) {
                    selectedEdges.delete(point.edgeId);
                } else {
                    selectedEdges.add(point.edgeId);
                }
                
                // Redraw border with updated selections
                generateBorder();
                return;
            }
        }
    }
    
    // Initialize the drop area with proper styling
    function initializeDropArea() {
        if (imageDropArea) {
            // Add hover styling for the drop area
            const dragOverClass = 'drag-over';
            
            // Add this class to style.css if it doesn't exist
            const style = document.createElement('style');
            style.textContent = `
                .drag-over {
                    background-color: rgba(66, 133, 244, 0.05);
                    border-color: var(--primary-color);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Rest of the code...
    
    function downloadResult() {
        // Create a temporary canvas to combine the image and border
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCanvas.width;
        tempCanvas.height = imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the border first (so it appears behind the image)
        tempCtx.drawImage(borderCanvas, 0, 0);
        
        // Then draw the original image on top
        tempCtx.drawImage(imageCanvas, 0, 0);
        
        // Create a download link
        const link = document.createElement('a');
        link.download = 'bordered-image.png';
        link.href = tempCanvas.toDataURL('image/png');
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}); 
