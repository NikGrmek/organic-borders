// Load configuration
fetch('config.js')
    .then(response => response.text())
    .then(text => {
        // Remove any "export" statements and evaluate the config
        const configText = text.replace(/export\s+const/g, 'const');
        eval(configText);
    })
    .catch(error => {
        console.error("Error loading configuration:", error);
    });



document.addEventListener('DOMContentLoaded', () => {
    // Global variables 
    let lastCreatedPsdData = null; // Store the last created PSD data for direct opening
    let currentPsdBlob = null; // Store the current PSD blob for drag-and-drop
    let currentPsdFileName = null; // Store the current PSD file name
    let currentPsdFirebaseUrl = null; // Store the Firebase URL for dragging
    let currentPsdFirebasePath = null; // Store the Firebase path for cleanup
    let needsRender = false; // Track if we need to render before export
    let isRendering = false; // Track if currently rendering
    
    // Initialize Firebase when available
    if (window.initializeFirebase) {
        try {
            window.initializeFirebase();
            console.log('Firebase initialization requested');
            
            // Check if Firebase is properly initialized after a short delay
            setTimeout(() => {
                if (!window.firebaseStorage) {
                    console.error('Firebase Storage not available after initialization');
                    console.log('This might be due to CORS restrictions on GitHub Pages');
                } else {
                    console.log('Firebase Storage is available');
                    // Clean up old temp files on startup
                    cleanupOldTempFiles().catch(error => {
                        console.warn('Initial cleanup failed:', error);
                    });
                }
            }, 2000);
        } catch (error) {
            console.error('Error during Firebase initialization:', error);
        }
    } else {
        console.warn('Firebase initialization function not found');
    }
    
    // Add CSS for processing messages
    const style = document.createElement('style');
    style.textContent = `
        .processing-message {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .processing-content {
            background-color: white;
            padding: 20px 40px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .spinner {
            width: 24px;
            height: 24px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize draggable number controls
    initDraggableNumbers();
    
    // Initialize sliders
    initSliders();
    
    // Initialize folder persistence
    initFolderPersistence();
    
    // DOM elements
    const fileUpload = document.getElementById('imageUpload');
    const selectImageBtn = document.getElementById('selectImage');

    const imageCanvas = document.getElementById('imageCanvas');
    const borderCanvas = document.getElementById('borderCanvas');
    const uploadPlaceholder = document.querySelector('.upload-placeholder');
    const canvasArea = document.querySelector('.canvas-area');
    // Add a dedicated canvas for control points that will sit on top
    let controlPointsCanvas;
    const renderBtn = document.getElementById('renderBtn');
    const renderBtnText = document.getElementById('renderBtnText');
    const downloadBtn = document.getElementById('downloadBtn');
    const exportPsdBtn = document.getElementById('exportPsdBtn');
    const dragPsdBtn = document.getElementById('dragPsdBtn');
    const dragPsdBtnText = document.getElementById('dragPsdBtnText');
    const resetFolderBtn = document.getElementById('resetFolderBtn');
    const toolsContainer = document.getElementById('tools-container');
    
    // Get references to slider elements
    const simplificationRange = document.getElementById('simplificationRange');
    const simplificationValue = document.getElementById('simplificationValue');
    
    // Thickness slider with regular functionality
    const thicknessRange = document.getElementById('thicknessRange');
    const thicknessValue = document.getElementById('thicknessValue');
    let currentThickness = 46;
    
    // Fixed settings (previously toggles/dropdowns)
    const cornerStyle = 'miter'; // Sharp corners by default
    const isLowPoly = false; // No low-poly style by default
    const shouldFill = true; // Always fill the border
    
    // Default border color (white)
    const defaultBorderColor = '#FFFFFF';
    
    // Hidden but needed for compatibility
    let fillColor = { value: '#FFFFFF' };
    

    
    const edgeSelectionModeCheckbox = document.getElementById('edgeSelectionMode');
    
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
    
    // Hide tools container initially
    toolsContainer.style.display = 'none';
    renderBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
    exportPsdBtn.style.display = 'none';
    dragPsdBtn.style.display = 'none';
    // Add null check for resetFolderBtn before trying to access its style property
    if (resetFolderBtn) {
        resetFolderBtn.style.display = 'none';
    }
    
    // Initialize sliders for custom input
    initSliders();
    
    // Event listeners
    fileUpload.addEventListener('change', handleImageUpload);
    selectImageBtn.addEventListener('click', () => fileUpload.click());

    renderBtn.addEventListener('click', handleRender);
    downloadBtn.addEventListener('click', downloadResult);
    exportPsdBtn.addEventListener('click', exportAsPsd);
    // Add null check before adding the event listener
    if (resetFolderBtn) {
        resetFolderBtn.addEventListener('click', resetExportFolder);
    }
    
    // Set up drag and drop for the canvas area
    canvasArea.addEventListener('dragover', handleDragOver);
    canvasArea.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver); // Allow drag anywhere on the page
    document.addEventListener('drop', handleDrop);
    
    // Add clipboard paste event listener (Cmd+V / Ctrl+V)
    document.addEventListener('paste', handleClipboardPaste);
    
    // Set up drag events for PSD button
    if (dragPsdBtn) {
        dragPsdBtn.addEventListener('dragstart', handlePsdDragStart);
        dragPsdBtn.addEventListener('dragend', handlePsdDragEnd);
    }
    
    // Thickness slider with regular functionality
    thicknessRange.addEventListener('input', (e) => {
        currentThickness = parseInt(e.target.value);
        thicknessValue.textContent = currentThickness;
        generateBorder();
        markNeedsRender();
    });
    
    // Edge selection mode
    edgeSelectionModeCheckbox.addEventListener('change', function() {
        edgeSelectionMode = this.checked;
        
        // Reset selection when turning off
        if (!edgeSelectionMode) {
            selectedEdges.clear();
            
            // Hide control points canvas
            const controlCanvas = document.getElementById('controlPointsCanvas');
            if (controlCanvas) {
                controlCanvas.style.display = 'none';
            }
        } else {
            // Create control points canvas if it doesn't exist, or show it
            if (controlPointsCanvas) {
                controlPointsCanvas.style.display = 'block';
            } else if (originalImage) { // Only create if we have an image
                createControlPointsCanvas();
            }
            
            // If we have edges detected, draw the control points
            if (simplifiedContours.length > 0) {
                drawControlPoints();
            }
        }
        
        // Regenerate border with control points if in selection mode
        generateBorder();
        markNeedsRender();
    });
    
    // Prevent default drag behavior
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }
    
    // Handle file drop
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            
            // Get file type and extension
            const fileType = file.type;
            const fileName = file.name.toLowerCase();
            const isPsd = fileType.match('application/photoshop') || 
                          fileType.match('image/vnd.adobe.photoshop') || 
                          fileType.match('application/x-photoshop') || 
                          fileName.endsWith('.psd');
            
            // Check if file is an image or PSD
            if (fileType.match('image.*') || isPsd) {
                // Process the file directly with our handler
                handleImageFile(file);
                

            }
        }
    }
    
    // Slider event listeners
    simplificationRange.addEventListener('input', (e) => {
        simplificationValue.textContent = e.target.value;
        generateBorder();
        markNeedsRender();
    });
    

    
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
        const container = document.querySelector('.canvas-container');
        if (container) {
            container.appendChild(controlPointsCanvas);
            
            // Get the context
            controlPointsCtx = controlPointsCanvas.getContext('2d');
            
            // Add click event listener
            controlPointsCanvas.addEventListener('click', handleCanvasClick);
            
            return controlPointsCanvas;
        }
        
        return null;
    }
    
    /**
     * Process an image file and display it on the canvas
     * @param {File} file - The image file to process
     */
    function handleImageFile(file) {
        if (!file) return;
        
        // Check if it's a PSD file
        const isPsd = file.type.match('application/photoshop') || 
                      file.type.match('image/vnd.adobe.photoshop') || 
                      file.type.match('application/x-photoshop') || 
                      file.name.toLowerCase().endsWith('.psd');
                      
        if (isPsd) {
            // PSD files are not supported for direct upload
            console.error('PSD files are not supported for direct upload');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Add padding to prevent clipping
                const padding = 20; // 20px padding on all sides
                
                // Set canvas dimensions with padding
                imageCanvas.width = img.width + (padding * 2);
                imageCanvas.height = img.height + (padding * 2);
                borderCanvas.width = img.width + (padding * 2);
                borderCanvas.height = img.height + (padding * 2);
                
                // Create or resize control points canvas
                if (controlPointsCanvas) {
                    controlPointsCanvas.width = imageCanvas.width;
                    controlPointsCanvas.height = imageCanvas.height;
                } else if (edgeSelectionMode) {
                    createControlPointsCanvas();
                }
                
                // Clear all canvases
                imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
                borderCtx.clearRect(0, 0, borderCanvas.width, borderCanvas.height);
                if (controlPointsCtx) {
                    controlPointsCtx.clearRect(0, 0, controlPointsCanvas.width, controlPointsCanvas.height);
                }
                
                // Draw image on canvas with padding
                imageCtx.drawImage(img, padding, padding, img.width, img.height);
                
                // Store the original image and padding info
                originalImage = img;
                originalImage.padding = padding;
                
                // Display image dimensions
                displayImageDimensions();
                
                // Apply filters if enabled (including shadow after border detection)
                applyImageFilters();
                
                // Hide the placeholder
                if (uploadPlaceholder) {
                    uploadPlaceholder.style.display = 'none';
                }
                
                // Show all control panels
                toolsContainer.style.display = 'block';
                
                // Show render button, hide export buttons
                renderBtn.style.display = 'inline-flex';
                downloadBtn.style.display = 'none';
                exportPsdBtn.style.display = 'none';
                dragPsdBtn.style.display = 'none';
                
                // Mark that we need to render
                needsRender = true;
                
                // Reset drag button state when loading new image
                currentPsdBlob = null;
                currentPsdFileName = null;
                currentPsdFirebaseUrl = null;
                currentPsdFirebasePath = null;
                dragPsdBtnText.textContent = 'Uploading...';
                dragPsdBtn.draggable = false;
                

                
                // Update folder information in UI if available
                updateFolderInfo();
            };
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            handleImageFile(file);
        }
    }
    
    // Function to update folder information in the UI
    function updateFolderInfo() {
        // Check if we have saved folder data
        const savedData = localStorage.getItem('savedExportFolderData');
        
        if (savedData) {
            try {
                // Parse the saved data
                const folderData = JSON.parse(savedData);
                
                // Update UI to show the saved folder
                if (resetFolderBtn) {
                    resetFolderBtn.style.display = 'block';
                }
                
                // Update toggle label if it exists
                updateFolderInfoUI(folderData.name);
            } catch (error) {
                console.error('Error parsing saved folder data for UI update:', error);
            }
        }
    }
    
    function detectEdges(sourceCanvas = null) {
        // Get image data - either from the source canvas or the default image canvas
        const padding = originalImage.padding || 0;
        
        // Determine which canvas to use as the source
        const sourceCtx = sourceCanvas ? sourceCanvas.getContext('2d') : imageCtx;
        
        const imageData = sourceCtx.getImageData(
            padding, 
            padding, 
            imageCanvas.width - (padding * 2), 
            imageCanvas.height - (padding * 2)
        );
        const data = imageData.data;
        const width = imageCanvas.width - (padding * 2);
        const height = imageCanvas.height - (padding * 2);
        
        // Clear previous edge points
        edgePoints = [];
        
        // Create a binary mask of visible pixels (alpha > threshold)
        const alphaMask = new Uint8Array(width * height);
        const alphaThreshold = 5; // Lower threshold for cartoon images
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const alpha = data[index + 3];
                alphaMask[y * width + x] = alpha > alphaThreshold ? 1 : 0;
            }
        }
        
        // Apply a small blur to the alpha mask to reduce noise
        const blurredMask = blurMask(alphaMask, width, height);
        
        // Find edge pixels (visible pixels that have at least one transparent neighbor)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (blurredMask[y * width + x] === 1) {
                    // Check if this is a border pixel (has at least one transparent neighbor)
                    let isBorder = false;
                    
                    // Check neighbors (8-connectivity for better border detection)
                    const directions = [
                        {dx: -1, dy: 0},  // left
                        {dx: 1, dy: 0},   // right
                        {dx: 0, dy: -1},  // up
                        {dx: 0, dy: 1},   // down
                        {dx: -1, dy: -1}, // top-left
                        {dx: 1, dy: -1},  // top-right
                        {dx: -1, dy: 1},  // bottom-left
                        {dx: 1, dy: 1}    // bottom-right
                    ];
                    
                    for (const dir of directions) {
                        const nx = x + dir.dx;
                        const ny = y + dir.dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (blurredMask[ny * width + nx] === 0) {
                                isBorder = true;
                                break;
                            }
                        } else {
                            // Edge of canvas is considered a border
                            isBorder = true;
                            break;
                        }
                    }
                    
                    if (isBorder) {
                        // Add padding offset to edge points
                        edgePoints.push({x: x + padding, y: y + padding});
                    }
                }
            }
        }
        
        // Group edge points into contours
        const contours = findContours(edgePoints);
        
        // Sort contours by size (largest first)
        contours.sort((a, b) => b.length - a.length);
        
        // Take only significant contours with improved filtering
        const significantContours = filterSignificantContours(contours);
        
        // Store all edge points for polygon generation
        edgePoints = [].concat(...significantContours);
        
        // Ensure we have enough points for processing
        if (edgePoints.length < 10 && contours.length > 0) {
            // Fallback to the largest contour if our filtering removed too many points
            edgePoints = [...contours[0]];
        }
    }
    
    function blurMask(mask, width, height) {
        // Simple box blur to reduce noise
        const result = new Uint8Array(width * height);
        const kernelSize = 3;
        const kernelRadius = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                // Apply kernel
                for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
                    for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            sum += mask[ny * width + nx];
                            count++;
                        }
                    }
                }
                
                // Average value in kernel
                result[y * width + x] = sum / count > 0.5 ? 1 : 0;
            }
        }
        
        return result;
    }
    
    function filterSignificantContours(contours) {
        if (contours.length === 0) return [];
        
        // If there's only one contour, keep it
        if (contours.length === 1) return contours;
        
        // Find the largest contour
        const largestContour = contours[0];
        const largestContourLength = largestContour.length;
        
        // Calculate the bounding box of the largest contour
        const boundingBox = calculateBoundingBox(largestContour);
        const boundingBoxArea = (boundingBox.maxX - boundingBox.minX) * (boundingBox.maxY - boundingBox.minY);
        
        // For cartoon images, we primarily want the main outer contour
        // Filter less aggressively - keep any contour that's a significant part of the largest one
        const significantContours = contours.filter(contour => {
            // Skip very small contours
            if (contour.length < 10) return false;
            
            // Always keep the largest contour
            if (contour === largestContour) return true;
            
            // Check if this contour is big enough relative to the largest one
            const sizeRatio = contour.length / largestContourLength;
            
            // Be more lenient with the size ratio for cartoon images
            return sizeRatio > 0.2; // Keep contours that are at least 20% of the largest
        });
        
        // If we filtered too aggressively, return at least the largest contour
        return significantContours.length > 0 ? significantContours : [largestContour];
    }
    
    function isPointInsidePolygon(point, polygon) {
        // Ray casting algorithm to determine if a point is inside a polygon
        let inside = false;
        const x = point.x;
        const y = point.y;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            const intersect = ((yi > y) !== (yj > y)) && 
                             (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    function findContours(points) {
        if (points.length <= 1) return [];
        
        // Group points into connected contours
        const contours = [];
        let remainingPoints = [...points];
        
        // Create a grid for faster neighbor finding
        const gridSize = 1;
        const grid = {};
        
        // Add points to grid
        for (const pt of remainingPoints) {
            const key = `${Math.floor(pt.x / gridSize)},${Math.floor(pt.y / gridSize)}`;
            if (!grid[key]) grid[key] = [];
            grid[key].push(pt);
        }
        
        while (remainingPoints.length > 0) {
            const contour = [];
            const startPoint = remainingPoints[0];
            let currentPoint = startPoint;
            
            // Remove the start point
            remainingPoints.splice(0, 1);
            removeFromGrid(currentPoint, grid, gridSize);
            contour.push(currentPoint);
            
            let foundNeighbor = true;
            
            while (foundNeighbor && remainingPoints.length > 0) {
                foundNeighbor = false;
                
                // Get neighboring points
                const neighbors = getNeighboringPoints(currentPoint, grid, gridSize);
                
                if (neighbors.length > 0) {
                    // Find the closest point
                    let closestPoint = neighbors[0];
                    let closestDistance = distance(currentPoint, closestPoint);
                    
                    for (let i = 1; i < neighbors.length; i++) {
                        const dist = distance(currentPoint, neighbors[i]);
                        if (dist < closestDistance) {
                            closestDistance = dist;
                            closestPoint = neighbors[i];
                        }
                    }
                    
                    // Only use point if it's close enough
                    if (closestDistance <= 2) {
                        const idx = remainingPoints.findIndex(p => p.x === closestPoint.x && p.y === closestPoint.y);
                        if (idx !== -1) {
                            remainingPoints.splice(idx, 1);
                            removeFromGrid(closestPoint, grid, gridSize);
                            contour.push(closestPoint);
                            currentPoint = closestPoint;
                            foundNeighbor = true;
                        }
                    }
                }
            }
            
            if (contour.length > 10) {
                contours.push(contour);
            }
        }
        
        return contours;
    }
    
    function getNeighboringPoints(point, grid, gridSize) {
        const neighbors = [];
        const gridX = Math.floor(point.x / gridSize);
        const gridY = Math.floor(point.y / gridSize);
        
        // Check surrounding grid cells
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const key = `${gridX + dx},${gridY + dy}`;
                if (grid[key]) {
                    neighbors.push(...grid[key]);
                }
            }
        }
        
        return neighbors;
    }
    
    function removeFromGrid(point, grid, gridSize) {
        const key = `${Math.floor(point.x / gridSize)},${Math.floor(point.y / gridSize)}`;
        if (grid[key]) {
            const idx = grid[key].findIndex(p => p.x === point.x && p.y === point.y);
            if (idx !== -1) {
                grid[key].splice(idx, 1);
                if (grid[key].length === 0) {
                    delete grid[key];
                }
            }
        }
    }
    
    function distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return dx * dx + dy * dy; // Square of distance
    }
    
    function generateBorder() {
        if (!originalImage || edgePoints.length === 0) return;
        
        // Clear border canvas
        borderCtx.clearRect(0, 0, borderCanvas.width, borderCanvas.height);
        
        // Clear control points canvas if it exists
        if (controlPointsCtx) {
            controlPointsCtx.clearRect(0, 0, controlPointsCanvas.width, controlPointsCanvas.height);
        }
        
        // Get parameters
        const simplification = simplificationRange ? getSliderValue(simplificationRange) : 18;
        const thickness = currentThickness;
        const selectedColor = defaultBorderColor;
        // Always use border color for fill and 100% opacity
        const fillColorValue = selectedColor;
        const opacity = 1.0; // Always 100% opacity
        
        // Use adaptive simplification for cleaner results
        const baseEpsilon = simplification * 0.5;
        const contours = findContours(edgePoints);
        
        // First draw the filled background if shouldFill is true (which it always is now)
        if (shouldFill) {
            // Clear the border canvas first
            borderCtx.clearRect(0, 0, borderCanvas.width, borderCanvas.height);
            
            // Process each significant contour for filling
            contours.forEach(contour => {
                if (contour.length < 20) return; // Skip very small contours
                
                // Apply adaptive simplification for filling
                const simplifiedPoints = adaptiveSimplify(contour, baseEpsilon);
                
                // Draw filled areas (using isLowPoly flag which is always false now)
                if (isLowPoly) {
                    drawLowPolyFill(simplifiedPoints, fillColorValue, opacity);
                } else {
                    drawPolygonFill(simplifiedPoints, fillColorValue, opacity);
                }
            });
        }
        
        // Reset simplified contours and control points
        simplifiedContours = [];
        controlPoints = [];
        
        // Then draw the borders
        contours.forEach(contour => {
            if (contour.length < 20) return; // Skip very small contours
            
            // Apply adaptive simplification
            const simplifiedPoints = adaptiveSimplify(contour, baseEpsilon);
            simplifiedContours.push(simplifiedPoints);
            
            if (isLowPoly) {
                // Draw low-poly border without fill (we already did the fill)
                drawLowPolyBorder(simplifiedPoints, thickness, selectedColor, cornerStyle, false, null, 0);
            } else {
                // Draw regular polygon border, passing the selected edges
                drawPolygonBorder(simplifiedPoints, thickness, selectedColor, cornerStyle, false, null, 0);
            }
        });
        
        // Draw control points if in edge selection mode
        if (edgeSelectionMode) {
            // Create control points canvas if it doesn't exist
            if (!controlPointsCanvas) {
                createControlPointsCanvas();
            } else {
                controlPointsCanvas.style.display = 'block';
            }
            
            // Redraw all the control points
            drawControlPoints();
        } else if (controlPointsCanvas) {
            controlPointsCanvas.style.display = 'none';
        }
    }
    
    function rdpSimplify(points, epsilon) {
        if (points.length <= 2) return points;
        
        // Find the point with the maximum distance
        let maxDistance = 0;
        let maxIndex = 0;
        
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than epsilon, recursively simplify
        if (maxDistance > epsilon) {
            // Recursive case
            const firstPart = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
            const secondPart = rdpSimplify(points.slice(maxIndex), epsilon);
            
            // Concat the two parts, excluding duplicate point
            return firstPart.slice(0, -1).concat(secondPart);
        } else {
            // Base case - just return the endpoints
            return [firstPoint, lastPoint];
        }
    }
    
    // New adaptive simplification function
    function adaptiveSimplify(points, baseEpsilon) {
        if (points.length <= 20) return points; // Not enough points to simplify
        
        // Calculate the overall shape size for normalization
        const boundingBox = calculateBoundingBox(points);
        const shapeDiagonal = Math.sqrt(
            Math.pow(boundingBox.maxX - boundingBox.minX, 2) + 
            Math.pow(boundingBox.maxY - boundingBox.minY, 2)
        );
        
        // First pass - calculate curvature at each point
        const curvatures = calculateCurvatures(points);
        
        // Normalize curvatures and adjust epsilon based on curvature
        const curvatureFactors = normalizeCurvatures(curvatures);
        
        // Apply simplification in multiple passes
        let result = [...points];
        
        // First pass - ensure closed contour by adding points if needed
        result = ensureClosedContour(result);
        
        // Second pass - Remove noise and tiny details while preserving structure
        let currentEpsilon = baseEpsilon * 0.2; // More conservative initial simplification
        result = adaptiveRdpSimplify(result, currentEpsilon, curvatureFactors, shapeDiagonal);
        
        // Third pass - Smooth the overall shape with a medium epsilon
        currentEpsilon = baseEpsilon * 0.5;
        result = adaptiveRdpSimplify(result, currentEpsilon, curvatureFactors, shapeDiagonal);
        
        // Fourth pass - Ensure we don't have too many points
        if (result.length > 100) {
            currentEpsilon = baseEpsilon * 0.8;
            result = rdpSimplify(result, currentEpsilon);
        }
        
        // Remove spike artifacts
        result = removeSpikes(result);
        
        // Ensure minimum distance between points
        result = ensureMinimumDistance(result, shapeDiagonal * 0.005);
        
        // Final pass - ensure closed contour
        result = ensureClosedContour(result);
        
        return result;
    }
    
    function adaptiveRdpSimplify(points, baseEpsilon, curvatureFactors, shapeDiagonal) {
        if (points.length <= 2) return points;
        
        // Find the point with the maximum distance
        let maxDistance = 0;
        let maxIndex = 0;
        
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
            
            // Adjust epsilon based on curvature
            const adaptiveEpsilon = baseEpsilon * (1 - curvatureFactors[i] * 0.7);
            
            // Points in high curvature areas need lower epsilon (less simplification)
            const scaledDistance = distance / adaptiveEpsilon;
            
            if (scaledDistance > maxDistance) {
                maxDistance = scaledDistance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than 1.0 (meaning it's greater than the adaptive epsilon), recursively simplify
        if (maxDistance > 1.0) {
            // Recursive case
            const firstPart = adaptiveRdpSimplify(points.slice(0, maxIndex + 1), baseEpsilon, curvatureFactors.slice(0, maxIndex + 1), shapeDiagonal);
            const secondPart = adaptiveRdpSimplify(points.slice(maxIndex), baseEpsilon, curvatureFactors.slice(maxIndex), shapeDiagonal);
            
            // Concat the two parts, excluding duplicate point
            return firstPart.slice(0, -1).concat(secondPart);
        } else {
            // Base case - just return the endpoints
            return [firstPoint, lastPoint];
        }
    }
    
    function calculateBoundingBox(points) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    function calculateCurvatures(points) {
        // Calculate an approximate curvature at each point using the angle between neighboring segments
        const curvatures = new Array(points.length).fill(0);
        
        if (points.length < 3) return curvatures;
        
        // Look at more neighboring points for smoother detection of curvature
        const lookAhead = 2; // Look 2 points ahead/behind instead of just 1
        
        for (let i = 0; i < points.length; i++) {
            const prevIdx = (i - lookAhead + points.length) % points.length;
            const nextIdx = (i + lookAhead) % points.length;
            
            const prev = points[prevIdx];
            const curr = points[i];
            const next = points[nextIdx];
            
            // Calculate vectors
            const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Calculate magnitudes
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
            
            // Avoid division by zero
            if (mag1 > 0 && mag2 > 0) {
                // Normalize vectors
                const v1n = { x: v1.x / mag1, y: v1.y / mag1 };
                const v2n = { x: v2.x / mag2, y: v2.y / mag2 };
                
                // Calculate dot product
                const dotProduct = v1n.x * v2n.x + v1n.y * v2n.y;
                
                // Convert to angle (radians)
                const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                
                // Higher values for sharper corners
                curvatures[i] = Math.PI - angle;
            }
        }
        
        // Smooth the curvatures array to avoid artifacts
        const smoothedCurvatures = smoothArray(curvatures, 3);
        
        return smoothedCurvatures;
    }
    
    function smoothArray(array, radius) {
        const result = new Array(array.length);
        
        for (let i = 0; i < array.length; i++) {
            let sum = 0;
            let count = 0;
            
            for (let j = Math.max(0, i - radius); j <= Math.min(array.length - 1, i + radius); j++) {
                sum += array[j];
                count++;
            }
            
            result[i] = sum / count;
        }
        
        return result;
    }
    
    function normalizeCurvatures(curvatures) {
        // Find max and min curvature
        let maxCurvature = -Infinity;
        let minCurvature = Infinity;
        
        curvatures.forEach(c => {
            maxCurvature = Math.max(maxCurvature, c);
            minCurvature = Math.min(minCurvature, c);
        });
        
        // Avoid division by zero
        const curvatureRange = maxCurvature - minCurvature;
        if (curvatureRange === 0) {
            return curvatures.map(() => 0.5);
        }
        
        // Normalize to [0, 1] range
        return curvatures.map(c => (c - minCurvature) / curvatureRange);
    }
    
    function smoothCorners(points) {
        if (points.length < 3) return points;
        
        // Create a new array to hold the smoothed result
        const smoothed = [];
        
        for (let i = 0; i < points.length; i++) {
            const prev = points[(i - 1 + points.length) % points.length];
            const curr = points[i];
            const next = points[(i + 1) % points.length];
            
            // Add the current point
            smoothed.push(curr);
            
            // Calculate vectors
            const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Calculate magnitudes
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
            
            // Calculate dot product and angle
            if (mag1 > 0 && mag2 > 0) {
                const dotProduct = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
                const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                
                // If we have a sharp corner (small angle), add an extra point
                if (angle < Math.PI * 0.6) {
                    const interpolation = 0.5;
                    const midPoint = {
                        x: curr.x + v2.x * interpolation * 0.3,
                        y: curr.y + v2.y * interpolation * 0.3
                    };
                    smoothed.push(midPoint);
                }
            }
        }
        
        return smoothed;
    }
    
    function ensureMinimumDistance(points, minDistance) {
        if (points.length < 2) return points;
        
        const result = [points[0]];
        let lastPoint = points[0];
        
        for (let i = 1; i < points.length; i++) {
            const curr = points[i];
            const dx = curr.x - lastPoint.x;
            const dy = curr.y - lastPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist >= minDistance) {
                result.push(curr);
                lastPoint = curr;
            }
        }
        
        // Ensure we keep the last point if it's far enough
        const lastIdx = points.length - 1;
        const dx = points[lastIdx].x - lastPoint.x;
        const dy = points[lastIdx].y - lastPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist >= minDistance && result[result.length - 1] !== points[lastIdx]) {
            result.push(points[lastIdx]);
        }
        
        return result;
    }
    
    function perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        // If it's a point (not a line), return distance to the point
        if (dx === 0 && dy === 0) {
            const pDx = point.x - lineStart.x;
            const pDy = point.y - lineStart.y;
            return Math.sqrt(pDx * pDx + pDy * pDy);
        }
        
        // Calculate perpendicular distance to line
        const norm = Math.sqrt(dx * dx + dy * dy);
        return Math.abs((point.y - lineStart.y) * dx - (point.x - lineStart.x) * dy) / norm;
    }
    
    function drawPolygonFill(points, fillColor, opacity) {
        if (points.length < 3) return;
        
        // Apply curve smoothing for clean fills
        const smoothedPoints = smoothCurve(points);
        
        borderCtx.fillStyle = hexToRgba(fillColor, opacity);
        
        // Start a new path
        borderCtx.beginPath();
        
        if (smoothedPoints.length > 0) {
            borderCtx.moveTo(smoothedPoints[0].x, smoothedPoints[0].y);
            
            for (let i = 1; i < smoothedPoints.length; i++) {
                borderCtx.lineTo(smoothedPoints[i].x, smoothedPoints[i].y);
            }
        } else {
            borderCtx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                borderCtx.lineTo(points[i].x, points[i].y);
            }
        }
        
        // Close the path
        borderCtx.closePath();
        
        // Fill only, no stroke
        borderCtx.fill();
    }
    
    function drawLowPolyFill(points, fillColor, opacity) {
        if (points.length < 3) return;
        
        borderCtx.fillStyle = hexToRgba(fillColor, opacity);
        
        // Create triangulation
        const triangles = createTriangulation(points);
        
        // Draw each triangle with fill only
        triangles.forEach(triangle => {
            borderCtx.beginPath();
            borderCtx.moveTo(triangle[0].x, triangle[0].y);
            borderCtx.lineTo(triangle[1].x, triangle[1].y);
            borderCtx.lineTo(triangle[2].x, triangle[2].y);
            borderCtx.closePath();
            
            // Fill only, no stroke
            borderCtx.fill();
        });
    }
    
    function drawPolygonBorder(points, thickness, color, cornerStyle, fill, fillColor, opacity) {
        if (points.length < 2) return;
        
        // Get the contour index from simplifiedContours
        const contourIndex = simplifiedContours.indexOf(points);
        
        // Use a clean border drawing approach
        borderCtx.lineWidth = thickness;
        borderCtx.lineCap = 'round';
        borderCtx.miterLimit = 3; // Limit spike length for sharp corners
        borderCtx.strokeStyle = color;
        
        // Don't use curve smoothing for sharp corners as it creates spikes
        // But we still need to ensure the contour is well-formed
        const processedPoints = points.length > 0 ? 
            ensureClosedContour(removeSpikes(points)) : points;
        
        // If fill is requested, first fill the entire path
        if (fill) {
            borderCtx.fillStyle = hexToRgba(fillColor, opacity);
            borderCtx.beginPath();
            borderCtx.moveTo(processedPoints[0].x, processedPoints[0].y);
            
            for (let i = 1; i < processedPoints.length; i++) {
                borderCtx.lineTo(processedPoints[i].x, processedPoints[i].y);
            }
            
            borderCtx.closePath();
            borderCtx.fill();
        }
        
        // Draw each edge as a separate path to allow individual corner styles
        if (processedPoints.length > 1) {
            const numPoints = processedPoints.length;
            
            for (let i = 0; i < numPoints; i++) {
                const currentPoint = processedPoints[i];
                const nextPoint = processedPoints[(i + 1) % numPoints];
                const nextNextPoint = processedPoints[(i + 2) % numPoints];
                
                // Generate unique edge ID
                const edgeId = `${contourIndex}-${i}`;
                
                // Check if this edge should be beveled
                const shouldBevel = selectedEdges.has(edgeId);
                
                // Set the join style for this segment
                if (shouldBevel) {
                    borderCtx.lineJoin = 'bevel';
                } else if (cornerStyle === 'bevel') {
                    borderCtx.lineJoin = 'bevel';
                } else if (cornerStyle === 'round') {
                    borderCtx.lineJoin = 'round';
                } else {
                    borderCtx.lineJoin = 'miter';
                }
                
                // Draw a small path segment that includes the current point and the next point
                borderCtx.beginPath();
                borderCtx.moveTo(currentPoint.x, currentPoint.y);
                borderCtx.lineTo(nextPoint.x, nextPoint.y);
                
                // Add the next-next point to properly render the join style at the next point
                if (i < numPoints - 1 || numPoints <= 2) {
                    borderCtx.lineTo(nextNextPoint.x, nextNextPoint.y);
                }
                
                borderCtx.stroke();
            }
        } else {
            // Fallback for very simple paths
            borderCtx.beginPath();
            borderCtx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                borderCtx.lineTo(points[i].x, points[i].y);
            }
            
            if (points.length > 2) {
                borderCtx.closePath();
            }
            
            borderCtx.stroke();
        }
    }
    
    function smoothCurve(points) {
        if (points.length < 3) return points;
        
        // We'll use a simple implementation of curve smoothing
        // by adjusting points slightly toward their neighbors
        
        const result = [];
        const smooth = 0.2; // Smoothing factor (0 = no smoothing, 1 = maximum smoothing)
        
        // First point stays the same
        result.push({...points[0]});
        
        // Smooth middle points
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // Calculate smoothed point
            const smoothedX = curr.x + smooth * ((prev.x + next.x) / 2 - curr.x);
            const smoothedY = curr.y + smooth * ((prev.y + next.y) / 2 - curr.y);
            
            result.push({x: smoothedX, y: smoothedY});
        }
        
        // Last point stays the same
        result.push({...points[points.length - 1]});
        
        return result;
    }
    
    function drawLowPolyBorder(points, thickness, color, cornerStyle, fill, fillColor, opacity) {
        if (points.length < 3) return;
        
        borderCtx.lineWidth = thickness;
        borderCtx.lineJoin = cornerStyle;
        borderCtx.strokeStyle = color;
        
        // Create triangulation
        const triangles = createTriangulation(points);
        
        // Draw each triangle
        triangles.forEach(triangle => {
            borderCtx.beginPath();
            borderCtx.moveTo(triangle[0].x, triangle[0].y);
            borderCtx.lineTo(triangle[1].x, triangle[1].y);
            borderCtx.lineTo(triangle[2].x, triangle[2].y);
            borderCtx.closePath();
            
            // Fill the triangle if requested
            if (fill) {
                borderCtx.fillStyle = hexToRgba(fillColor, opacity);
                borderCtx.fill();
            }
            
            // Stroke the triangle
            borderCtx.stroke();
        });
    }
    
    function hexToRgba(hex, opacity) {
        // Remove the hash if it exists
        hex = hex.replace('#', '');
        
        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Return the rgba color
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    function createTriangulation(points) {
        // Simple triangulation by creating triangles between consecutive points and a central point
        if (points.length < 3) return [];
        
        const triangles = [];
        
        // Calculate centroid
        let centroidX = 0;
        let centroidY = 0;
        
        points.forEach(point => {
            centroidX += point.x;
            centroidY += point.y;
        });
        
        centroidX /= points.length;
        centroidY /= points.length;
        
        const centroid = { x: centroidX, y: centroidY };
        
        // Create triangles
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            triangles.push([p1, p2, centroid]);
        }
        
        return triangles;
    }
    
    function ensureClosedContour(points) {
        if (points.length < 3) return points;
        
        const result = [...points];
        const firstPoint = result[0];
        const lastPoint = result[result.length - 1];
        
        // Check if the contour is already closed
        const dx = lastPoint.x - firstPoint.x;
        const dy = lastPoint.y - firstPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If the distance between the first and last point is significant, close the contour
        if (distance > 2) {
            result.push({...firstPoint});
        }
        
        return result;
    }
    
    function removeSpikes(points) {
        if (points.length < 4) return points;
        
        const result = [];
        const threshold = 0.85; // Threshold for spikes (cos of angle)
        
        // First point always included
        result.push(points[0]);
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // Calculate vectors
            const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Calculate magnitudes
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
            
            if (mag1 > 0 && mag2 > 0) {
                // Normalize vectors
                const v1n = { x: v1.x / mag1, y: v1.y / mag1 };
                const v2n = { x: v2.x / mag2, y: v2.y / mag2 };
                
                // Calculate dot product
                const dotProduct = v1n.x * v2n.x + v1n.y * v2n.y;
                
                // If the angle is very sharp (dot product close to -1), it's likely a spike
                // Also check if the point forms a small triangle area with neighbors
                const crossProduct = v1n.x * v2n.y - v1n.y * v2n.x;
                const triangleArea = 0.5 * Math.abs(crossProduct) * mag1 * mag2;
                
                // Skip this point if it's a spike (very sharp angle and small area)
                const isSpike = dotProduct < -threshold && triangleArea < (mag1 + mag2) * 5;
                
                if (!isSpike) {
                    result.push(curr);
                }
            } else {
                // If one of the segments has zero length, include the point
                result.push(curr);
            }
        }
        
        // Last point always included
        if (points.length > 1) {
            result.push(points[points.length - 1]);
        }
        
        return result;
    }
    
    function drawControlPoints() {
        // Clear existing control points
        controlPoints = [];
        
        // Ensure we have a control points canvas and context
        if (!controlPointsCanvas || !controlPointsCtx) {
            createControlPointsCanvas();
        }
        
        // Ensure the canvas is visible
        controlPointsCanvas.style.display = 'block';
        
        // Clear the control points canvas
        controlPointsCtx.clearRect(0, 0, controlPointsCanvas.width, controlPointsCanvas.height);
        
        // Process all simplified contours
        simplifiedContours.forEach((contour, contourIndex) => {
            for (let i = 0; i < contour.length; i++) {
                const currPoint = contour[i];
                const nextPoint = contour[(i + 1) % contour.length];
                
                // Create a control point at the midpoint of each edge
                const midX = (currPoint.x + nextPoint.x) / 2;
                const midY = (currPoint.y + nextPoint.y) / 2;
                
                // Generate a unique ID for this edge
                const edgeId = `${contourIndex}-${i}`;
                
                // Check if this edge is already selected
                const isSelected = selectedEdges.has(edgeId);
                
                // Add to control points
                controlPoints.push({
                    x: midX,
                    y: midY,
                    edgeId: edgeId,
                    selected: isSelected,
                    startPoint: currPoint,
                    endPoint: nextPoint
                });
                
                // Draw the control point on the dedicated canvas
                controlPointsCtx.beginPath();
                controlPointsCtx.arc(midX, midY, 6, 0, Math.PI * 2); // Larger radius for easier selection
                
                if (isSelected) {
                    // Selected control points are filled
                    controlPointsCtx.fillStyle = '#ff0000';
                    controlPointsCtx.fill();
                    // Add a white border to make it more visible
                    controlPointsCtx.strokeStyle = '#ffffff';
                    controlPointsCtx.lineWidth = 2;
                    controlPointsCtx.stroke();
                } else {
                    // Unselected control points have white fill and red border
                    controlPointsCtx.fillStyle = '#ffffff';
                    controlPointsCtx.fill();
                    controlPointsCtx.strokeStyle = '#ff0000';
                    controlPointsCtx.lineWidth = 2;
                    controlPointsCtx.stroke();
                }
            }
        });
    }
    
    // Handle click on canvas for control point selection
    function handleCanvasClick(event) {
        if (!edgeSelectionMode) return;
        
        // Calculate click position relative to the canvas
        const rect = controlPointsCanvas.getBoundingClientRect();
        const scaleX = controlPointsCanvas.width / rect.width;
        const scaleY = controlPointsCanvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        console.log('Click at:', x, y);
        console.log('Control points:', controlPoints.length);
        
        // Check if click is on any control point
        let closestPoint = null;
        let minDistance = 15; // Detection radius
        
        for (let i = 0; i < controlPoints.length; i++) {
            const point = controlPoints[i];
            const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
            
            // Find the closest point within detection radius
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }
        
        // Toggle selection for the closest point if found
        if (closestPoint) {
            console.log('Control point clicked:', closestPoint.edgeId);
            
            if (selectedEdges.has(closestPoint.edgeId)) {
                selectedEdges.delete(closestPoint.edgeId);
            } else {
                selectedEdges.add(closestPoint.edgeId);
            }
            
            // Redraw border with updated selections
            generateBorder();
            markNeedsRender();
        }
    }
    
    function downloadResult() {
        // Create a temporary canvas to combine the image and border
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCanvas.width;
        tempCanvas.height = imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the border first (so it appears behind the image)
        tempCtx.drawImage(borderCanvas, 0, 0);
        
        // Then draw the image with shadow on top
        tempCtx.drawImage(imageCanvas, 0, 0);
        
        // Generate a unique filename with timestamp
        const timestamp = new Date().getTime();
        const fileName = `polygon-border-${timestamp}.png`;
        
        // Convert canvas to blob for downloading
        tempCanvas.toBlob(async (blob) => {
            // Download to Downloads folder
            const link = document.createElement('a');
            link.download = fileName;
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 'image/png');
    }
    
    function exportAsPsd() {
        if (!originalImage) return;
        
        // Determine which version of the library to use
        let psdLib;
        if (typeof window.agPsdLibrary !== 'undefined') {
            psdLib = window.agPsdLibrary;
        } else if (typeof agPsd !== 'undefined') {
            psdLib = agPsd;
        } else {
            console.error('Error: PSD library not loaded. Please refresh the page and try again.');
            alert('Error: PSD library not loaded. Please refresh the page and try again.');
            return;
        }
        
        // Create canvases for each layer
        const borderLayer = document.createElement('canvas');
        borderLayer.width = borderCanvas.width;
        borderLayer.height = borderCanvas.height;
        const borderLayerCtx = borderLayer.getContext('2d');
        
        // Create original image layer (without filters and effects)
        const originalImageLayer = document.createElement('canvas');
        originalImageLayer.width = imageCanvas.width;
        originalImageLayer.height = imageCanvas.height;
        const originalImageLayerCtx = originalImageLayer.getContext('2d');
        
        // Draw just the border on the border layer
        borderLayerCtx.drawImage(borderCanvas, 0, 0);
        
        // Draw the original image without any filters or effects on the original image layer
        const padding = originalImage.padding || 0;
        originalImageLayerCtx.drawImage(originalImage, padding, padding, originalImage.width, originalImage.height);
        
        // Create main composite canvas with border and original image
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = imageCanvas.width;
        compositeCanvas.height = imageCanvas.height;
        const compositeCtx = compositeCanvas.getContext('2d');
        compositeCtx.drawImage(borderCanvas, 0, 0);
        compositeCtx.drawImage(originalImageLayer, 0, 0);
        
        // Create PSD document with layers in proper order (original on top, visible)
        const psd = {
            width: imageCanvas.width,
            height: imageCanvas.height,
            children: [
                {
                    name: 'Border',
                    canvas: borderLayer
                },
                {
                    name: 'Original image',
                    canvas: originalImageLayer
                }
            ],
            // Add the composite image as the main canvas
            canvas: compositeCanvas
        };
        
        try {
            // Convert to PSD using ag-psd with thumbnail generation
            console.log('Converting to PSD format...');
            const psdBuffer = psdLib.writePsd(psd, { 
                generateThumbnail: true,
                psb: false,
                imageResources: {
                    resolutionInfo: {
                        horizontalResolution: 72,
                        horizontalResolutionUnit: "PPI",
                        widthUnit: "Inches",
                        verticalResolution: 72,
                        verticalResolutionUnit: "PPI",
                        heightUnit: "Inches"
                    }
                }
            });
            
            console.log('PSD created successfully, size:', psdBuffer.byteLength, 'bytes');
            
            // Generate a unique filename
            const timestamp = new Date().getTime();
            const fileName = `polygon-border-${timestamp}.psd`;
            
            // Create a blob from the PSD buffer
            const blob = new Blob([psdBuffer], { type: 'image/vnd.adobe.photoshop' });
            
            // Verify blob creation
            console.log('PSD blob created:', fileName, 'Size:', blob.size, 'bytes');
            
            if (blob.size === 0) {
                console.error('Warning: PSD blob is empty!');
                alert('Error: Generated PSD file is empty. Please try again.');
                return;
            }
            
            // Store the last created PSD data for direct opening
            lastCreatedPsdData = {
                buffer: psdBuffer,
                fileName: fileName,
                previewDataURL: compositeCanvas.toDataURL('image/png'),
                tags: ['polygon-border', 'auto-border', 'generated', 'psd'],
                annotation: "Generated with Auto Borders Tool"
            };
            
            // Store the blob and filename for drag-and-drop
            currentPsdBlob = blob;
            currentPsdFileName = fileName;
            
            // Show the drag button in uploading state
            dragPsdBtn.style.display = 'inline-flex';
            dragPsdBtnText.textContent = 'Uploading...';
            dragPsdBtn.draggable = false;
            
            // Upload to Firebase and update button when ready
            uploadPsdToFirebase(blob, fileName)
                .then((uploadResult) => {
                    console.log('PSD uploaded to Firebase for drag-and-drop:', uploadResult.url);
                    currentPsdFirebaseUrl = uploadResult.url;
                    currentPsdFirebasePath = uploadResult.path;
                    
                    // Update button to ready state
                    dragPsdBtnText.textContent = 'Drag URL';
                    dragPsdBtn.draggable = true;
                    dragPsdBtn.title = 'Drag this URL to another app';
                    
                    // Clean up after 1 hour (3600000 ms)
                    setTimeout(() => {
                        deletePsdFromFirebase(uploadResult.path);
                        currentPsdFirebaseUrl = null;
                        currentPsdFirebasePath = null;
                        dragPsdBtnText.textContent = 'Drag PSD';
                        dragPsdBtn.title = 'Drag this file to another app';
                    }, 3600000);
                })
                .catch((error) => {
                    console.error('Error uploading PSD to Firebase:', error);
                    
                    // Update button to fallback state
                    dragPsdBtnText.textContent = 'Drag PSD';
                    dragPsdBtn.draggable = true;
                    dragPsdBtn.title = 'Drag this file to another app (using blob URL)';
                    currentPsdFirebaseUrl = null;
                    currentPsdFirebasePath = null;
                });
            
            // Download the PSD file
            downloadAsPSD(blob, fileName);
        } catch (error) {
            console.error('Error creating PSD:', error);
            alert('Failed to create PSD file: ' + error.message);
        }
    }
    
    // Simple function to download PSD as a fallback
    function downloadAsPSD(blob, fileName) {
        try {
            // Try to use FileSaver if available
            if (window.saveAs) {
                saveAs(blob, fileName);
            } else {
                // Fallback to vanilla JS download
                const link = document.createElement('a');
                link.download = fileName;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download file: ' + error.message);
        }
    }
    
    
    // Function to initialize slider controls
    function initSliders() {
        const sliders = document.querySelectorAll('.slider');
        
        sliders.forEach(slider => {
            // Initialize the value display
            const valueDisplay = slider.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('slider-value')) {
                valueDisplay.textContent = slider.value;
                
                // Update value display when slider changes
                slider.addEventListener('input', function() {
                    valueDisplay.textContent = this.value;
                });
            }
        });
    }
    
    // Modified function to get slider value that respects custom values
    function getSliderValue(slider) {
        // First check if the corresponding value display has a custom value
        const valueDisplay = slider.nextElementSibling;
        if (valueDisplay && valueDisplay.hasAttribute('data-actual-value')) {
            return parseInt(valueDisplay.getAttribute('data-actual-value'));
        }
        
        // Otherwise return the slider value
        return parseInt(slider.value);
    }
    
    // Function to initialize draggable number controls
    function initDraggableNumbers() {
        // Find all draggable number elements
        const draggableNumbers = document.querySelectorAll('.number-input');
        
        draggableNumbers.forEach(numberInput => {
            // Get min, max, step, and current value from data attributes
            const min = parseFloat(numberInput.getAttribute('data-min') || 0);
            const max = parseFloat(numberInput.getAttribute('data-max') || 100);
            const step = parseFloat(numberInput.getAttribute('data-step') || 1);
            const value = parseFloat(numberInput.getAttribute('data-value') || 50);
            
            // Set initial value
            numberInput.textContent = value;
            numberInput.setAttribute('data-current-value', value);
            
            // Track dragging state
            let isDragging = false;
            let startX = 0;
            let startValue = 0;
            
            // Mouse down event
            numberInput.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startValue = parseFloat(numberInput.getAttribute('data-current-value'));
                numberInput.classList.add('dragging');
                
                // Prevent text selection
                e.preventDefault();
                
                // Add temporary global event listeners
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
            
            // Handle mouse move
            function handleMouseMove(e) {
                if (!isDragging) return;
                
                // Calculate drag distance
                const deltaX = e.clientX - startX;
                
                // Calculate new value with adaptive sensitivity based on the range size
                // This makes it easier to reach higher values for controls with large ranges
                const range = max - min;
                const elementId = numberInput.id;
                
                // Special handling for thickness and shadow size controls - use higher acceleration
                let sensitivity = 2; // Default sensitivity divisor (higher = less sensitive)
                let acceleration = 1; // Default acceleration
                
                // Apply enhanced sensitivity to thickness control
                if (elementId === 'thicknessRange') {
                    sensitivity = 1; // More sensitive
                    
                    // Add acceleration based on how far the user has dragged
                    const absDeltaX = Math.abs(deltaX);
                    if (absDeltaX > 100) {
                        // Accelerated movement for large drags
                        acceleration = Math.pow(absDeltaX / 100, 1.5); // Exponential acceleration
                    }
                }
                
                const deltaValue = (deltaX / sensitivity) * step * acceleration;
                let newValue = startValue + deltaValue;
                
                // Clamp value to min/max
                newValue = Math.max(min, Math.min(max, newValue));
                
                // Round to step precision
                newValue = Math.round(newValue / step) * step;
                
                // Update display
                numberInput.textContent = newValue;
                numberInput.setAttribute('data-current-value', newValue);
                
                // Dispatch custom event
                const changeEvent = new CustomEvent('numberchange', {
                    detail: { value: newValue }
                });
                numberInput.dispatchEvent(changeEvent);
            }
            
            // Handle mouse up
            function handleMouseUp() {
                isDragging = false;
                numberInput.classList.remove('dragging');
                
                // Remove temporary global event listeners
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                // Dispatch final change event
                const finalValue = parseFloat(numberInput.getAttribute('data-current-value'));
                const finalEvent = new CustomEvent('numberinputend', {
                    detail: { value: finalValue }
                });
                numberInput.dispatchEvent(finalEvent);
            }
            
            // Allow double-click to manually enter value
            numberInput.addEventListener('dblclick', (e) => {
                const currentValue = parseFloat(numberInput.getAttribute('data-current-value'));
                const userInput = prompt('Enter value:', currentValue);
                
                if (userInput !== null && !isNaN(parseFloat(userInput))) {
                    let newValue = parseFloat(userInput);
                    // Clamp to min/max
                    newValue = Math.max(min, Math.min(max, newValue));
                    
                    // Update display
                    numberInput.textContent = newValue;
                    numberInput.setAttribute('data-current-value', newValue);
                    
                    // Dispatch change event
                    const changeEvent = new CustomEvent('numberchange', {
                        detail: { value: newValue }
                    });
                    numberInput.dispatchEvent(changeEvent);
                }
            });
            
            // Make the number input focusable for keyboard controls
            numberInput.tabIndex = 0;
            
            // Add keyboard controls for easier value adjustment
            numberInput.addEventListener('keydown', (e) => {
                const currentValue = parseFloat(numberInput.getAttribute('data-current-value'));
                let newValue = currentValue;
                const isUnlimitedControl = numberInput.id === 'thicknessRange';
                
                // Default step size
                let jumpSize = step;
                
                // Larger jumps with shift key
                if (e.shiftKey) {
                    jumpSize = isUnlimitedControl ? 10 : 5;
                }
                
                // Even larger jumps with shift+alt
                if (e.shiftKey && e.altKey) {
                    jumpSize = isUnlimitedControl ? 50 : 10;
                }
                
                switch (e.key) {
                    case 'ArrowUp':
                    case 'ArrowRight':
                        newValue = currentValue + jumpSize;
                        break;
                    case 'ArrowDown':
                    case 'ArrowLeft':
                        newValue = currentValue - jumpSize;
                        break;
                    case 'Home':
                        newValue = min;
                        break;
                    case 'End':
                        newValue = max;
                        break;
                    case 'PageUp':
                        newValue = currentValue + (isUnlimitedControl ? 100 : 20);
                        break;
                    case 'PageDown':
                        newValue = currentValue - (isUnlimitedControl ? 100 : 20);
                        break;
                    default:
                        return; // Exit if not handling this key
                }
                
                // Clamp value to min/max
                newValue = Math.max(min, Math.min(max, newValue));
                
                // Round to step precision
                newValue = Math.round(newValue / step) * step;
                
                // Update display
                numberInput.textContent = newValue;
                numberInput.setAttribute('data-current-value', newValue);
                
                // Dispatch change event
                const changeEvent = new CustomEvent('numberchange', {
                    detail: { value: newValue }
                });
                numberInput.dispatchEvent(changeEvent);
                
                // Prevent default (page scrolling, etc.)
                e.preventDefault();
            });
        });
    }
    
    function updateThickness(newValue) {
        // Ensure thickness is within the slider range
        newValue = Math.max(0, Math.min(500, newValue));
        currentThickness = newValue;
        thicknessValue.textContent = newValue;
        thicknessRange.value = newValue;
        generateBorder();
        markNeedsRender();
    }

    // Function to add a file to Eagle library using the Eagle API
    function addFileToEagle(fileName) {
        console.warn('addFileToEagle is deprecated - using direct API');
        // Eagle API endpoint to add a file from path
        const eagleApiUrl = 'http://localhost:41595/api/item/addFromPath';
        
        // Get the Downloads folder path (this is a best-effort guess, it depends on user's system)
        const downloadsPath = getDownloadsFolder();
        
        if (!downloadsPath) {
            console.error('Could not determine Downloads folder path. Please manually add the file to Eagle.');
            return;
        }
        
        // Construct the full file path
        const filePath = `${downloadsPath}/${fileName}`;
        
        // Prepare the request data for Eagle API
        const requestData = {
            path: filePath,
            name: 'Polygon Border Image',
            tags: ['auto-borders', 'polygon', 'border'],
            folder: '' // This will add to the root folder in Eagle
        };
        
        console.log('Sending deprecated request to Eagle API:', eagleApiUrl);
        
        // Make the API request to Eagle
        fetch(eagleApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('File successfully added to Eagle library!');
            } else {
                console.error('Eagle API error:', data);
                console.error('Failed to add file to Eagle. See console for details.');
            }
        })
        .catch(error => {
            console.error('Error adding file to Eagle:', error);
            console.error('Failed to add file to Eagle. Is Eagle running? See console for details.');
        });
    }

    // Helper function to get downloads folder (best effort)
    function getDownloadsFolder() {
        // This is a simple approach that will work in many cases
        // For more robust behavior, you might need a dedicated library or backend
        
        // Default locations by platform
        if (navigator.platform.includes('Win')) {
            // Windows
            return `C:\\Users\\${getUserName()}\\Downloads`;
        } else if (navigator.platform.includes('Mac')) {
            // macOS
            return `/Users/${getUserName()}/Downloads`;
        } else if (navigator.platform.includes('Linux')) {
            // Linux
            return `/home/${getUserName()}/Downloads`;
        }
        
        // Fallback
        return null;
    }

    // Helper function to get username (best effort)
    function getUserName() {
        // Simple approach to guess username from document.cookie or localStorage
        // This is not reliable but might work in some cases
        // A better approach would be to ask the user for their downloads path
        
        // For this simple example, we'll return a placeholder
        return 'user';
    }

    // Function to apply image (simplified - no filters or shadows)
    function applyImageFilters() {
        if (!originalImage) return;
        
        const padding = originalImage.padding || 0;
        
        // Clear the canvas first
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        
        // Draw the original image without any effects
        imageCtx.drawImage(originalImage, padding, padding, originalImage.width, originalImage.height);
        
        // Detect edges on the clean image
        detectEdges();
        
        // Display image dimensions
        displayImageDimensions();
        
        // Regenerate border with the new edge data
        generateBorder();
    }

    // Function to add the current PSD to Eagle library
    function addToEagleLibrary() {
        if (!originalImage) {
            console.error('No image to add to library');
            return;
        }
        
        // First, explicitly check if Eagle is running
        isEagleAppRunning().then(isRunning => {
            if (!isRunning) {
                console.error('Eagle App is not running or not responding to API requests');
                
                // Log a detailed error message
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                if (isMac) {
                    console.error('Could not connect to Eagle App. Possible reasons:\n' +
                          '1. Eagle App is not running on Mac\n' +
                          '2. API access is not enabled in Eagle App preferences\n' +
                          '3. Firewall is blocking localhost connections');
                } else {
                    console.error('Eagle App is not running. Try saving as PNG and dragging into Eagle manually.');
                }
                return;
            }
            
            // Eagle is running, proceed with adding the image
            console.log('Eagle App is running, proceeding to add image...');
            
            // Create a composite canvas with all layers
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = imageCanvas.width;
            compositeCanvas.height = imageCanvas.height;
            const compositeCtx = compositeCanvas.getContext('2d');
            
            // Draw border layer
            compositeCtx.drawImage(borderCanvas, 0, 0);
            // Draw image layer
            compositeCtx.drawImage(imageCanvas, 0, 0);
            
            // Convert to PNG data URL
            const imageDataURL = compositeCanvas.toDataURL('image/png');
            
            // Create a timestamp for unique file naming
            const timestamp = new Date().getTime();
            const fileName = `polygon-border-${timestamp}.png`;
            
            // Prepare tags for the image (empty array - no tags for PNG files)
            const tags = [];
            
            // First try direct API method
            tryDirectEagleAPI(imageDataURL, fileName, tags).catch(error => {
                console.error('Direct Eagle API failed:', error);
                
                // Fall back to proxy method if direct method fails
                console.log('Falling back to proxy method...');
                const proxySuccess = sendToEagleViaProxy(imageDataURL, fileName, tags);
                
                if (!proxySuccess) {
                    // If proxy method also fails, log error
                    console.error('Unable to connect to Eagle App. Please verify it is running and API access is enabled.');
                }
            });
        });
    }
    
    // Function to try direct Eagle API connection
    function tryDirectEagleAPI(fileURL, fileName, tags, fileType = 'png') {
        return new Promise((resolve, reject) => {
            console.log(`Trying direct Eagle API connection for ${fileType} file...`);
            
            // Eagle App API token from config
            const eagleApiToken = window.eagleConfig ? window.eagleConfig.apiToken : '';
            
            // Eagle API endpoint for adding from URL
            const apiUrl = 'http://127.0.0.1:41595/api/item/addFromURL';
            
            // Prepare payload
            const payload = {
                url: fileURL,
                name: fileName,
                tags: fileType === 'png' ? [] : tags, // Don't add tags for PNG files
                annotation: "Generated with Auto Borders Tool",
                website: window.location.href
            };
            
            // Add file type metadata if it's a PSD
            if (fileType === 'psd') {
                payload.ext = 'psd';
                payload.mimetype = 'image/vnd.adobe.photoshop';

                // For external URLs with PSD files, we need to ensure Eagle knows it's a PSD
                console.log('Using enhanced PSD handling for external URL:', fileURL);
                console.log('SENDING PSD TO EAGLE - URL: ' + fileURL);
                console.log({payload});
                
                // Try to fetch with addFromURL first
                fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${eagleApiToken}`
                    },
                    body: JSON.stringify(payload)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Eagle API responded with status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Eagle API response for PSD:', data);
                    resolve(data);
                })
                .catch(error => {
                    console.error('Error adding PSD to Eagle library via API:', error);
                    reject(error);
                });
                
                return; // Skip the rest of the function for PSD files
            }
            
            // Send the request with no-cors mode (for non-PSD files)
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${eagleApiToken}`
                },
                body: JSON.stringify(payload),
                mode: 'no-cors'
            })
            .then(response => {
                console.log('Direct Eagle API response received');
                // In no-cors mode, we can't read the response
                // but if we get here without error, it's likely successful
                resolve();
            })
            .catch(error => {
                console.error('Error adding to Eagle library:', error);
                reject(error);
            });
        });
    }
    
    // Helper function to check if Eagle App is running
    function isEagleAppRunning() {
        return new Promise((resolve) => {
            console.log('Checking if Eagle App is running...');
            
            // Allow a longer timeout for Eagle App response
            const timeoutDuration = 5000; // 5 seconds
            const timeout = setTimeout(() => {
                console.error('Eagle App check timed out after 5 seconds');
                resolve(false);
            }, timeoutDuration);
            
            // Eagle App API token from config
            const eagleApiToken = window.eagleConfig ? window.eagleConfig.apiToken : '';
            
            // Use the local app URL
            const apiUrl = 'http://127.0.0.1:41595/api/application/info';
            
            // Try with simple no-cors approach first
            fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${eagleApiToken}`
                },
                cache: 'no-cache',
                mode: 'no-cors' // Try with no-cors mode first to avoid CORS errors
            })
            .then(response => {
                clearTimeout(timeout);
                // In no-cors mode, we can't read response status, but if we get here without error,
                // it's likely the app is running
                console.log('Eagle App API response received (no-cors mode)');
                // With no-cors we can't actually read the response data
                // but at least we know the request didn't fail
                resolve(true);
            })
            .catch(error => {
                clearTimeout(timeout);
                console.error('Error checking Eagle App with no-cors mode:', error.message);
                
                // Fallback: Try the Eagle proxy frame approach
                tryEagleProxyCheck().then(isRunning => {
                    resolve(isRunning);
                });
            });
        });
    }
    
    // Helper function to check Eagle availability via iframe proxy
    function tryEagleProxyCheck() {
        return new Promise((resolve) => {
            console.log('Trying Eagle proxy frame check...');
            
            // Create a temporary invisible iframe
            const tempFrame = document.createElement('iframe');
            tempFrame.style.display = 'none';
            document.body.appendChild(tempFrame);
            
            // Set a timeout for the check
            const checkTimeout = setTimeout(() => {
                document.body.removeChild(tempFrame);
                console.error('Eagle proxy check timed out');
                resolve(false);
            }, 3000);
            
            // Listen for messages from the iframe
            const messageHandler = function(event) {
                if (event.data && event.data.eagleCheck) {
                    window.removeEventListener('message', messageHandler);
                    clearTimeout(checkTimeout);
                    document.body.removeChild(tempFrame);
                    console.log('Eagle proxy check result:', event.data.running);
                    resolve(event.data.running);
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Set the iframe content to a simple page that tries to connect to Eagle
            tempFrame.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <script>
                        // Get API token from parent window
                        const eagleApiToken = window.parent.eagleConfig ? window.parent.eagleConfig.apiToken : '';
                        
                        // Try to ping Eagle
                        fetch('http://127.0.0.1:41595/api/application/info', {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + eagleApiToken
                            }
                        })
                        .then(response => {
                            // Send message back to parent
                            window.parent.postMessage({
                                eagleCheck: true,
                                running: true
                            }, '*');
                        })
                        .catch(error => {
                            // Send message back to parent
                            window.parent.postMessage({
                                eagleCheck: true,
                                running: false
                            }, '*');
                        });
                    </script>
                </head>
                <body>Eagle App Check</body>
                </html>
            `;
        });
    }
    
    // Helper function to prompt for folder selection
    function promptForFolder() {
        return new Promise((resolve) => {
            selectExportFolder().then(folderHandle => {
                if (folderHandle) {
                    // Save the selected handle for future use
                    saveDirectoryHandle(folderHandle);
                    // Update UI to reflect the selected folder
                    updateFolderInfoUI(folderHandle.name);
                    // Also display the reset folder button if it exists
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'block';
                    }
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch(error => {
                console.error('Error selecting folder:', error);
                alert('Failed to select folder: ' + error.message);
                resolve(false);
            });
        });
    }
    
    // Helper function to update folder info in the UI
    function updateFolderInfoUI(folderName) {
        // Use the global variable instead of redeclaring it
        const toggleLabel = document.querySelector('.export-toggle-container .toggle-label');
        
        if (toggleLabel) {
            // Format shorter for better UI appearance
            if (folderName.length > 15) {
                const shortName = folderName.substring(0, 12) + '...';
                toggleLabel.textContent = `Also save to "${shortName}" folder`;
                // Set full name as title for tooltip on hover
                toggleLabel.title = `Also save to "${folderName}" folder`;
            } else {
                toggleLabel.textContent = `Also save to "${folderName}" folder`;
                toggleLabel.title = '';
            }
        }
        
        if (resetFolderBtn) {
            resetFolderBtn.title = `Change library folder (current: ${folderName})`;
        }
    }

    // Helper to save directory handle to localStorage
    function saveDirectoryHandle(dirHandle) {
        if (dirHandle && 'showDirectoryPicker' in window) {
            // We can't directly store the dirHandle in localStorage, so we'll store some metadata
            const folderData = {
                name: dirHandle.name,
                kind: dirHandle.kind,
                timestamp: Date.now()
            };
            
            localStorage.setItem('savedExportFolderData', JSON.stringify(folderData));
            
            // Store the actual handle in a global variable for this session
            window.lastDirectoryHandle = dirHandle;
            
            // Update the UI to reflect the selected folder
            updateFolderInfoUI(dirHandle.name);
        }
    }

    // Helper to retrieve saved directory handle
    function getSavedDirectoryHandle() {
        // Try to get from the session first (most reliable)
        if (window.lastDirectoryHandle) {
            return window.lastDirectoryHandle;
        }
        
        // Check if we have saved data and a picker API
        const savedData = localStorage.getItem('savedExportFolderData');
        if (!savedData || !('showDirectoryPicker' in window)) {
            return null;
        }
        
        // For now, return null - we'll handle this later in addToEagleLibrary
        return null;
    }

    // Check if we have permission to the directory
    async function verifyPermission(fileHandle, readWrite) {
        if (!fileHandle) {
            return false;
        }
        
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        
        // Check if permission was already granted
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        
        // Request permission
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        
        return false;
    }

    // Function to prompt user to select an export folder
    async function selectExportFolder() {
        try {
            // Check if the File System Access API is supported
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker({
                    id: 'exportFolder',
                    mode: 'readwrite',
                    startIn: 'downloads'
                });
                
                // Return the actual directory handle
                return dirHandle;
            } else {
                // Fallback for browsers without File System Access API
                alert('Your browser does not support folder selection. The file will be downloaded instead.');
                return null;
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
            if (error.name === 'AbortError') {
                // User cancelled the selection
                return null;
            }
            throw error;
        }
    }

    // Function to auto-select the export folder without user interaction
    async function selectExportFolderAuto() {
        try {
            // Check if the File System Access API is available
            if (!('showDirectoryPicker' in window)) {
                console.warn('File System Access API not supported');
                return null;
            }
            
            // Get the saved folder data to provide better feedback
            const savedData = localStorage.getItem('savedExportFolderData');
            if (!savedData) {
                console.warn('No saved folder data found');
                return null;
            }
            
            const folderData = JSON.parse(savedData);
            console.log(`Attempting to automatically access folder: ${folderData.name}`);
            
            // Use specific options to improve the chances of getting the right folder
            const options = {
                id: 'exportFolder', // Use a consistent ID for the picker
                mode: 'readwrite',
                // Don't specify startIn to let the browser remember the last location
            };
            
            // Try to get the directory handle without user interaction
            // In Chrome, this might still show a dialog, but it should be pre-selected to the last folder
            const dirHandle = await window.showDirectoryPicker(options);
            
            if (dirHandle) {
                if (dirHandle.name === folderData.name) {
                    console.log(`Successfully connected to folder: ${dirHandle.name}`);
                } else {
                    console.log(`Connected to a different folder: ${dirHandle.name} (previous was ${folderData.name})`);
                }
            }
            
            return dirHandle;
        } catch (error) {
            console.error('Error in auto folder selection:', error);
            if (error.name === 'AbortError') {
                // User cancelled the selection
                return null;
            }
            throw error;
        }
    }

    // Function to export PSD to the selected folder
    async function exportPsdToFolder(folderHandle) {
        if (!folderHandle) {
            console.error('No folder handle provided');
            alert('Error: No folder selected. Please try again and select a folder.');
            return;
        }
        
        // First check if we have write permission for the folder
        try {
            const hasPermission = await verifyPermission(folderHandle, true);
            if (!hasPermission) {
                console.error('Permission denied to write to folder');
                alert('Permission denied to write to the selected folder. Please select the folder again.');
                promptForFolder();
                return;
            }
        } catch (permError) {
            console.error('Error checking folder permissions:', permError);
            alert('Error checking folder permissions. Please try selecting the folder again.');
            promptForFolder();
            return;
        }
        
        // Now, generate the PSD file
        let psdLib;
        if (typeof window.agPsdLibrary !== 'undefined') {
            psdLib = window.agPsdLibrary;
        } else if (typeof agPsd !== 'undefined') {
            psdLib = agPsd;
        } else {
            console.error('Error: PSD library not loaded. Please refresh the page and try again.');
            alert('Error: PSD library not loaded. Please refresh the page and try again.');
            return;
        }
        
        try {
            console.log('Creating PSD data...');
            
            // Create canvases for each layer
            const imageLayer = document.createElement('canvas');
            imageLayer.width = imageCanvas.width;
            imageLayer.height = imageCanvas.height;
            const imageLayerCtx = imageLayer.getContext('2d');
            
            const borderLayer = document.createElement('canvas');
            borderLayer.width = borderCanvas.width;
            borderLayer.height = borderCanvas.height;
            const borderLayerCtx = borderLayer.getContext('2d');
            
            // Draw image with all styling on the image layer
            imageLayerCtx.drawImage(imageCanvas, 0, 0);
            
            // Draw just the border on the border layer
            borderLayerCtx.drawImage(borderCanvas, 0, 0);
            
            // Create main composite canvas with all layers combined
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = imageCanvas.width;
            compositeCanvas.height = imageCanvas.height;
            const compositeCtx = compositeCanvas.getContext('2d');
            compositeCtx.drawImage(borderCanvas, 0, 0);
            compositeCtx.drawImage(imageCanvas, 0, 0);
            
            // Create PSD document
            const psd = {
                width: imageCanvas.width,
                height: imageCanvas.height,
                children: [
                    {
                        name: 'Border',
                        canvas: borderLayer
                    },
                    {
                        name: 'Image with styling',
                        canvas: imageLayer
                    }
                ],
                // Add the composite image as the main canvas
                canvas: compositeCanvas
            };
            
            // Convert to PSD using ag-psd with thumbnail generation
            console.log('Converting to PSD format...');
            const psdBuffer = psdLib.writePsd(psd, { 
                generateThumbnail: true,
                psb: false,
                imageResources: {
                    resolutionInfo: {
                        horizontalResolution: 72,
                        horizontalResolutionUnit: "PPI",
                        widthUnit: "Inches",
                        verticalResolution: 72,
                        verticalResolutionUnit: "PPI",
                        heightUnit: "Inches"
                    }
                }
            });
            
            console.log('PSD created successfully, size:', psdBuffer.byteLength, 'bytes');
            
            // Generate a unique filename
            const timestamp = new Date().getTime();
            const fileName = `polygon-border-${timestamp}.psd`;
            
            // Create a blob from the PSD buffer
            const blob = new Blob([psdBuffer], { type: 'image/vnd.adobe.photoshop' });
            
            // Now try to write the file to the selected folder
            try {
                // Create a file in the directory
                const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
                
                // Get a writable stream to the file
                const writable = await fileHandle.createWritable();
                
                // Write the blob to the file
                await writable.write(blob);
                
                // Close the file
                await writable.close();
                
                // Show success message with folder path
                alert(`PSD file '${fileName}' has been saved to: ${folderHandle.name}`);
                return;
            } catch (fileError) {
                console.error('Error writing file to selected folder:', fileError);
                
                // Check for specific errors
                if (fileError.name === 'NotAllowedError') {
                    alert(`Permission error: Could not write to "${folderHandle.name}" folder. The folder selection will be reset.`);
                    resetExportFolder();
                } else if (fileError.name === 'NoModificationAllowedError') {
                    alert(`The folder "${folderHandle.name}" is read-only. Please select a different folder.`);
                    promptForFolder();
                } else {
                    // Generic error, fall back to download
                    alert(`Could not save to "${folderHandle.name}" folder (${fileError.message}). Downloading file instead.`);
                    downloadAsPSD(blob, fileName);
                }
                return;
            }
        } catch (error) {
            console.error('Error creating PSD file:', error);
            alert('Failed to create PSD file: ' + error.message);
        }
    }

    // Function to reset the saved export folder
    function resetExportFolder() {
        // Get the current folder name for feedback
        let folderName = "default";
        const savedData = localStorage.getItem('savedExportFolderData');
        if (savedData) {
            try {
                const folderData = JSON.parse(savedData);
                folderName = folderData.name;
            } catch (e) {
                console.error('Error parsing saved folder data:', e);
            }
        }
        
        // Clear the localStorage data
        localStorage.removeItem('savedExportFolderData');
        
        // Clear the in-memory handle
        window.lastDirectoryHandle = null;
        
        // Show feedback to the user
        const resetButton = document.getElementById('resetFolderBtn');
        
        // Visual feedback by briefly changing the button appearance
        if (resetButton) {
            const originalColor = resetButton.style.backgroundColor || '#e2e2e2';
            resetButton.style.backgroundColor = '#4CAF50'; // Green to indicate success
            
            // Reset back after a short delay
            setTimeout(() => {
                resetButton.style.backgroundColor = originalColor;
            }, 500);
        }
        
        // Log the reset action
        console.log(`Export folder "${folderName}" has been reset. User will be prompted to select a folder next time they export.`);
    }

    // Function to initialize folder persistence
    function initFolderPersistence() {
        console.log('Initializing folder persistence and Eagle integration');
        
        // Get reference to toggle - use the global variable, don't redeclare it
        addToLibraryToggle = document.getElementById('addToLibraryToggle');
        
        // Check if Eagle app is running at startup
        if (addToLibraryToggle) {
            // Always default to off regardless of whether Eagle is running or not
            addToLibraryToggle.checked = false;
            
            // Check if Eagle is running (just for logging)
            isEagleAppRunning().then(isRunning => {
                console.log('Eagle App running status:', isRunning);
                
                // Add listener for toggle change after initial check
                if (addToLibraryToggle) {
                    addToLibraryToggle.addEventListener('change', handleToggleChange);
                }
            });
        }
        
        // Check if we have saved folder data
        const savedData = localStorage.getItem('savedExportFolderData');
        const toggleLabel = document.querySelector('.export-toggle-container .toggle-label');
        const resetFolderBtn = document.getElementById('resetFolderBtn');
        
        if (savedData && 'showDirectoryPicker' in window) {
            try {
                // Parse the saved data
                const folderData = JSON.parse(savedData);
                console.log(`Previous folder selection found: ${folderData.name}`);
                
                // Update UI to show we have a saved folder
                const exportToggleContainer = document.querySelector('.export-toggle-container');
                
                // Update the folder info if not using Eagle
                if (addToLibraryToggle && !addToLibraryToggle.checked) {
                    updateFolderInfoUI(folderData.name);
                    
                    // Show the reset folder button only when not using Eagle API
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'inline-block';
                    }
                } else {
                    // Hide reset folder button when using Eagle
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'none';
                    }
                }
                
                // If we're on Chrome, try to pre-obtain the directory handle in the background
                if (navigator.userAgent.includes('Chrome')) {
                    console.log('Attempting to pre-validate folder access...');
                    
                    // Wait a short time before trying to access the folder
                    setTimeout(() => {
                        selectExportFolderAuto()
                            .then(dirHandle => {
                                if (dirHandle) {
                                    console.log('Pre-validated folder access successful');
                                    window.lastDirectoryHandle = dirHandle;
                                }
                            })
                            .catch(error => {
                                console.log('Pre-validation failed, will try again when needed', error);
                            });
                    }, 2000); // Wait 2 seconds to not interfere with page load
                }
            } catch (error) {
                console.error('Error parsing saved folder data during initialization:', error);
                localStorage.removeItem('savedExportFolderData');
            }
        }
    }

    // Function to export PNG to the library folder
    async function exportPngToFolder(folderHandle, pngBlob, fileName) {
        if (!folderHandle) {
            console.error('No folder handle provided');
            return false;
        }
        
        try {
            // Check if we have write permission
            const hasPermission = await verifyPermission(folderHandle, true);
            if (!hasPermission) {
                console.error('Permission denied to write to folder');
                console.error('Permission denied to write to the selected folder.');
                return false;
            }
            
            // Create a file in the directory
            const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
            
            // Get a writable stream to the file
            const writable = await fileHandle.createWritable();
            
            // Write the blob to the file
            await writable.write(pngBlob);
            
            // Close the file
            await writable.close();
            
            console.log(`PNG file '${fileName}' has been saved to: ${folderHandle.name}`);
            return true;
        } catch (fileError) {
            console.error('Error writing PNG file to selected folder:', fileError);
            return false;
        }
    }

    // Function to handle toggle change
    function handleToggleChange() {
        const isChecked = addToLibraryToggle.checked;
        const toggleLabel = document.querySelector('.export-toggle-container .toggle-label');
        const resetFolderBtn = document.getElementById('resetFolderBtn');
        
        console.log('Toggle changed, Eagle API mode:', isChecked);
        
        if (isChecked) {
            // If Eagle API toggle is checked, verify Eagle is running
            isEagleAppRunning().then(isRunning => {
                if (isRunning) {
                    console.log('Eagle App is running - API integration enabled');
                    if (toggleLabel) {
                        toggleLabel.textContent = 'Add to Eagle Library ✓';
                    }
                    
                    // Update download button tooltips to indicate Eagle integration
                    const downloadBtn = document.getElementById('downloadBtn');
                    if (downloadBtn) {
                        downloadBtn.title = "Download PNG and add to Eagle library";
                    }
                    
                    const exportPsdBtn = document.getElementById('exportPsdBtn');
                    if (exportPsdBtn) {
                        // Update tooltip for PSD button to indicate folder selection will be used
                        exportPsdBtn.title = "Download PSD and save to Eagle library folder";
                    }
                    
                    // Show the reset folder button for PSD folder selection
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'inline-block';
                    }
                } else {
                    console.log('Eagle App is not running - disabling API integration');
                    addToLibraryToggle.checked = false;
                    
                    if (toggleLabel) {
                        toggleLabel.textContent = 'Add to Eagle Library';
                    }
                    
                    // Reset download button tooltips
                    const downloadBtn = document.getElementById('downloadBtn');
                    if (downloadBtn) {
                        downloadBtn.title = "Download PNG";
                    }
                    
                    const exportPsdBtn = document.getElementById('exportPsdBtn');
                    if (exportPsdBtn) {
                        exportPsdBtn.title = "Download PSD";
                    }
                    
                    // Since Eagle is not available, we need to fall back to folder selection
                    // But we'll only prompt when trying to save, not when toggling
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'inline-block';
                    }
                }
            });
        } else {
            // Toggle is unchecked - use folder selection functionality
            if (toggleLabel) {
                toggleLabel.textContent = 'Add to Eagle Library';
            }
            
            // Reset download button tooltips
            const downloadBtn = document.getElementById('downloadBtn');
            if (downloadBtn) {
                downloadBtn.title = "Download PNG";
            }
            
            const exportPsdBtn = document.getElementById('exportPsdBtn');
            if (exportPsdBtn) {
                exportPsdBtn.title = "Download PSD";
            }
            
            // Show the reset folder button
            if (resetFolderBtn) {
                resetFolderBtn.style.display = 'inline-block';
            }
            
            // Check if we have a folder selected but don't prompt
            const savedFolderHandle = getSavedDirectoryHandle();
            if (!savedFolderHandle) {
                const savedData = localStorage.getItem('savedExportFolderData');
                
                if (savedData) {
                    // Try to auto-select the folder
                    selectExportFolderAuto().then(folderHandle => {
                        if (folderHandle) {
                            // Save the selected handle for future use
                            saveDirectoryHandle(folderHandle);
                        }
                    }).catch(error => {
                        console.error('Error auto-selecting folder:', error);
                    });
                }
            }
        }
    }

    // Function to try Eagle API communication through an iframe proxy (works around CORS)
    function sendToEagleViaProxy(imageDataURL, fileName, tags, fileType = 'png') {
        console.log(`Attempting Eagle API via iframe proxy for ${fileType} file...`);
        
        // Return a promise to better handle success/failure
        return new Promise((resolve, reject) => {
            // Get the iframe or create one if it doesn't exist
            let frame = document.getElementById('eagleProxyFrame');
            if (!frame) {
                frame = document.createElement('iframe');
                frame.id = 'eagleProxyFrame';
                frame.style.display = 'none';
                document.body.appendChild(frame);
            }
            
            // Eagle App API token
            const eagleApiToken = window.eagleConfig ? window.eagleConfig.apiToken : '';
            
            // Set up message listener for iframe response
            const messageHandler = function(event) {
                if (event.data && event.data.eagleApiResult) {
                    window.removeEventListener('message', messageHandler);
                    if (event.data.success) {
                        console.log('Eagle proxy reported success');
                        resolve(true);
                    } else {
                        console.error('Eagle proxy reported failure:', event.data.error);
                        reject(new Error(event.data.error || 'Unknown error from Eagle proxy'));
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Set a timeout for the proxy operation
            const proxyTimeout = setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('Eagle proxy operation timed out'));
            }, 10000);
            
            // Create HTML content with a form that will auto-submit via JavaScript
            const formHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Eagle API Proxy</title>
                    <script>
                    function submitToEagle() {
                        const payload = {
                            url: "${imageDataURL}",
                            name: "${fileName}",
                            tags: ${fileType === 'png' ? '[]' : JSON.stringify(tags)},
                            annotation: "Generated with Auto Borders Tool",
                            website: "${window.location.href}"
                        };
                        
                        fetch("http://127.0.0.1:41595/api/item/addFromURL", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bearer ${eagleApiToken}"
                            },
                            body: JSON.stringify(payload)
                        })
                        .then(response => {
                            if (response.ok) {
                                // Notify the parent window of success
                                window.parent.postMessage({
                                    eagleApiResult: true,
                                    success: true
                                }, '*');
                                return response.json();
                            } else {
                                throw new Error("Eagle API responded with status: " + response.status);
                            }
                        })
                        .then(data => {
                            console.log("Eagle API response:", data);
                        })
                        .catch(error => {
                            console.error("Error sending to Eagle:", error);
                            // Notify the parent window of failure
                            window.parent.postMessage({
                                eagleApiResult: true,
                                success: false,
                                error: error.message
                            }, '*');
                        });
                    }
                    
                    // Execute on page load
                    window.onload = submitToEagle;
                    </script>
                </head>
                <body>Sending to Eagle...</body>
                </html>
            `;
            
            // Set the iframe content
            frame.srcdoc = formHtml;
            
            return true;
        });
    }

    // New function specifically for sending PSDs to Eagle through proxy with special handling
    function sendToEagleViaProxyForPSD(previewURL, fileName, tags, psdBlob) {
        console.log(`Attempting Eagle API via iframe proxy for PSD file with preview...`);
        
        // Return a promise to better handle success/failure
        return new Promise((resolve, reject) => {
            // Get the iframe or create one if it doesn't exist
            let frame = document.getElementById('eagleProxyFrame');
            if (!frame) {
                frame = document.createElement('iframe');
                frame.id = 'eagleProxyFrame';
                frame.style.display = 'none';
                document.body.appendChild(frame);
            }
            
            // Eagle App API token
            const eagleApiToken = window.eagleConfig ? window.eagleConfig.apiToken : '';
            
            // First save the PSD to a temp file using FileSaver
            if (window.saveAs) {
                // Convert blob to file for handling in the iframe
                const file = new File([psdBlob], fileName, {type: 'image/vnd.adobe.photoshop'});
                
                // Set up message listener for iframe response
                const messageHandler = function(event) {
                    if (event.data && event.data.eagleApiResult) {
                        window.removeEventListener('message', messageHandler);
                        if (event.data.success) {
                            console.log('Eagle proxy reported success for PSD');
                            resolve(true);
                        } else {
                            console.error('Eagle proxy reported failure for PSD:', event.data.error);
                            reject(new Error(event.data.error || 'Unknown error from Eagle proxy'));
                        }
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                // Set a timeout for the proxy operation
                const proxyTimeout = setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('Eagle proxy operation timed out'));
                }, 15000); // Longer timeout for PSD files
                
                // Create HTML content with a form that will use FileReader to handle the PSD
                const formHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Eagle API Proxy for PSD</title>
                        <script>
                        function submitToEagle() {
                            // Use the preview URL for the thumbnail
                            const payload = {
                                url: "${previewURL}",
                                name: "${fileName}",
                                tags: ${JSON.stringify(tags)},
                                annotation: "Generated with Auto Borders Tool",
                                website: "${window.location.href}",
                                ext: "psd",
                                mimetype: "image/vnd.adobe.photoshop"
                            };
                            
                            fetch("http://127.0.0.1:41595/api/item/addFromURL", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": "Bearer ${eagleApiToken}"
                                },
                                body: JSON.stringify(payload)
                            })
                            .then(response => {
                                if (response.ok) {
                                    // Notify the parent window of success
                                    window.parent.postMessage({
                                        eagleApiResult: true,
                                        success: true
                                    }, '*');
                                    return response.json();
                                } else {
                                    throw new Error("Eagle API responded with status: " + response.status);
                                }
                            })
                            .then(data => {
                                console.log("Eagle API response for PSD:", data);
                            })
                            .catch(error => {
                                console.error("Error sending PSD to Eagle:", error);
                                // Notify the parent window of failure
                                window.parent.postMessage({
                                    eagleApiResult: true,
                                    success: false,
                                    error: error.message
                                }, '*');
                            });
                        }
                        
                        // Execute on page load
                        window.onload = submitToEagle;
                        </script>
                    </head>
                    <body>Sending PSD to Eagle...</body>
                    </html>
                `;
                
                // Set the iframe content
                frame.srcdoc = formHtml;
            } else {
                reject(new Error('FileSaver.js not available'));
            }
        });
    }

    // New function for sending PSD files to Eagle with a reliable approach
    function sendPsdToEagle(psdFile, previewDataURL, fileName, metadata) {
        console.log('Using improved approach for PSD to Eagle transfer...');
        
        // Display a processing message
        const processingMessage = document.createElement('div');
        processingMessage.className = 'processing-message';
        processingMessage.innerHTML = `
            <div class="processing-content">
                <div class="spinner"></div>
                <div>Sending PSD to Eagle...</div>
            </div>
        `;
        document.body.appendChild(processingMessage);
        
        // Create a Blob URL from the preview for the thumbnail
        const previewBlob = dataURLtoBlob(previewDataURL);
        const previewURL = URL.createObjectURL(previewBlob);
        
        // Create a separate File object for the PSD to ensure it's handled correctly
        const psdFileObj = new File([psdFile], fileName, {
            type: 'image/vnd.adobe.photoshop'
        });
        
        // Convert the PSD to a blob URL
        const psdBlobURL = URL.createObjectURL(psdFileObj);
        
        try {
            // Use Eagle's application protocol link instead of direct API calls
            // This bypasses CORS restrictions by opening Eagle directly
            
            // Format tags for Eagle
            const tagsString = metadata.tags.join(',');
            
            // Create the Eagle application link
            const eagleAppLink = `eagle://item/add?url=${encodeURIComponent(psdBlobURL)}&name=${encodeURIComponent(fileName)}&tags=${encodeURIComponent(tagsString)}&ext=psd&annotation=${encodeURIComponent(metadata.annotation)}`;
            
            console.log('Opening Eagle with app link:', eagleAppLink);
            
            // Create a hidden iframe to open the Eagle app link
            const eagleFrame = document.createElement('iframe');
            eagleFrame.style.display = 'none';
            eagleFrame.src = eagleAppLink;
            document.body.appendChild(eagleFrame);
            
            // Remove the iframe after a delay
            setTimeout(() => {
                if (document.body.contains(eagleFrame)) {
                    document.body.removeChild(eagleFrame);
                }
            }, 2000);
            
            // Remove the processing message after a delay and show success message
            setTimeout(() => {
                if (document.body.contains(processingMessage)) {
                    document.body.removeChild(processingMessage);
                }
                
                // Clean up blob URLs
                URL.revokeObjectURL(previewURL);
                URL.revokeObjectURL(psdBlobURL);
            }, 3000);
            
        } catch (error) {
            console.error('Error sending PSD to Eagle:', error);
            
            // Remove the processing message
            if (document.body.contains(processingMessage)) {
                document.body.removeChild(processingMessage);
            }
            
            // Clean up blob URLs
            URL.revokeObjectURL(previewURL);
            URL.revokeObjectURL(psdBlobURL);
        }
    }
    
    // Utility function to convert a data URL to a Blob object
    function dataURLtoBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    // Add this function to directly open the last created PSD in Eagle
    function openLastPsdInEagle() {
        if (!lastCreatedPsdData) {
            alert('No PSD has been created yet. Create a PSD first by clicking "Download PSD".');
            return;
        }
        
        // Create a blob from the PSD buffer
        const blob = new Blob([lastCreatedPsdData.buffer], { type: 'image/vnd.adobe.photoshop' });
        
        // First check if Eagle app is running
        isEagleAppRunning()
            .then(isRunning => {
                if (!isRunning) {
                    alert('Eagle app is not running. Please start Eagle and try again.');
                    return;
                }
                
                // Display a processing message
                const processingMessage = document.createElement('div');
                processingMessage.className = 'processing-message';
                processingMessage.innerHTML = `
                    <div class="processing-content">
                        <div class="spinner"></div>
                        <div>Sending PSD to Eagle...</div>
                    </div>
                `;
                document.body.appendChild(processingMessage);
                
                // Upload to temporary hosting first
                uploadPsdToTempHost(blob, lastCreatedPsdData.fileName)
                    .then(uploadResult => {
                        // Log the URL for the manually opened PSD
                        console.log('Opening saved PSD in Eagle - URL:', uploadResult.url);
                        console.log('[MANUAL OPEN] PSD URL:', uploadResult.url);
                        
                        // Now import to Eagle using the URL
                        return tryDirectEagleAPI(uploadResult.url, lastCreatedPsdData.fileName, lastCreatedPsdData.tags, 'psd')
                            .then(() => {
                                // Delete the temp file after successful import
                                return deleteTempFile(uploadResult.key);
                            })
                            .then(deleteSuccess => {
                                // Remove processing message
                                if (document.body.contains(processingMessage)) {
                                    document.body.removeChild(processingMessage);
                                }
                                
                                // Show success message
                                alert('PSD file successfully imported to Eagle library!');
                            });
                    })
                    .catch(error => {
                        console.error('Error in PSD upload process:', error);
                        
                        // Remove processing message
                        if (document.body.contains(processingMessage)) {
                            document.body.removeChild(processingMessage);
                        }
                        
                        alert('Failed to send PSD to Eagle. Please ensure Eagle is running with API access enabled.');
                    });
            })
            .catch(error => {
                console.error('Error checking if Eagle is running:', error);
            });
    }

    // Temporary storage functionality has been removed

    // New function to handle PSD folder selection for Eagle
    function handlePsdFolderSelection(blob, fileName, psdBuffer, previewDataURL, metadata) {
        // Check if we already have a saved folder
        const savedFolderHandle = getSavedDirectoryHandle();
        
        if (savedFolderHandle) {
            // Use existing folder
            exportPsdToSelectedFolder(savedFolderHandle, blob, fileName);
        } else {
            // Check if we have saved data but no handle
            const savedData = localStorage.getItem('savedExportFolderData');
            
            if (savedData) {
                // Try to auto-select the folder
                selectExportFolderAuto().then(folderHandle => {
                    if (folderHandle) {
                        // Save the selected handle for future use
                        saveDirectoryHandle(folderHandle);
                        exportPsdToSelectedFolder(folderHandle, blob, fileName);
                    } else {
                        // If auto-selection fails, prompt the user
                        promptForFolderAndExportPsd(blob, fileName);
                    }
                }).catch(error => {
                    console.error('Error auto-selecting folder:', error);
                    promptForFolderAndExportPsd(blob, fileName);
                });
            } else {
                // No saved folder, prompt user
                promptForFolderAndExportPsd(blob, fileName);
            }
        }
    }

    // Function to export PSD to a selected folder
    async function exportPsdToSelectedFolder(folderHandle, blob, fileName) {
        if (!folderHandle) {
            console.error('No folder handle provided');
            alert('Error: No folder selected. Please try again and select a folder.');
            return;
        }
        
        // First check if we have write permission for the folder
        try {
            const hasPermission = await verifyPermission(folderHandle, true);
            if (!hasPermission) {
                console.error('Permission denied to write to folder');
                alert('Permission denied to write to the selected folder. Please select the folder again.');
                promptForFolderAndExportPsd(blob, fileName);
                return;
            }
        } catch (permError) {
            console.error('Error checking folder permissions:', permError);
            alert('Error checking folder permissions. Please try selecting the folder again.');
            promptForFolderAndExportPsd(blob, fileName);
            return;
        }
        
        // Now try to write the file to the selected folder
        try {
            // Create a file in the directory
            const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
            
            // Get a writable stream to the file
            const writable = await fileHandle.createWritable();
            
            // Write the blob to the file
            await writable.write(blob);
            
            // Close the file
            await writable.close();
            
            console.log(`PSD file '${fileName}' has been saved to both Downloads folder and Eagle library folder: ${folderHandle.name}`);
        } catch (fileError) {
            console.error('Error writing file to selected folder:', fileError);
            
            // Check for specific errors
            if (fileError.name === 'NotAllowedError') {
                console.error(`Permission error: Could not write to "${folderHandle.name}" folder. The folder selection will be reset.`);
                resetExportFolder();
                promptForFolderAndExportPsd(blob, fileName);
            } else if (fileError.name === 'NoModificationAllowedError') {
                console.error(`The folder "${folderHandle.name}" is read-only. Please select a different folder.`);
                promptForFolderAndExportPsd(blob, fileName);
            } else {
                // Generic error, already downloaded to Downloads folder
                console.error(`Could not save to "${folderHandle.name}" folder (${fileError.message}). The PSD file is still in Downloads folder.`);
            }
        }
    }

    // Function to prompt for folder and then export the PSD
    function promptForFolderAndExportPsd(blob, fileName) {
        selectExportFolder().then(folderHandle => {
            if (folderHandle) {
                // Save the selected handle for future use
                saveDirectoryHandle(folderHandle);
                // Update UI to reflect the selected folder
                updateFolderInfoUI(folderHandle.name);
                // Export PSD to the selected folder
                exportPsdToSelectedFolder(folderHandle, blob, fileName);
            } else {
                // User cancelled, but the file is already downloaded to Downloads folder
                console.log('Folder selection cancelled. The PSD file is still in Downloads folder.');
            }
        }).catch(error => {
            console.error('Error selecting folder:', error);
            console.error(`Failed to select folder: ${error.message}. The PSD file is still in Downloads folder.`);
        });
    }

    // Handle clipboard paste (Cmd+V / Ctrl+V)
    function handleClipboardPaste(e) {
        // Prevent the default paste behavior
        e.preventDefault();
    
        // Get the clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData?.items;
    
        if (!items) return;
    
        // Check if any of the clipboard items is an image
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                
                // Handle the image as if it was uploaded
                if (blob) {
                    const file = new File([blob], "pasted-image.png", { type: blob.type });
                    handleImageFile(file);
                    

                }
                
                break;
            }
        }
    }
    

    


    // Function to display image dimensions in the top bar
    function displayImageDimensions() {
        const imageDimensionsEl = document.getElementById('image-dimensions');
        
        if (!originalImage || !imageDimensionsEl) {
            if (imageDimensionsEl) {
                imageDimensionsEl.style.display = 'none';
            }
            return;
        }
        
        const width = originalImage.width;
        const height = originalImage.height;
        const text = `${width} × ${height}px`;
        
        imageDimensionsEl.textContent = text;
        imageDimensionsEl.style.display = 'flex';
    }
    
    // Handle PSD drag start
    function handlePsdDragStart(e) {
        if (!currentPsdBlob || !currentPsdFileName) {
            console.error('No PSD data available for drag');
            e.preventDefault();
            return;
        }
        
        // Verify the blob has data
        if (currentPsdBlob.size === 0) {
            console.error('PSD blob is empty');
            e.preventDefault();
            return;
        }
        
        console.log('Starting drag with PSD:', currentPsdFileName, 'Size:', currentPsdBlob.size, 'bytes');
        
        // Add dragging class for visual feedback
        dragPsdBtn.classList.add('dragging');
        
        // Create a custom drag image
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-ghost';
        dragImage.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="currentColor" opacity="0.8"/>
                <path d="M14 2V8H20" fill="currentColor"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="8" font-weight="bold">PSD</text>
            </svg>
            ${currentPsdFileName}
        `;
        document.body.appendChild(dragImage);
        
        // Set the drag image
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // Remove the drag image after a short delay
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
        
        // Set the effect
        e.dataTransfer.effectAllowed = 'copy';
        
        // Use Firebase URL if available, otherwise fall back to blob URL
        if (currentPsdFirebaseUrl) {
            console.log('Using Firebase URL for drag:', currentPsdFirebaseUrl);
            e.dataTransfer.setData('text/uri-list', currentPsdFirebaseUrl);
            e.dataTransfer.setData('text/plain', currentPsdFirebaseUrl);
            e.dataTransfer.setData('DownloadURL', `image/vnd.adobe.photoshop:${currentPsdFileName}:${currentPsdFirebaseUrl}`);
        } else {
            console.log('Firebase URL not available, using blob URL fallback');
            // Fallback to blob URL if Firebase URL is not available
            try {
                const url = URL.createObjectURL(currentPsdBlob);
                e.dataTransfer.setData('text/uri-list', url);
                e.dataTransfer.setData('text/plain', url);
                e.dataTransfer.setData('DownloadURL', `image/vnd.adobe.photoshop:${currentPsdFileName}:${url}`);
                
                // Clean up the URL after a delay
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 5000);
            } catch (fallbackError) {
                console.error('Fallback URL creation failed:', fallbackError);
                e.dataTransfer.setData('text/plain', currentPsdFileName);
            }
        }
    }
    
    // Handle PSD drag end
    function handlePsdDragEnd(e) {
        // Remove dragging class
        dragPsdBtn.classList.remove('dragging');
    }
    
    // Function to upload PSD to Firebase Storage
    async function uploadPsdToFirebase(blob, fileName) {
        return new Promise((resolve, reject) => {
            // Check if Firebase is available
            if (!window.firebaseStorage || !window.firebaseRef || !window.firebaseUploadBytes || !window.firebaseGetDownloadURL) {
                const missingFunctions = [];
                if (!window.firebaseStorage) missingFunctions.push('firebaseStorage');
                if (!window.firebaseRef) missingFunctions.push('firebaseRef');
                if (!window.firebaseUploadBytes) missingFunctions.push('firebaseUploadBytes');
                if (!window.firebaseGetDownloadURL) missingFunctions.push('firebaseGetDownloadURL');
                
                console.error('Firebase Storage is not properly initialized. Missing:', missingFunctions.join(', '));
                console.log('This is common on GitHub Pages due to CORS restrictions.');
                console.log('To fix this, you need to:');
                console.log('1. Go to Firebase Console > Storage > Rules');
                console.log('2. Add CORS configuration to allow your GitHub Pages domain');
                console.log('3. Ensure Storage rules allow uploads without authentication');
                
                reject(new Error('Firebase Storage not available (CORS/initialization issue)'));
                return;
            }
            
            try {
                // Create a reference to the temp folder in Firebase Storage
                const timestamp = Date.now();
                const uniqueFileName = `${timestamp}_${fileName}`;
                const storageRef = window.firebaseRef(window.firebaseStorage, `temp/${uniqueFileName}`);
                
                console.log('Uploading PSD to Firebase:', uniqueFileName);
                
                // Clean up old files before uploading new one
                cleanupOldTempFiles().catch(error => {
                    console.warn('Cleanup failed, but continuing with upload:', error);
                });
                
                // Upload the blob
                window.firebaseUploadBytes(storageRef, blob)
                    .then((snapshot) => {
                        console.log('PSD uploaded successfully to Firebase');
                        
                        // Get the download URL
                        return window.firebaseGetDownloadURL(snapshot.ref);
                    })
                    .then((downloadURL) => {
                        console.log('Firebase download URL:', downloadURL);
                        resolve({
                            url: downloadURL,
                            fileName: uniqueFileName,
                            path: `temp/${uniqueFileName}`
                        });
                    })
                    .catch((error) => {
                        console.error('Error uploading to Firebase:', error);
                        console.error('Error code:', error.code);
                        console.error('Error message:', error.message);
                        
                        // Provide specific guidance based on error type
                        if (error.code === 'storage/unauthorized') {
                            console.log('Firebase Storage rules are blocking the upload.');
                            console.log('Update your Firebase Storage rules to allow uploads:');
                            console.log('rules_version = "2";');
                            console.log('service firebase.storage {');
                            console.log('  match /b/{bucket}/o {');
                            console.log('    match /temp/{allPaths=**} {');
                            console.log('      allow read, write: if true;');
                            console.log('    }');
                            console.log('  }');
                            console.log('}');
                        } else if (error.code === 'storage/unauthenticated') {
                            console.log('Authentication is required but not configured.');
                            console.log('Enable anonymous uploads in Firebase Storage rules.');
                        } else if (error.message && error.message.includes('CORS')) {
                            console.log('CORS error detected. See instructions below.');
                        }
                        
                        reject(error);
                    });
            } catch (error) {
                console.error('Error setting up Firebase upload:', error);
                reject(error);
            }
        });
    }
    
    // Function to delete PSD from Firebase Storage (cleanup)
    async function deletePsdFromFirebase(path) {
        if (!window.firebaseStorage || !window.firebaseRef || !window.firebaseDeleteObject) {
            console.warn('Firebase Storage is not initialized, cannot delete file');
            return;
        }
        
        try {
            const storageRef = window.firebaseRef(window.firebaseStorage, path);
            await window.firebaseDeleteObject(storageRef);
            console.log('Temporary PSD file deleted from Firebase:', path);
        } catch (error) {
            console.error('Error deleting PSD from Firebase:', error);
        }
    }
    
    // Function to clean up old files from Firebase Storage temp folder
    async function cleanupOldTempFiles() {
        if (!window.firebaseStorage || !window.firebaseRef || !window.firebaseListAll || !window.firebaseGetMetadata || !window.firebaseDeleteObject) {
            console.warn('Firebase Storage functions not available for cleanup');
            return;
        }
        
        try {
            const tempFolderRef = window.firebaseRef(window.firebaseStorage, 'temp');
            const listResult = await window.firebaseListAll(tempFolderRef);
            
            const now = Date.now();
            const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            let deletedCount = 0;
            
            console.log(`Checking ${listResult.items.length} files in temp folder for cleanup...`);
            
            // Check each file in the temp folder
            for (const itemRef of listResult.items) {
                try {
                    const metadata = await window.firebaseGetMetadata(itemRef);
                    const uploadTime = new Date(metadata.timeCreated).getTime();
                    const age = now - uploadTime;
                    
                    // If file is older than 24 hours, delete it
                    if (age > twentyFourHours) {
                        await window.firebaseDeleteObject(itemRef);
                        console.log(`Deleted old temp file: ${itemRef.name} (${Math.round(age / (60 * 60 * 1000))} hours old)`);
                        deletedCount++;
                    }
                } catch (error) {
                    console.error(`Error processing file ${itemRef.name}:`, error);
                }
            }
            
            if (deletedCount > 0) {
                console.log(`Cleanup complete: deleted ${deletedCount} old temp files`);
            } else {
                console.log('No old temp files found to delete');
            }
            
        } catch (error) {
            console.error('Error during temp folder cleanup:', error);
        }
    }
    
    // Function to mark that we need to render
    function markNeedsRender() {
        if (!needsRender && originalImage) {
            needsRender = true;
            
            // Hide export buttons
            downloadBtn.style.display = 'none';
            exportPsdBtn.style.display = 'none';
            dragPsdBtn.style.display = 'none';
            
            // Show render button
            renderBtn.style.display = 'inline-flex';
        }
    }
    
    // Function to handle render button click
    async function handleRender() {
        if (isRendering || !needsRender) return;
        
        isRendering = true;
        needsRender = false;
        
        // Hide render button immediately
        renderBtn.style.display = 'none';
        
        try {
            // Generate the border
            generateBorder();
            
            // Generate the PSD in the background
            await generatePsdForRender();
            
            // Show export buttons
            downloadBtn.style.display = 'inline-flex';
            exportPsdBtn.style.display = 'inline-flex';
            // Drag button will be shown after Firebase upload completes
            
        } catch (error) {
            console.error('Error during render:', error);
            alert('Error during rendering. Please try again.');
            
            // Show render button again on error
            renderBtn.style.display = 'inline-flex';
            needsRender = true;
        } finally {
            isRendering = false;
        }
    }
    
    // Function to generate PSD during render (without downloading)
    async function generatePsdForRender() {
        if (!originalImage) return;
        
        // Determine which version of the library to use
        let psdLib;
        if (typeof window.agPsdLibrary !== 'undefined') {
            psdLib = window.agPsdLibrary;
        } else if (typeof agPsd !== 'undefined') {
            psdLib = agPsd;
        } else {
            throw new Error('PSD library not loaded');
        }
        
        // Create canvases for each layer
        const borderLayer = document.createElement('canvas');
        borderLayer.width = borderCanvas.width;
        borderLayer.height = borderCanvas.height;
        const borderLayerCtx = borderLayer.getContext('2d');
        
        // Create original image layer (without filters and effects)
        const originalImageLayer = document.createElement('canvas');
        originalImageLayer.width = imageCanvas.width;
        originalImageLayer.height = imageCanvas.height;
        const originalImageLayerCtx = originalImageLayer.getContext('2d');
        
        // Draw just the border on the border layer
        borderLayerCtx.drawImage(borderCanvas, 0, 0);
        
        // Draw the original image without any filters or effects on the original image layer
        const padding = originalImage.padding || 0;
        originalImageLayerCtx.drawImage(originalImage, padding, padding, originalImage.width, originalImage.height);
        
        // Create main composite canvas with border and original image
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = imageCanvas.width;
        compositeCanvas.height = imageCanvas.height;
        const compositeCtx = compositeCanvas.getContext('2d');
        compositeCtx.drawImage(borderCanvas, 0, 0);
        compositeCtx.drawImage(originalImageLayer, 0, 0);
        
        // Create PSD document with layers in proper order (original on top, visible)
        const psd = {
            width: imageCanvas.width,
            height: imageCanvas.height,
            children: [
                {
                    name: 'Border',
                    canvas: borderLayer
                },
                {
                    name: 'Original image',
                    canvas: originalImageLayer
                }
            ],
            // Add the composite image as the main canvas
            canvas: compositeCanvas
        };
        
        // Convert to PSD using ag-psd with thumbnail generation
        console.log('Converting to PSD format...');
        const psdBuffer = psdLib.writePsd(psd, { 
            generateThumbnail: true,
            psb: false,
            imageResources: {
                resolutionInfo: {
                    horizontalResolution: 72,
                    horizontalResolutionUnit: "PPI",
                    widthUnit: "Inches",
                    verticalResolution: 72,
                    verticalResolutionUnit: "PPI",
                    heightUnit: "Inches"
                }
            }
        });
        
        console.log('PSD created successfully, size:', psdBuffer.byteLength, 'bytes');
        
        // Generate a unique filename
        const timestamp = new Date().getTime();
        const fileName = `polygon-border-${timestamp}.psd`;
        
        // Create a blob from the PSD buffer
        const blob = new Blob([psdBuffer], { type: 'image/vnd.adobe.photoshop' });
        
        // Verify blob creation
        console.log('PSD blob created:', fileName, 'Size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
            throw new Error('Generated PSD file is empty');
        }
        
        // Store the last created PSD data for direct opening
        lastCreatedPsdData = {
            buffer: psdBuffer,
            fileName: fileName,
            previewDataURL: compositeCanvas.toDataURL('image/png'),
            tags: ['polygon-border', 'auto-border', 'generated', 'psd'],
            annotation: "Generated with Auto Borders Tool"
        };
        
        // Store the blob and filename for drag-and-drop
        currentPsdBlob = blob;
        currentPsdFileName = fileName;
        
        // Show the drag button in uploading state
        dragPsdBtn.style.display = 'inline-flex';
        dragPsdBtnText.textContent = 'Uploading...';
        dragPsdBtn.draggable = false;
        
        // Upload to Firebase and update button when ready
        try {
            const uploadResult = await uploadPsdToFirebase(blob, fileName);
            console.log('PSD uploaded to Firebase for drag-and-drop:', uploadResult.url);
            currentPsdFirebaseUrl = uploadResult.url;
            currentPsdFirebasePath = uploadResult.path;
            
            // Update button to ready state
            dragPsdBtnText.textContent = 'Drag URL';
            dragPsdBtn.draggable = true;
            dragPsdBtn.title = 'Drag this URL to another app';
            
            // Clean up after 1 hour (3600000 ms)
            setTimeout(() => {
                deletePsdFromFirebase(uploadResult.path);
                currentPsdFirebaseUrl = null;
                currentPsdFirebasePath = null;
                dragPsdBtnText.textContent = 'Drag PSD';
                dragPsdBtn.title = 'Drag this file to another app';
            }, 3600000);
        } catch (error) {
            console.error('Error uploading PSD to Firebase:', error);
            
            // Update button to fallback state
            dragPsdBtnText.textContent = 'Drag PSD';
            dragPsdBtn.draggable = true;
            dragPsdBtn.title = 'Drag this file to another app (using blob URL)';
            currentPsdFirebaseUrl = null;
            currentPsdFirebasePath = null;
        }
    }
}); 