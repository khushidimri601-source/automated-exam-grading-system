# OCR-Based Exam Grading Setup Guide

This guide explains how to set up and use the OCR-based exam grading feature.

## Overview

The OCR grading system allows you to:
- Upload scanned images or PDFs of student answer sheets
- Automatically extract text using OCR (Optical Character Recognition)
- Grade answers using semantic similarity (NLP)
- Generate detailed feedback and marks

## Prerequisites

### 1. Install Tesseract OCR Binary

**Windows:**
1. Download Tesseract installer from: https://github.com/UB-Mannheim/tesseract/wiki
2. Install it (default location: `C:\Program Files\Tesseract-OCR`)
3. Add Tesseract to your system PATH, or set the path in your code:
   ```python
   import pytesseract
   pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
   ```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install tesseract-ocr
sudo apt-get install tesseract-ocr-eng  # For English language support
```

**macOS:**
```bash
brew install tesseract
```

### 2. Install Python Dependencies

The following packages are already installed in your virtual environment:
- `pytesseract` - Python wrapper for Tesseract OCR
- `pillow` (PIL) - Image processing
- `pdf2image` - PDF to image conversion

**Note:** `pdf2image` requires `poppler` to be installed separately:

**Windows:**
- Download poppler from: https://github.com/oschwartz10612/poppler-windows/releases
- Extract and add `bin` folder to PATH

**Linux:**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

## Usage

### Step 1: Access OCR Grading Page

1. Log in as a teacher
2. Navigate to **OCR Grading** from the teacher dashboard
3. Or go directly to: `http://localhost:8000/ocr-grading.html`

### Step 2: Select an Exam

1. Choose an exam from the dropdown
2. The system will display exam details (number of questions, total points)

### Step 3: Upload Answer Sheet

1. Click **"Choose File"** and select:
   - Scanned image (PNG, JPG, JPEG, TIFF, BMP, GIF)
   - PDF file containing scanned pages
2. Select OCR language (default: English)
3. Set minimum OCR confidence threshold (default: 30%)
   - Lower values allow grading even with unclear scans
   - Higher values require clearer scans for processing

### Step 4: Process & Grade

1. Click **"Process & Grade Answer Sheet"**
2. Wait for processing (this may take a few moments)
3. Review the results:
   - **Summary**: Total marks, percentage, OCR confidence
   - **Question-wise Results**: Extracted answers, marks, feedback
   - **Manual Review Flags**: Questions that need teacher review

### Step 5: Save or Export Results

- **Save Results**: Saves to the exam results database
- **Export Results**: Downloads results as JSON file

## How It Works

### 1. OCR Text Extraction
- Images/PDFs are processed using Tesseract OCR
- Text is extracted with confidence scores
- Low confidence (< threshold) triggers manual review flag

### 2. Text Cleaning & Normalization
- Removes OCR artifacts (e.g., `(cid:0)`)
- Fixes common OCR errors
- Normalizes spacing and punctuation

### 3. Question Segmentation
- Identifies question numbers (Q1, Question 1, 1), etc.
- Maps extracted answers to correct questions
- Handles various answer sheet formats

### 4. Semantic Grading
- Uses BERT-based sentence embeddings (all-MiniLM-L6-v2)
- Computes cosine similarity between student and reference answers
- Considers:
  - Semantic similarity (paraphrasing allowed)
  - Mandatory terms (if specified)
  - Grammar and length analysis
  - Plagiarism detection

### 5. Mark Assignment
- Maps similarity scores to marks based on rubric
- Provides constructive feedback
- Flags answers needing manual review

## Supported Answer Sheet Formats

The system can handle various formats:
- **Numbered questions**: Q1, Question 1, 1), 1., (1)
- **Mixed formats**: Combination of above
- **Multi-page PDFs**: Automatically processes all pages

## Best Practices

1. **Scan Quality**: Use high-resolution scans (300 DPI recommended)
2. **Clear Handwriting**: Ensure answers are legible
3. **Consistent Formatting**: Use consistent question numbering
4. **Review Flags**: Always review questions flagged for manual review
5. **Language Support**: Install appropriate Tesseract language packs

## Troubleshooting

### "OCR libraries not installed"
- Install pytesseract, pillow, and pdf2image: `pip install pytesseract pillow pdf2image`
- Ensure Tesseract binary is installed and accessible

### "Low OCR confidence"
- Improve scan quality
- Ensure good lighting and contrast
- Lower the minimum confidence threshold (with caution)

### "No answer found for question"
- Check if question numbering matches the answer sheet format
- Verify the answer sheet contains answers for all questions
- Review extracted text manually

### PDF Processing Errors
- Ensure poppler is installed (for pdf2image)
- Check PDF is not password-protected
- Verify PDF contains actual images (not just text)

## API Endpoint

**POST** `/api/grade-ocr`

**Query Parameters:**
- `questions`: JSON array of question objects
- `lang`: OCR language code (default: 'eng')
- `minConfidence`: Minimum OCR confidence (default: 30.0)

**Request Body:**
- Raw file data (image or PDF)

**Response:**
```json
{
  "success": true,
  "ocr_confidence": 85.5,
  "extracted_text": "...",
  "results": [...],
  "summary": {
    "total_marks": 45.5,
    "max_total_marks": 50.0,
    "percentage": 91.0,
    "questions_graded": 10,
    "needs_manual_review": 2
  }
}
```

## Limitations

1. **OCR Accuracy**: Depends on scan quality and handwriting clarity
2. **Mathematical Expressions**: Complex formulas may not be extracted correctly
3. **Handwriting**: Best results with printed text; handwritten text varies
4. **Language Support**: Requires appropriate Tesseract language packs
5. **Format Dependency**: Works best with structured answer sheets

## Future Enhancements

- Support for handwritten answer recognition
- Better mathematical expression handling
- Multi-language answer grading
- Batch processing of multiple answer sheets
- Integration with existing exam results system

