document.addEventListener('DOMContentLoaded', () => {
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
    const downloadBtn = document.getElementById('downloadBtn');
    const exportPsdBtn = document.getElementById('exportPsdBtn');
    const addToLibraryToggle = document.getElementById('addToLibraryToggle');
    const resetFolderBtn = document.getElementById('resetFolderBtn');
    const exportToggleContainer = document.querySelector('.export-toggle-container');
    const controls = document.getElementById('controls');
    const imageFilters = document.getElementById('image-filters');
    const shadowSettings = document.getElementById('shadow-settings');
    const edgeSelectionPanel = document.getElementById('edge-selection-panel');
    
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
    
    const borderColor = document.getElementById('borderColor');
    
    // Hidden but needed for compatibility
    let fillColor = { value: '#FFFFFF' };
    
    // Sliders
    const blackAndWhiteFilterCheckbox = document.getElementById('blackAndWhiteFilter');
    
    const blackPointRange = document.getElementById('blackPointRange');
    const blackPointValue = document.getElementById('blackPointValue');
    
    const whitePointRange = document.getElementById('whitePointRange');
    const whitePointValue = document.getElementById('whitePointValue');
    
    const bwFilterControls = document.getElementById('bwFilterControls');
    
    // Shadow size is now a slider
    const shadowSizeRange = document.getElementById('shadowSizeRange');
    const shadowSizeValue = document.getElementById('shadowSizeValue');
    
    const shadowOpacityRange = document.getElementById('shadowOpacityRange');
    const shadowOpacityValue = document.getElementById('shadowOpacityValue');
    
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
    
    // Hide panels initially
    controls.style.display = 'none';
    imageFilters.style.display = 'none';
    shadowSettings.style.display = 'none';
    edgeSelectionPanel.style.display = 'none';
    downloadBtn.style.display = 'none';
    exportPsdBtn.style.display = 'none';
    exportToggleContainer.style.display = 'none';
    resetFolderBtn.style.display = 'none';
    
    // Initialize sliders for custom input
    initSliders();
    
    // Event listeners
    fileUpload.addEventListener('change', handleImageUpload);
    selectImageBtn.addEventListener('click', () => fileUpload.click());
    downloadBtn.addEventListener('click', downloadResult);
    exportPsdBtn.addEventListener('click', exportAsPsd);
    resetFolderBtn.addEventListener('click', resetExportFolder);
    addToLibraryToggle.addEventListener('change', handleToggleChange);
    
    // Add to Library button
    const addToLibraryBtn = document.getElementById('addToLibraryBtn');
    if (addToLibraryBtn) {
        addToLibraryBtn.addEventListener('click', addToEagleLibrary);
    }
    
    // Set up drag and drop for the canvas area
    canvasArea.addEventListener('dragover', handleDragOver);
    canvasArea.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver); // Allow drag anywhere on the page
    document.addEventListener('drop', handleDrop);
    
    // Thickness slider with regular functionality
    thicknessRange.addEventListener('input', (e) => {
        currentThickness = parseInt(e.target.value);
        thicknessValue.textContent = currentThickness;
        generateBorder();
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
            
            // Check if file is an image
            if (file.type.match('image.*')) {
                // Process the file as if it was selected via the file input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileUpload.files = dataTransfer.files;
                
                // Trigger the change event
                const event = new Event('change', { bubbles: true });
                fileUpload.dispatchEvent(event);
            }
        }
    }
    
    // Slider event listeners
    simplificationRange.addEventListener('input', (e) => {
        simplificationValue.textContent = e.target.value;
        generateBorder();
    });
    
    borderColor.addEventListener('input', function() {
        // Set fill color to match border color
        fillColor.value = this.value;
        generateBorder();
    });
    
    // Black and white filter controls
    if (blackAndWhiteFilterCheckbox) {
        blackAndWhiteFilterCheckbox.addEventListener('change', () => {
            toggleBWFilterControls();
            applyImageFilters();
        });
    }
    
    // Black point slider control
    if (blackPointRange) {
        blackPointRange.addEventListener('input', (e) => {
            // Value display will be updated in the input event handler
            
            // Ensure white point is always greater than black point
            const blackPointVal = getSliderValue(blackPointRange);
            const whitePointVal = getSliderValue(whitePointRange);
            
            if (blackPointVal >= whitePointVal) {
                const newWhitePointValue = blackPointVal + 1;
                whitePointRange.value = Math.min(newWhitePointValue, parseInt(whitePointRange.getAttribute('max')));
                whitePointValue.textContent = newWhitePointValue;
                whitePointValue.setAttribute('data-actual-value', newWhitePointValue);
            }
            
            applyImageFilters();
        });
    }
    
    // White point slider control
    if (whitePointRange) {
        whitePointRange.addEventListener('input', (e) => {
            // Value display will be updated in the input event handler
            
            // Ensure black point is always less than white point
            const whitePointVal = getSliderValue(whitePointRange);
            const blackPointVal = getSliderValue(blackPointRange);
            
            if (whitePointVal <= blackPointVal) {
                const newBlackPointValue = whitePointVal - 1;
                blackPointRange.value = Math.max(newBlackPointValue, parseInt(blackPointRange.getAttribute('min')));
                blackPointValue.textContent = newBlackPointValue;
                blackPointValue.setAttribute('data-actual-value', newBlackPointValue);
            }
            
            applyImageFilters();
        });
    }
    
    // Shadow size control
    if (shadowSizeRange) {
        shadowSizeRange.addEventListener('input', (e) => {
            shadowSizeValue.textContent = e.target.value;
            applyImageFilters();
        });
    }
    
    // Shadow opacity control
    if (shadowOpacityRange) {
        shadowOpacityRange.addEventListener('input', (e) => {
            shadowOpacityValue.textContent = e.target.value;
            applyImageFilters();
        });
    }
    
    // Initialize B&W filter controls visibility
    toggleBWFilterControls();
    
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
    
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
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
                
                // Apply filters if enabled (including shadow after border detection)
                applyImageFilters();
                
                // Hide the placeholder
                if (uploadPlaceholder) {
                    uploadPlaceholder.style.display = 'none';
                }
                
                // Show all control panels
                controls.style.display = 'block';
                imageFilters.style.display = 'block';
                shadowSettings.style.display = 'block';
                edgeSelectionPanel.style.display = 'block';
                downloadBtn.style.display = 'block';
                exportPsdBtn.style.display = 'block';
                exportToggleContainer.style.display = 'flex';
                
                // Show the Add to Library button
                const addToLibraryBtn = document.getElementById('addToLibraryBtn');
                if (addToLibraryBtn) {
                    addToLibraryBtn.style.display = 'block';
                }
                
                // Update folder information in UI if available
                updateFolderInfo();
            };
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
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
    
    function detectEdges() {
        // Get image data
        const padding = originalImage.padding || 0;
        const imageData = imageCtx.getImageData(
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
        const selectedColor = borderColor.value;
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
        
        // Convert canvas to blob for downloading and saving to folder
        tempCanvas.toBlob(async (blob) => {
            // Always download to Downloads folder
            const link = document.createElement('a');
            link.download = fileName;
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            // Check if we should also save to library folder
            if (addToLibraryToggle && addToLibraryToggle.checked) {
                const savedFolderHandle = getSavedDirectoryHandle();
                
                if (savedFolderHandle) {
                    const success = await exportPngToFolder(savedFolderHandle, blob, fileName);
                    if (success) {
                        alert(`PNG file '${fileName}' has been saved to both your Downloads folder and your library folder: ${savedFolderHandle.name}`);
                    }
                } else {
                    // Try auto-selecting the folder
                    try {
                        const folderHandle = await selectExportFolderAuto();
                        if (folderHandle) {
                            saveDirectoryHandle(folderHandle);
                            const success = await exportPngToFolder(folderHandle, blob, fileName);
                            if (success) {
                                alert(`PNG file '${fileName}' has been saved to both your Downloads folder and your library folder: ${folderHandle.name}`);
                            }
                        }
                    } catch (error) {
                        console.error('Error saving to library folder:', error);
                        alert('PNG file has been downloaded, but could not be saved to library folder. Please check console for details.');
                    }
                }
            }
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
            
            // Check if we should save to library folder
            if (addToLibraryToggle && addToLibraryToggle.checked) {
                // First, check if we have a saved folder handle
                const savedFolderHandle = getSavedDirectoryHandle();
                
                if (savedFolderHandle) {
                    // We have a handle, verify it's still valid and use it
                    verifyPermission(savedFolderHandle, true).then(hasPermission => {
                        if (hasPermission) {
                            exportPsdToFolder(savedFolderHandle);
                        } else {
                            // Permission denied or handle invalid, prompt again
                            alert('Permission to folder was denied. Please select a folder again.');
                            localStorage.removeItem('savedExportFolderData');
                            promptForFolder().then(success => {
                                // If folder selection failed, still download
                                if (!success) {
                                    downloadAsPSD(blob, fileName);
                                }
                            });
                        }
                    }).catch(error => {
                        console.error('Error verifying folder permission:', error);
                        downloadAsPSD(blob, fileName);
                    });
                } else {
                    // Try to select a folder
                    selectExportFolderAuto().then(folderHandle => {
                        if (folderHandle) {
                            saveDirectoryHandle(folderHandle);
                            exportPsdToFolder(folderHandle);
                        } else {
                            promptForFolder().then(success => {
                                if (!success) {
                                    downloadAsPSD(blob, fileName);
                                }
                            });
                        }
                    }).catch(error => {
                        console.error('Error selecting folder:', error);
                        downloadAsPSD(blob, fileName);
                    });
                }
            } else {
                // Just download without saving to library folder
                downloadAsPSD(blob, fileName);
            }
        } catch (error) {
            console.error('Error creating PSD file:', error);
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
    
    // Function to toggle B&W filter controls visibility
    function toggleBWFilterControls() {
        if (bwFilterControls) {
            bwFilterControls.style.display = blackAndWhiteFilterCheckbox.checked ? 'block' : 'none';
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
                
                // Apply enhanced sensitivity to thickness and shadow size controls
                if (elementId === 'thicknessRange' || elementId === 'shadowSizeRange') {
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
    }

    // Function to add a file to Eagle library using the Eagle API
    function addFileToEagle(fileName) {
        console.warn('addFileToEagle is deprecated - using direct API');
        // Eagle API endpoint to add a file from path
        const eagleApiUrl = 'http://localhost:41595/api/item/addFromPath';
        
        // Get the Downloads folder path (this is a best-effort guess, it depends on user's system)
        const downloadsPath = getDownloadsFolder();
        
        if (!downloadsPath) {
            alert('Could not determine Downloads folder path. Please manually add the file to Eagle.');
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
                alert('File successfully added to Eagle library!');
            } else {
                console.error('Eagle API error:', data);
                alert('Failed to add file to Eagle. See console for details.');
            }
        })
        .catch(error => {
            console.error('Error adding file to Eagle:', error);
            alert('Failed to add file to Eagle. Is Eagle running? See console for details.');
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

    // Add the function to apply image filters
    function applyImageFilters() {
        if (!originalImage) return;
        
        const padding = originalImage.padding || 0;
        
        // Clear the canvas first
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        
        // First draw the original image without effects
        imageCtx.drawImage(originalImage, padding, padding, originalImage.width, originalImage.height);
        
        // Get shadow size and opacity values using getSliderValue to respect custom values
        const shadowSize = shadowSizeRange ? getSliderValue(shadowSizeRange) : 15;
        const shadowOpacity = (shadowOpacityRange ? getSliderValue(shadowOpacityRange) : 40) / 100;
        
        // Apply black and white filter if enabled
        if (blackAndWhiteFilterCheckbox && blackAndWhiteFilterCheckbox.checked) {
            // Get the image data
            const imageData = imageCtx.getImageData(
                padding, 
                padding, 
                originalImage.width, 
                originalImage.height
            );
            const data = imageData.data;
            
            // Get black point and white point values from sliders using getSliderValue
            const blackPoint = blackPointRange ? getSliderValue(blackPointRange) : 0;
            const whitePoint = whitePointRange ? getSliderValue(whitePointRange) : 255;
            
            // Calculate the scale factor for remapping
            const scale = 255 / (whitePoint - blackPoint);
            
            // Convert to black and white with levels adjustment
            for (let i = 0; i < data.length; i += 4) {
                // Skip fully transparent pixels
                if (data[i + 3] === 0) continue;
                
                // Calculate grayscale value using luminance formula
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                
                // Apply levels adjustment (remap from [blackPoint, whitePoint] to [0, 255])
                let adjustedGray = Math.max(0, Math.min(255, Math.round((gray - blackPoint) * scale)));
                
                // Set RGB values to the adjusted grayscale value
                data[i] = adjustedGray;     // R
                data[i + 1] = adjustedGray; // G
                data[i + 2] = adjustedGray; // B
                // Alpha channel (i + 3) remains unchanged
            }
            
            // Put the modified image data back on the canvas
            imageCtx.putImageData(imageData, padding, padding);
        }
        
        // At this point, we have the image with only the B&W filter applied (if enabled)
        // Use this for edge detection BEFORE adding shadow
        
        // Re-detect edges based on the current image without shadow
        detectEdges();
        
        // Regenerate border
        generateBorder();
        
        // Now apply shadow effect AFTER edge detection
        // Create a temporary canvas to apply the drop shadow
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCanvas.width;
        tempCanvas.height = imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Copy the current image (with B&W filter applied if enabled, but before shadow)
        tempCtx.drawImage(imageCanvas, 0, 0);
        
        // Clear the original canvas
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        
        // Apply drop shadow to the final result
        imageCtx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`; // Black shadow with user-defined opacity
        imageCtx.shadowBlur = shadowSize; // User-defined blur amount
        imageCtx.shadowOffsetX = 0; // 0 distance in X
        imageCtx.shadowOffsetY = 0; // 0 distance in Y
        
        // Draw the processed image with shadow
        imageCtx.drawImage(tempCanvas, 0, 0);
        
        // Reset shadow for other canvas operations
        imageCtx.shadowColor = 'transparent';
        imageCtx.shadowBlur = 0;
        imageCtx.shadowOffsetX = 0;
        imageCtx.shadowOffsetY = 0;
    }

    // Function to add the current PSD to Eagle library
    function addToEagleLibrary() {
        console.log('Add to Library function triggered');
        
        if (!originalImage) {
            console.error('No image loaded');
            alert('Please upload an image first');
            return;
        }
        
        // Check if Eagle App integration is enabled
        const addToLibraryToggle = document.getElementById('addToLibraryToggle');
        const useEagleAPI = addToLibraryToggle && addToLibraryToggle.checked;
        
        console.log('Using Eagle API:', useEagleAPI);
        
        if (useEagleAPI) {
            // Use Eagle API to add the image - skip folder selection completely
            addImageToEagleAPI();
            return; // Early return to prevent any folder selection code from running
        }
        
        // If not using Eagle API, proceed with folder selection
        console.log('Not using Eagle API, checking for saved folder handle');
        
        // First, check if we have a saved folder handle from this session
        const savedFolderHandle = getSavedDirectoryHandle();
        
        if (savedFolderHandle) {
            // We have a handle from this session, verify it's still valid and use it
            console.log('Found saved folder handle, verifying permissions');
            verifyPermission(savedFolderHandle, true).then(hasPermission => {
                if (hasPermission) {
                    console.log('Permission verified, exporting to folder');
                    exportPsdToFolder(savedFolderHandle);
                } else {
                    // Permission denied or handle invalid, prompt again
                    console.error('Permission to folder was denied');
                    alert('Permission to folder was denied. Please select a folder again.');
                    localStorage.removeItem('savedExportFolderData');
                    promptForFolder();
                }
            }).catch(error => {
                console.error('Error verifying folder permission:', error);
                // Something went wrong, prompt again
                localStorage.removeItem('savedExportFolderData');
                promptForFolder();
            });
        } else {
            // Check if we have saved data from a previous session
            const savedData = localStorage.getItem('savedExportFolderData');
            
            if (savedData) {
                console.log('Found saved folder data, attempting auto-selection');
                try {
                    // Parse the saved data to get folder name
                    const folderData = JSON.parse(savedData);
                    
                    // Don't ask the user, just try to select the folder directly
                    selectExportFolderAuto().then(folderHandle => {
                        if (folderHandle) {
                            console.log('Auto-selected folder, saving handle');
                            // Save the selected handle for future use
                            saveDirectoryHandle(folderHandle);
                            // Now export the PSD
                            exportPsdToFolder(folderHandle);
                        } else {
                            // If auto-selection fails, fall back to manual selection
                            console.log('Auto-selection failed, prompting for folder');
                            promptForFolder();
                        }
                    }).catch(error => {
                        console.error('Error auto-selecting folder:', error);
                        // Fall back to manual folder selection
                        promptForFolder();
                    });
                } catch (error) {
                    console.error('Error parsing saved folder data:', error);
                    localStorage.removeItem('savedExportFolderData');
                    promptForFolder();
                }
            } else {
                // No saved folder data, prompt for folder selection
                console.log('No saved folder data, prompting for folder selection');
                promptForFolder();
            }
        }
    }
    
    // Function to add the current image to Eagle using its API
    function addImageToEagleAPI() {
        if (!originalImage) {
            console.error('No image loaded for Eagle API');
            return;
        }
        
        // First, explicitly check if Eagle is running
        isEagleAppRunning().then(isRunning => {
            if (!isRunning) {
                console.error('Eagle App is not running or not responding to API requests');
                
                // Show a more detailed error message for macOS users
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                if (isMac) {
                    alert('Eagle App is not responding. This could be due to:\n\n' +
                          '1. Eagle App is not running\n' +
                          '2. CORS restrictions in your browser\n' +
                          '3. Eagle API access requires permissions\n\n' +
                          'Try using the direct Eagle Import feature instead:\n' +
                          '1. Save as PNG first\n' +
                          '2. Drag the PNG into Eagle');
                } else {
                    alert('Eagle App is not responding. Try saving as PNG and dragging into Eagle manually.');
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
            
            // Prepare tags for the image (testing tags as requested)
            const tags = ['polygon-border', 'auto-border', 'testing', 'generated'];
            
            // Eagle API endpoint for adding from URL (using 127.0.0.1 instead of localhost)
            const eagleAPIEndpoint = 'http://127.0.0.1:41595/api/item/addFromURL';
            
            // Eagle App API token
            const eagleApiToken = '4d1fb3b8-1313-412f-9d74-a86c8c8c5d1c';
            
            console.log('Sending request to Eagle API...');
            
            // Send request to Eagle API
            fetch(eagleAPIEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${eagleApiToken}`
                },
                body: JSON.stringify({
                    url: imageDataURL,
                    name: fileName,
                    tags: tags,
                    annotation: 'Generated with Auto Borders Tool',
                    website: window.location.href
                }),
                mode: 'cors',
                credentials: 'omit'
            })
            .then(response => {
                console.log('Eagle API response status:', response.status);
                if (!response.ok) {
                    throw new Error(`Eagle API responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Successfully added to Eagle:', data);
                alert('Image successfully added to Eagle library with tags: ' + tags.join(', '));
            })
            .catch(error => {
                console.error('Error adding to Eagle:', error);
                
                // Try using the iframe proxy if direct fetch fails
                if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch') || 
                    error.message.includes('CORS') || error.message.toLowerCase().includes('access') || error.message.includes('blocked')) {
                    console.log('Direct API call failed, trying via iframe proxy...');
                    
                    sendToEagleViaProxy(imageDataURL, fileName, tags)
                        .then(data => {
                            console.log('Successfully added to Eagle via proxy:', data);
                            alert('Image successfully added to Eagle library with tags: ' + tags.join(', '));
                        })
                        .catch(proxyError => {
                            console.error('Proxy API call also failed:', proxyError);
                            
                            // Final fallback - download for manual import
                            const downloadLink = document.createElement('a');
                            downloadLink.href = imageDataURL;
                            downloadLink.download = fileName;
                            
                            // Create a blob instead of using data URL directly
                            fetch(imageDataURL)
                                .then(res => res.blob())
                                .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    downloadLink.href = url;
                                    document.body.appendChild(downloadLink);
                                    downloadLink.click();
                                    document.body.removeChild(downloadLink);
                                    window.URL.revokeObjectURL(url);
                                    
                                    alert('Could not connect to Eagle App due to browser security restrictions.\n\n' +
                                        'The image has been downloaded - you can drag it into Eagle manually.');
                                });
                        });
                } else {
                    alert('Failed to add to Eagle: ' + error.message + '\nCheck the browser console for more details.');
                }
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
            
            // Eagle App API token
            const eagleApiToken = '4d1fb3b8-1313-412f-9d74-a86c8c8c5d1c';
            
            // Use the local app URL without localhost to avoid CORS
            // Eagle App runs on 41595 port, and we can use direct IP to avoid CORS
            const apiUrl = 'http://127.0.0.1:41595/api/application/info';
            
            fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${eagleApiToken}`
                },
                // Add cache control to prevent cached responses
                cache: 'no-cache',
                // Important for CORS when using credentials like auth headers
                mode: 'cors',
                credentials: 'omit'
            })
            .then(response => {
                clearTimeout(timeout);
                console.log('Eagle App API response status:', response.status);
                resolve(response.ok);
                // Return the response for additional debugging
                return response.json();
            })
            .then(data => {
                // Log Eagle App info if available
                if (data) {
                    console.log('Eagle App info:', data);
                }
            })
            .catch(error => {
                clearTimeout(timeout);
                console.error('Error checking Eagle App:', error.message);
                resolve(false);
            });
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
                    // Also display the reset folder button
                    resetFolderBtn.style.display = 'block';
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
        const addToLibraryToggle = document.getElementById('addToLibraryToggle');
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
        const addToLibraryBtn = document.getElementById('addToLibraryBtn');
        
        // Visual feedback by briefly changing the button appearance
        if (resetButton) {
            const originalColor = resetButton.style.backgroundColor || '#e2e2e2';
            resetButton.style.backgroundColor = '#4CAF50'; // Green to indicate success
            
            // Reset back after a short delay
            setTimeout(() => {
                resetButton.style.backgroundColor = originalColor;
            }, 500);
        }
        
        // Update the Add to Library button title
        if (addToLibraryBtn) {
            addToLibraryBtn.title = "Add to Library";
        }
        
        // Show a toast or alert to confirm reset
        alert(`Export folder "${folderName}" has been reset. You will be prompted to select a folder next time you export.`);
    }

    // Function to initialize folder persistence
    function initFolderPersistence() {
        // Check if we have saved folder data
        const savedData = localStorage.getItem('savedExportFolderData');
        const toggleLabel = document.querySelector('.export-toggle-container .toggle-label');
        const addToLibraryBtn = document.getElementById('addToLibraryBtn');
        const addToLibraryToggle = document.getElementById('addToLibraryToggle');
        const resetFolderBtn = document.getElementById('resetFolderBtn');
        
        console.log('Initializing folder persistence and Eagle integration');
        
        // Check if Eagle App is running on page load
        isEagleAppRunning().then(isRunning => {
            console.log(`Eagle App running status: ${isRunning}`);
            
            // If the toggle is checked but Eagle is not running, uncheck it
            if (addToLibraryToggle && addToLibraryToggle.checked && !isRunning) {
                console.log('Eagle toggle was checked but Eagle is not running - unchecking toggle');
                addToLibraryToggle.checked = false;
            }
            
            // Update toggle label based on Eagle availability
            if (isRunning) {
                if (toggleLabel) {
                    // Update the toggle label to indicate Eagle is available
                    toggleLabel.textContent = 'Use Eagle App API';
                    toggleLabel.title = 'Enable to directly add images to your Eagle library';
                }
                
                if (addToLibraryBtn) {
                    // Add info about Eagle to the button tooltip
                    const currentTitle = addToLibraryBtn.title || "Add to Library";
                    addToLibraryBtn.title = `${currentTitle} (Toggle to use Eagle App)`;
                }
                
                console.log('Eagle App is available for use');
            } else {
                console.log('Eagle App is not running - folder selection will be used');
                
                // Make sure reset folder button is visible if toggle is unchecked (using folder)
                if (resetFolderBtn && !addToLibraryToggle.checked) {
                    resetFolderBtn.style.display = 'inline-block';
                }
            }
        });
        
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
                
                // Make sure the export toggle container is visible if an image is loaded
                if (originalImage) {
                    exportToggleContainer.style.display = 'flex';
                    resetFolderBtn.style.display = 'block';
                }
                
                // If we're on Chrome, try to pre-obtain the directory handle in the background
                // This won't work on all browsers but can help reduce the number of prompts in Chrome
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
                alert('Permission denied to write to the selected folder.');
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
                        toggleLabel.textContent = 'Use Eagle App API ✓';
                    }
                    
                    // Update the Add to Library button title
                    const addToLibraryBtn = document.getElementById('addToLibraryBtn');
                    if (addToLibraryBtn) {
                        addToLibraryBtn.title = "Add to Eagle App Library";
                    }
                    
                    // Hide the reset folder button since we're using Eagle API
                    if (resetFolderBtn) {
                        resetFolderBtn.style.display = 'none';
                    }
                } else {
                    console.log('Eagle App is not running - disabling API integration');
                    addToLibraryToggle.checked = false;
                    
                    // Show more detailed error for Mac users
                    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                    if (isMac) {
                        alert('Could not connect to Eagle App. Please make sure:\n\n' +
                              '1. Eagle App is running on your Mac\n' +
                              '2. API access is enabled in Eagle App preferences\n' +
                              '3. No firewall is blocking localhost connections');
                    } else {
                        alert('Eagle App is not running. Please start Eagle App and try again.');
                    }
                    
                    if (toggleLabel) {
                        toggleLabel.textContent = 'Use Eagle App API';
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
                toggleLabel.textContent = 'Use Eagle App API';
            }
            
            // Update the Add to Library button title
            const addToLibraryBtn = document.getElementById('addToLibraryBtn');
            if (addToLibraryBtn) {
                addToLibraryBtn.title = "Add to Library (save to folder)";
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
    function sendToEagleViaProxy(imageDataURL, fileName, tags) {
        console.log('Attempting Eagle API via iframe proxy...');
        
        // Get the iframe
        const frame = document.getElementById('eagleProxyFrame');
        if (!frame) {
            console.error('Eagle proxy iframe not found');
            return false;
        }
        
        // Eagle App API token
        const eagleApiToken = '4d1fb3b8-1313-412f-9d74-a86c8c8c5d1c';
        
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
                        tags: ${JSON.stringify(tags)},
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
                        if (!response.ok) {
                            throw new Error("Eagle API responded with status: " + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        window.parent.postMessage({type: "eagle-success", data: data}, "*");
                    })
                    .catch(error => {
                        window.parent.postMessage({type: "eagle-error", error: error.message}, "*");
                    });
                }
                
                // Auto-submit when loaded
                window.onload = submitToEagle;
                </script>
            </head>
            <body>
                <div>Communicating with Eagle API...</div>
            </body>
            </html>
        `;
        
        // Set up message listener for response from iframe
        return new Promise((resolve, reject) => {
            const messageHandler = function(event) {
                if (event.data && event.data.type) {
                    if (event.data.type === 'eagle-success') {
                        window.removeEventListener('message', messageHandler);
                        resolve(event.data.data);
                    } else if (event.data.type === 'eagle-error') {
                        window.removeEventListener('message', messageHandler);
                        reject(new Error(event.data.error));
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Set timeout to prevent hanging
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('Eagle API proxy timed out'));
            }, 10000);
            
            // Set the HTML content of the iframe
            frame.srcdoc = formHtml;
        });
    }
}); 