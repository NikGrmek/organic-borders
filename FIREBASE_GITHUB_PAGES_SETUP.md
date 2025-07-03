# Firebase Storage Setup for GitHub Pages

This guide explains how to configure Firebase Storage to work with your auto-borders app when hosted on GitHub Pages.

## The Problem

When hosting on GitHub Pages, Firebase Storage uploads may fail due to:
1. CORS (Cross-Origin Resource Sharing) restrictions
2. Firebase Storage security rules
3. Authentication requirements

## Solution

### 1. Update Firebase Storage Rules

Go to the [Firebase Console](https://console.firebase.google.com/) → Storage → Rules and update them to:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read/write access to the temp folder
    match /temp/{allPaths=**} {
      allow read, write: if true;
    }
    
    // Keep other folders restricted as needed
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Note:** This allows anyone to upload to the `temp/` folder. The app automatically cleans up files older than 24 hours.

### 2. Configure CORS for Firebase Storage

You need to configure CORS to allow requests from your GitHub Pages domain.

1. Install the Google Cloud SDK (gsutil):
   ```bash
   curl https://sdk.cloud.google.com | bash
   ```

2. Create a file named `cors.json`:
   ```json
   [
     {
       "origin": [
         "https://yourusername.github.io",
         "https://your-custom-domain.com",
         "http://localhost:*",
         "http://127.0.0.1:*"
       ],
       "method": ["GET", "POST", "PUT", "DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": [
         "Content-Type",
         "Access-Control-Allow-Origin",
         "x-goog-*"
       ]
     }
   ]
   ```
   
   Replace `yourusername.github.io` with your actual GitHub Pages URL.

3. Apply the CORS configuration:
   ```bash
   gsutil cors set cors.json gs://your-storage-bucket-name
   ```
   
   Replace `your-storage-bucket-name` with your Firebase Storage bucket name (found in Firebase Console → Storage).

### 3. Alternative: Use Firebase Hosting Instead

If CORS issues persist, consider using Firebase Hosting instead of GitHub Pages:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Initialize Firebase Hosting:
   ```bash
   firebase init hosting
   ```

3. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

Firebase Hosting automatically handles CORS for Firebase Storage in the same project.

## Fallback Behavior

If Firebase Storage is unavailable, the app will:
1. Still generate and download PSD files locally
2. Show drag-and-drop with blob URLs (limited functionality)
3. Display helpful error messages in the console

## Testing

To verify Firebase Storage is working:
1. Open your app on GitHub Pages
2. Open the browser console (F12)
3. Upload an image and click "Render"
4. Check for console messages about Firebase initialization and uploads
5. The "Drag URL" button should appear if successful

## Security Considerations

- The current setup allows public uploads to the `temp/` folder
- Files are automatically deleted after 24 hours
- For production use, consider implementing:
  - Rate limiting
  - File size restrictions
  - Authentication (anonymous or user-based)
  - More restrictive storage rules 