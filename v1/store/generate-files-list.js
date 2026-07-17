const fs = require('fs');
const path = require('path');

// Base directory for OCR Sample Files
const baseDir = path.join(__dirname, 'OCR Sample File');
const outputFile = path.join(__dirname, 'files.json');

// Valid file extensions
const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.avif'];

// Categories
const categories = {
    'Aadhaar': 'Aadhaar Sample',
    'DL': 'Driving License Sample',
    'PAN': 'PAN Card Sample',
    'Passport': 'Passport Sample',
    'Voterid': 'Voter ID Sample'
};

// Function to get file type based on extension
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') return 'pdf';
    if (['.jpg', '.jpeg'].includes(ext)) return 'jpg';
    if (ext === '.png') return 'png';
    if (ext === '.webp') return 'webp';
    return 'jpeg';
}

// Function to recursively scan directory
function scanDirectory(dir, category, files = []) {
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip subdirectories like Rajasthan1_files
                if (!item.includes('_files')) {
                    scanDirectory(fullPath, category, files);
                }
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (validExtensions.includes(ext)) {
                    // Create relative path from store directory
                    const relativePath = path.relative(path.join(__dirname), fullPath).replace(/\\/g, '/');
                    
                    files.push({
                        name: relativePath,
                        type: getFileType(item),
                        description: `${categories[category]} - ${item}`
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning ${dir}:`, error.message);
    }
    
    return files;
}

// Main function
function generateFilesList() {
    let allFiles = [];
    
    // Add existing files (videos and PDFs from root)
    const existingFiles = [
        {
            "name": "xyz.mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "PanavResume.pdf",
            "type": "pdf",
            "description": "PDF content"
        },
        {
            "name": "sample1.mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "sample2(flag).mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "sample3.mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "sample4.mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "sample5.mp4",
            "type": "mp4",
            "description": "Video content"
        },
        {
            "name": "sample3.webm",
            "type": "webm",
            "description": "Video content"
        },
        {
            "name": "sample4.webm",
            "type": "webm",
            "description": "Video content"
        }
    ];
    
    allFiles = [...existingFiles];
    
    // Scan each category
    for (const category in categories) {
        const categoryPath = path.join(baseDir, category);
        if (fs.existsSync(categoryPath)) {
            console.log(`Scanning ${category}...`);
            const categoryFiles = scanDirectory(categoryPath, category);
            allFiles = allFiles.concat(categoryFiles);
        }
    }
    
    // Write to files.json
    fs.writeFileSync(outputFile, JSON.stringify(allFiles, null, 4));
    console.log(`\n✅ Generated ${allFiles.length} file entries!`);
    console.log(`📁 Saved to: ${outputFile}`);
}

// Run the script
generateFilesList();

