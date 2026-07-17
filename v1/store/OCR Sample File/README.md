# OCR Sample Files

This directory contains sample identity documents for OCR (Optical Character Recognition) testing purposes.

## Directory Structure

```
OCR Sample File/
├── Aadhaar/        - Aadhaar card samples (10 files)
├── DL/             - Driving License samples (100+ files from different states)
├── PAN/            - PAN card samples (16 files)
├── Passport/       - Passport samples (30 files)
└── Voterid/        - Voter ID samples (20 files)
```

## File Types

- **Images**: JPG, JPEG, PNG, WEBP, AVIF
- **Documents**: PDF
- **Total Files**: 192 files automatically indexed

## Usage

All files in this directory are automatically:
1. ✅ Scanned and added to `files.json`
2. ✅ Displayed in the store with appropriate icons and badges
3. ✅ Searchable by filename
4. ✅ Available for download with a single click

## Adding New Files

To add new OCR sample files:

1. Place your files in the appropriate category folder (Aadhaar, DL, PAN, Passport, Voterid)
2. Run the generation script:
   ```bash
   cd store
   node generate-files-list.js
   ```
3. The files will be automatically added to the store

## File Naming Convention

Files are typically named:
- `CATEGORY_NUMBER.extension` (e.g., AADHAAR_1.png, PAN_5.pdf)
- `State/Location.extension` (for DL: Andhra.jpg, Delhi.pdf)
- Descriptive names (manipur dl.jpg, OWNER RC.jpg)

## Categories

### Aadhaar (आधार)
Sample Aadhaar cards in PNG format

### Driving License (DL)
State-wise driving license samples covering all Indian states and UTs

### PAN (Permanent Account Number)
PAN card samples in JPEG and PDF formats

### Passport
Indian passport samples in multiple formats

### Voter ID
Voter ID card samples from various states

---

**Note**: These are sample files for development and testing purposes only.

