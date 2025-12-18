"""
OCR-Based Exam Grading System

This module handles:
1. OCR extraction from scanned images/PDFs
2. Text cleaning and normalization
3. Question-wise segmentation
4. Semantic comparison with reference answers
5. Mark assignment based on rubrics
6. Feedback generation
"""

import re
import json
import os
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
import tempfile

# OCR imports (with fallback handling)
try:
    import pytesseract
    from PIL import Image

    # Configure Tesseract OCR binary path for this Windows setup.
    # User-installed location:
    #   C:\Program Files\Tesseract-OCR\tesseract.exe
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    pytesseract = None
    Image = None

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    convert_from_path = None

# Import NLP grader for semantic comparison
from nlp_grader import (
    grade_answer,
    analyze_grammar_and_length,
    check_mandatory_terms,
    preprocess_text
)


# ============================================================================
# 1. OCR TEXT EXTRACTION
# ============================================================================

def extract_text_from_image(image_path: str, lang: str = 'eng') -> Tuple[str, float]:
    """
    Extract text from an image using Tesseract OCR.
    
    Returns:
        (extracted_text, confidence_score)
    """
    if not OCR_AVAILABLE:
        raise RuntimeError(
            "OCR libraries not installed. Install with: "
            "pip install pytesseract pillow"
        )
    
    try:
        img = Image.open(image_path)
        
        # Get OCR data with confidence scores
        try:
            ocr_data = pytesseract.image_to_data(img, lang=lang, output_type=pytesseract.Output.DICT)
        except pytesseract.TesseractNotFoundError:
            raise RuntimeError(
                "Tesseract OCR binary not found. Please install Tesseract OCR:\n"
                "Windows: https://github.com/UB-Mannheim/tesseract/wiki\n"
                "Linux: sudo apt-get install tesseract-ocr\n"
                "macOS: brew install tesseract"
            )
        
        # Extract text and calculate average confidence
        texts = []
        confidences = []
        
        for i, text in enumerate(ocr_data['text']):
            if text.strip():
                texts.append(text)
                conf = ocr_data['conf'][i]
                if conf != '-1':  # -1 means no confidence data
                    confidences.append(float(conf))
        
        extracted_text = ' '.join(texts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return extracted_text, avg_confidence
    
    except Exception as e:
        raise RuntimeError(f"OCR extraction failed: {str(e)}")


def extract_text_from_pdf(pdf_path: str, lang: str = 'eng') -> Tuple[str, float, List[str]]:
    """
    Extract text from PDF by converting pages to images and running OCR.
    
    Returns:
        (combined_text, average_confidence, list_of_page_texts)
    """
    if not PDF2IMAGE_AVAILABLE:
        raise RuntimeError(
            "PDF2Image not installed. Install with: "
            "pip install pdf2image"
        )
    
    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path, dpi=300)
        
        all_texts = []
        all_confidences = []
        page_texts = []
        
        for page_num, img in enumerate(images):
            # Save temporary image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp_path = tmp.name
                img.save(tmp_path, 'PNG')
            
            try:
                text, confidence = extract_text_from_image(tmp_path, lang)
                all_texts.append(text)
                all_confidences.append(confidence)
                page_texts.append(text)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        
        combined_text = '\n\n--- PAGE BREAK ---\n\n'.join(all_texts)
        avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        
        return combined_text, avg_confidence, page_texts
    
    except Exception as e:
        raise RuntimeError(f"PDF OCR extraction failed: {str(e)}")


def extract_text_from_file(file_path: str, lang: str = 'eng') -> Tuple[str, float, Optional[List[str]]]:
    """
    Extract text from image or PDF file.
    
    Returns:
        (extracted_text, confidence_score, page_texts_if_pdf)
    """
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == '.pdf':
        text, confidence, page_texts = extract_text_from_pdf(str(path), lang)
        return text, confidence, page_texts
    elif suffix in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif']:
        text, confidence = extract_text_from_image(str(path), lang)
        return text, confidence, None
    else:
        raise ValueError(f"Unsupported file format: {suffix}")


# ============================================================================
# 2. TEXT CLEANING AND NORMALIZATION
# ============================================================================

def clean_ocr_text(text: str) -> str:
    """
    Clean and normalize OCR-extracted text:
    - Fix common OCR errors
    - Remove noise and artifacts
    - Preserve original meaning
    """
    if not text:
        return ""
    
    # Remove common OCR artifacts
    text = re.sub(r'\(cid:\d+\)', '', text)  # PDF rendering artifacts
    text = re.sub(r'\x0c', '', text)  # Form feed characters
    
    # Fix common OCR character substitutions
    ocr_fixes = {
        r'\b0\b': 'O',  # Zero mistaken for O (context-dependent, be careful)
        r'rn': 'm',     # 'rn' mistaken for 'm'
        r'vv': 'w',     # 'vv' mistaken for 'w'
        r'ii': 'n',     # 'ii' mistaken for 'n'
    }
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)  # Collapse multiple spaces
    text = re.sub(r'\n\s*\n', '\n\n', text)  # Normalize line breaks
    
    # Fix spacing around punctuation
    text = re.sub(r'\s+([.,;:!?)])', r'\1', text)  # No space before punctuation
    text = re.sub(r'([(])\s+', r'\1', text)  # No space after opening paren
    
    # Remove excessive punctuation
    text = re.sub(r'[.]{3,}', '...', text)  # Limit ellipsis
    
    return text.strip()


def normalize_text(text: str) -> str:
    """
    Further normalization for comparison:
    - Lowercase
    - Remove extra punctuation variations
    - Standardize number formats
    """
    text = text.lower().strip()
    
    # Standardize common variations
    text = re.sub(r"won't", "will not", text)
    text = re.sub(r"can't", "cannot", text)
    text = re.sub(r"n't", " not", text)
    text = re.sub(r"'s", " is", text)
    text = re.sub(r"'re", " are", text)
    text = re.sub(r"'ll", " will", text)
    
    # Remove extra punctuation (keep basic sentence structure)
    text = re.sub(r'[^\w\s.,;:!?()\-]', '', text)
    
    # Normalize whitespace again
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()


# ============================================================================
# 3. QUESTION SEGMENTATION
# ============================================================================

def segment_answers_by_questions(text: str, question_count: int) -> Dict[int, str]:
    """
    Segment extracted text into question-wise answers.
    
    Looks for patterns like:
    - "Q1:", "Question 1:", "1)", "1.", etc.
    - Numbered lists
    - Section breaks
    
    Returns:
        Dictionary mapping question_number -> extracted_answer_text
    """
    segmented = {}
    
    # Pattern to find question markers
    question_patterns = [
        r'(?i)(?:Q|Question)\s*(\d+)[:.)\s]+(.*?)(?=(?:Q|Question)\s*\d+|$)',
        r'(?:^|\n)\s*(\d+)[:.)]\s+(.*?)(?=(?:^|\n)\s*\d+[:.)]|$)',
        r'(?:^|\n)\s*\((\d+)\)\s+(.*?)(?=(?:^|\n)\s*\(\d+\)|$)',
    ]
    
    # Try each pattern
    for pattern in question_patterns:
        matches = re.finditer(pattern, text, re.MULTILINE | re.DOTALL)
        for match in matches:
            q_num = int(match.group(1))
            answer_text = match.group(2).strip()
            
            if q_num <= question_count and answer_text:
                # If we already have an answer for this question, keep the longer one
                if q_num not in segmented or len(answer_text) > len(segmented[q_num]):
                    segmented[q_num] = answer_text
    
    # Fallback: If no patterns matched, try to split by numbered lines
    if not segmented:
        lines = text.split('\n')
        current_q = None
        current_answer = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line starts with a number (potential question number)
            num_match = re.match(r'^(\d+)[:.)]\s*', line)
            if num_match:
                # Save previous answer if exists
                if current_q and current_answer:
                    segmented[current_q] = ' '.join(current_answer)
                
                current_q = int(num_match.group(1))
                current_answer = [line[num_match.end():].strip()]
            else:
                if current_q:
                    current_answer.append(line)
        
        # Save last answer
        if current_q and current_answer:
            segmented[current_q] = ' '.join(current_answer)
    
    return segmented


# ============================================================================
# 4. OCR GRADING ENGINE
# ============================================================================

def grade_ocr_answer(
    student_answer: str,
    reference_answer: str,
    max_marks: float,
    question_type: str = 'short_answer',
    mandatory_terms: Optional[List[str]] = None,
    min_confidence: float = 30.0
) -> Dict[str, Any]:
    """
    Grade a single answer extracted via OCR.
    
    Args:
        student_answer: Extracted student answer text
        reference_answer: Reference/correct answer
        max_marks: Maximum marks for this question
        question_type: Type of question (short_answer, essay, etc.)
        mandatory_terms: List of terms that must appear
        min_confidence: Minimum OCR confidence threshold
    
    Returns:
        Dictionary with marks, feedback, and flags
    """
    # Clean the student answer
    cleaned_answer = clean_ocr_text(student_answer)
    
    # Check if answer is too short or empty (might be OCR failure)
    if len(cleaned_answer.strip()) < 3:
        return {
            "marks_awarded": 0.0,
            "max_marks": max_marks,
            "feedback": "Answer appears empty or unreadable. Please review manually.",
            "needs_manual_review": True,
            "confidence": 0.0,
            "extracted_text": cleaned_answer
        }
    
    # Use NLP grader for semantic comparison
    try:
        grading_result = grade_answer(
            student_answer=cleaned_answer,
            reference_answer=reference_answer,
            max_score=max_marks,
            question_type=question_type,
            mandatory_terms=mandatory_terms or []
        )
        
        marks = grading_result.get("score", 0.0)
        similarity = grading_result.get("similarity", 0.0)
        
        # Generate feedback
        feedback_parts = []
        
        if similarity < 0.3:
            feedback_parts.append("Answer shows low similarity to reference. Key concepts may be missing.")
        elif similarity < 0.6:
            feedback_parts.append("Partial understanding demonstrated. Some key points covered.")
        else:
            feedback_parts.append("Good understanding of the topic.")
        
        # Check mandatory terms
        if mandatory_terms:
            missing_terms = []
            answer_lower = cleaned_answer.lower()
            for term in mandatory_terms:
                if term.lower() not in answer_lower:
                    missing_terms.append(term)
            
            if missing_terms:
                feedback_parts.append(f"Missing key terms: {', '.join(missing_terms)}")
        
        # Grammar and length analysis
        grammar_analysis = analyze_grammar_and_length(cleaned_answer)
        if grammar_analysis.get("issues"):
            feedback_parts.append("Note: " + "; ".join(grammar_analysis["issues"]))
        
        feedback = " ".join(feedback_parts) if feedback_parts else "Answer reviewed."
        
        return {
            "marks_awarded": round(marks, 2),
            "max_marks": max_marks,
            "feedback": feedback,
            "needs_manual_review": False,
            "confidence": grading_result.get("confidence", 100.0),
            "similarity_score": round(similarity, 3),
            "extracted_text": cleaned_answer,
            "grammar_analysis": grammar_analysis
        }
    
    except Exception as e:
        return {
            "marks_awarded": 0.0,
            "max_marks": max_marks,
            "feedback": f"Grading error: {str(e)}. Please review manually.",
            "needs_manual_review": True,
            "confidence": 0.0,
            "extracted_text": cleaned_answer
        }


def grade_ocr_answer_sheet(
    answer_sheet_path: str,
    questions: List[Dict[str, Any]],
    lang: str = 'eng',
    min_confidence: float = 30.0
) -> Dict[str, Any]:
    """
    Main function to grade an entire answer sheet using OCR.
    
    Args:
        answer_sheet_path: Path to scanned image/PDF
        questions: List of question dictionaries with:
            - id: question ID
            - question: question text
            - correctAnswer: reference answer
            - points: max marks
            - type: question type
            - mandatoryTerms: (optional) list of required terms
        lang: OCR language code
        min_confidence: Minimum OCR confidence threshold
    
    Returns:
        Dictionary with grading results for all questions
    """
    if not OCR_AVAILABLE:
        raise RuntimeError(
            "OCR libraries not installed. Install with: "
            "pip install pytesseract pillow pdf2image"
        )
    
    # Extract text from answer sheet
    try:
        extracted_text, ocr_confidence, page_texts = extract_text_from_file(answer_sheet_path, lang)
    except Exception as e:
        return {
            "success": False,
            "message": f"OCR extraction failed: {str(e)}",
            "results": []
        }
    
    # Check OCR confidence
    if ocr_confidence < min_confidence:
        return {
            "success": False,
            "message": f"Low OCR confidence ({ocr_confidence:.1f}%). Answer sheet may be unclear. Please review manually.",
            "ocr_confidence": ocr_confidence,
            "extracted_text": extracted_text,
            "results": []
        }
    
    # Clean extracted text
    cleaned_text = clean_ocr_text(extracted_text)
    
    # Segment answers by question
    question_count = len(questions)
    segmented_answers = segment_answers_by_questions(cleaned_text, question_count)
    
    # Grade each question
    results = []
    total_marks = 0.0
    max_total_marks = 0.0
    needs_review_count = 0
    
    for i, question in enumerate(questions, start=1):
        question_num = i
        max_marks = float(question.get("points", 1.0))
        max_total_marks += max_marks
        
        # Get extracted answer for this question
        student_answer = segmented_answers.get(question_num, "")
        
        if not student_answer:
            # No answer found for this question
            result = {
                "question_number": question_num,
                "question_id": question.get("id", f"q{question_num}"),
                "question_text": question.get("question", ""),
                "extracted_answer": "",
                "marks_awarded": 0.0,
                "max_marks": max_marks,
                "feedback": "No answer found for this question in the scanned sheet.",
                "needs_manual_review": True,
                "confidence": 0.0
            }
        else:
            # Grade the answer
            reference_answer = question.get("correctAnswer", "")
            question_type = question.get("type", "short_answer")
            mandatory_terms = question.get("mandatoryTerms", [])
            
            grading_result = grade_ocr_answer(
                student_answer=student_answer,
                reference_answer=reference_answer,
                max_marks=max_marks,
                question_type=question_type,
                mandatory_terms=mandatory_terms,
                min_confidence=min_confidence
            )
            
            result = {
                "question_number": question_num,
                "question_id": question.get("id", f"q{question_num}"),
                "question_text": question.get("question", ""),
                "extracted_answer": grading_result["extracted_text"],
                "marks_awarded": grading_result["marks_awarded"],
                "max_marks": max_marks,
                "feedback": grading_result["feedback"],
                "needs_manual_review": grading_result["needs_manual_review"],
                "confidence": grading_result.get("confidence", ocr_confidence),
                "similarity_score": grading_result.get("similarity_score", 0.0),
                "grammar_analysis": grading_result.get("grammar_analysis")
            }
        
        if result["needs_manual_review"]:
            needs_review_count += 1
        
        total_marks += result["marks_awarded"]
        results.append(result)
    
    # Calculate percentage
    percentage = (total_marks / max_total_marks * 100) if max_total_marks > 0 else 0.0
    
    return {
        "success": True,
        "message": f"Grading completed. {needs_review_count} question(s) flagged for manual review.",
        "ocr_confidence": round(ocr_confidence, 2),
        "extracted_text": cleaned_text,
        "page_texts": page_texts,
        "results": results,
        "summary": {
            "total_marks": round(total_marks, 2),
            "max_total_marks": round(max_total_marks, 2),
            "percentage": round(percentage, 2),
            "questions_graded": len(results),
            "needs_manual_review": needs_review_count
        }
    }

