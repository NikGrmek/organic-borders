# Polygon Border Generator

A sophisticated web application that processes PNG images and creates stylized polygon or low-poly borders around objects with configurable settings.

## Features

- Upload PNG images with transparency
- Automatically detect object edges in images
- Generate polygon borders with adjustable settings:
  - Simplification level (controls polygon complexity)
  - Border thickness
  - Corner style (sharp, rounded, or beveled)
  - Border color
- Option for low-poly style triangulation borders
- Real-time preview with automatic updates when settings change
- Download the final result as a PNG image

## How to Use

1. Open `index.html` in your web browser
2. Click the "Upload PNG Image" button and select a PNG image with transparency
3. Use the sliders to adjust:
   - Simplification level (lower values produce more detailed borders with more points)
   - Border thickness
4. Choose a corner style:
   - Sharp (miter): Creates pointy corners
   - Rounded: Creates smooth, rounded corners
   - Beveled: Creates flat, angled corners
5. Toggle "Low-poly style" checkbox to create a triangulated, geometric effect
6. Use the color picker to choose the border color
7. The border will automatically update as you change settings
8. Click "Download Result" to save your image with the polygon border

## Technical Details

The application uses advanced techniques for edge detection and polygon generation:

### Edge Detection
- Analyzes the alpha channel of PNG images to identify border pixels
- Uses 8-connectivity to detect edges with high accuracy

### Polygon Simplification
- Implements the Ramer-Douglas-Peucker (RDP) algorithm to simplify border contours
- The simplification slider controls the epsilon parameter, determining how closely the polygons follow the original contour

### Low-Poly Generation
- Creates a triangulation based on the simplified contour points and centroid
- Produces a modern, geometric aesthetic while preserving the overall shape

## Requirements

- A modern web browser that supports HTML5 Canvas
- PNG images with transparency (for best results)

## Tips

- For best results, use PNG images with transparent backgrounds and clear object edges
- Lower simplification values create more detailed borders but may appear noisy
- Higher simplification values create cleaner, more stylized borders
- The low-poly style works best with medium to high simplification values
- Try different corner styles for different aesthetic effects
- Black borders look classic, but colored borders can create interesting design effects 