# Auto Borders Tool

A web-based application for automatically generating polygon borders around images. This tool is perfect for creating clean borders around product images, portraits, or any other content that needs to stand out.

## Features

- Upload any PNG image
- Automatically detect edges
- Customize border thickness, color, and style
- Apply black & white filters and image adjustments
- Export as PNG or PSD with separate layers
- Integration with Eagle App for direct library imports
- Responsive design works on any device

## How to Use

1. Upload an image by clicking "Select Image" or dragging and dropping
2. Adjust border settings as desired
3. Export your image in PNG or PSD format
4. Optionally add directly to Eagle App library (if installed)

## Technical Details

Built with pure HTML, CSS, and JavaScript with no dependencies except for:
- FileSaver.js for downloading files
- AG-PSD for PSD file generation

## Eagle App Integration

The tool supports direct integration with Eagle App for quick saving of processed images to your library. To use this feature:
1. Make sure Eagle App is running
2. Toggle the "Use Eagle App API" switch
3. Click "Add to Library"

## License

MIT License

## Setup

### Eagle API Integration

This tool can integrate with Eagle App for directly adding images to your library. To set up the Eagle API integration:

1. Copy `config.sample.js` to `config.js`
2. Open `config.js` in a text editor
3. Replace `YOUR_EAGLE_API_TOKEN_HERE` with your actual Eagle API token
4. Save the file

### Getting Your Eagle API Token

To find your Eagle API token:

1. Open Eagle App
2. Go to Preferences / Settings
3. Navigate to the API tab
4. Enable the API service if it's not already enabled
5. Copy your API token

### Security Note

The `config.js` file is ignored by git (listed in `.gitignore`), so your API token won't be committed to version control. However, make sure not to share your `config.js` file with others. 