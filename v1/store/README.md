# Store Upload System - Setup Guide

## 📁 What This Is

An automated file upload system for your portfolio store that:
- Allows you to upload files through a web form
- Automatically updates the `files.json`
- Displays files instantly on your store page
- Includes download and copy link functionality

## 🚀 Quick Start

### 1. **Requirements**
- PHP enabled web server (Apache, Nginx, or PHP built-in server)
- Web hosting that supports PHP (most hosting providers do)

### 2. **Files Structure**
```
Portfolio/
├── store.html
└── store/
    ├── upload.html       (Upload form page)
    ├── upload.php        (Backend handler)
    ├── files.json        (Auto-updated file list)
    └── [your files]      (Uploaded files stored here)
```

## 📝 How to Use

### Method 1: Upload via Web Form (Recommended)

1. **Access the Upload Page:**
   - Go to: `https://yourdomain.com/store/upload.html`
   - Or click the floating "Upload File" button on your store page

2. **Fill the Form:**
   - **Select File:** Click or drag & drop your file
   - **File Type:** Auto-detected (options: JPEG, JPG, PNG, WEBP, PDF, MP4, WEBM)
   - **Description:** Add a brief description

3. **Upload:**
   - Click "Upload File" button
   - Wait for confirmation
   - You'll be redirected to the store page automatically

### Method 2: Manual Upload (Alternative)

1. **Upload your file** to the `store/` folder via FTP/File Manager

2. **Edit `files.json`** manually:
```json
[
    {
        "name": "video.mp4",
        "type": "mp4",
        "description": "My video file"
    },
    {
        "name": "image.png",
        "type": "png",
        "description": "My image file"
    },
    {
        "name": "document.pdf",
        "type": "pdf",
        "description": "My PDF document"
    }
]
```

3. **File types available:**
   - `jpeg` - for JPEG images
   - `jpg` - for JPG images
   - `png` - for PNG images
   - `webp` - for WEBP images
   - `pdf` - for PDF documents
   - `mp4` - for MP4 videos
   - `webm` - for WEBM videos

## 🔧 Local Testing

If you want to test locally:

### Option 1: PHP Built-in Server
```bash
cd "d:/Engineering Projects/Portfolio"
php -S localhost:8000
```
Then visit: `http://localhost:8000/store.html`

### Option 2: XAMPP/WAMP
1. Install XAMPP or WAMP
2. Copy your Portfolio folder to `htdocs/`
3. Visit: `http://localhost/Portfolio/store.html`

## 🌐 Deployment to Production

### For GitHub Pages:
❌ **Note:** GitHub Pages doesn't support PHP. For GitHub Pages, use Method 2 (Manual Upload).

### For PHP Hosting (Recommended):
1. Upload all files via FTP
2. Ensure `store/` folder has write permissions (755 or 775)
3. Access your upload page: `https://yourdomain.com/store/upload.html`

### For Other Static Hosts (Netlify, Vercel):
You'll need to add serverless functions to handle uploads, or use Method 2.

## 🔒 Security Tips

1. **Protect the upload page:**
   Add password protection to `upload.html`:
   ```apache
   # .htaccess in store/ folder
   <Files "upload.html">
       AuthType Basic
       AuthName "Admin Area"
       AuthUserFile /path/to/.htpasswd
       Require valid-user
   </Files>
   ```

2. **File size limits:**
   Current limit: 100MB (can be changed in `upload.php`)

3. **Allowed file types:**
   Consider adding file type restrictions in `upload.php` for security

## 📋 Supported File Types

The system supports the following file types:
- **Images:** JPEG, JPG, PNG, WEBP
- **PDFs:** PDF
- **Videos:** MP4, WEBM

Additional formats can be detected for display (but not in dropdown):
- **Other Videos:** .mov, .avi, .mkv, .flv
- **Other Images:** .gif, .svg
- **Archives:** .zip, .rar, .7z, .tar, .gz
- **Documents:** .doc, .docx, .txt, .rtf

## 🐛 Troubleshooting

### Upload fails with "Permission denied"
- Check folder permissions: `chmod 755 store/`
- Ensure PHP has write access

### Files don't show up after upload
- Check if `files.json` was updated
- Clear browser cache
- Check browser console for errors

### Large files fail to upload
- Check PHP settings: `upload_max_filesize` and `post_max_size` in `php.ini`
- Current limit in code: 100MB

## 💡 Tips

1. **File naming:** Use simple names without spaces (use hyphens or underscores)
2. **Descriptions:** Be descriptive to help users know what the file contains
3. **Organization:** Group similar files together with similar descriptions
4. **Backup:** Keep a backup of your `files.json` file

## 🎯 Features

✅ Drag & drop file upload
✅ Auto-detection of file types
✅ Real-time file preview
✅ Automatic JSON update
✅ Beautiful, responsive UI
✅ Loading indicators
✅ Success/error notifications
✅ Direct download functionality
✅ Copy link to clipboard
✅ Mobile-friendly design

---

**Need help?** Check the console for error messages or contact your hosting provider for PHP support.

