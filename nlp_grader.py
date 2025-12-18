import math
import re
import json
import os
from functools import lru_cache
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path


# ============================================================================
# 1. SENTENCE EMBEDDING MODEL (BERT-based)
# ============================================================================

@lru_cache(maxsize=1)
def _get_model():
    """
    Lazy-load a sentence embedding model.
    Uses all-MiniLM-L6-v2 (fast, good quality BERT-based encoder).
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "sentence-transformers is not installed. "
            "Install it with: pip install sentence-transformers"
        ) from exc

    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def _embed_texts(texts: List[str]):
    """Convert texts to normalized vector embeddings."""
    model = _get_model()
    return model.encode(texts, convert_to_tensor=False, normalize_embeddings=True)


def _cosine(a, b) -> float:
    """Compute cosine similarity between two vectors."""
    if not a.any() or not b.any():
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


# ============================================================================
# 2. TEXT PREPROCESSING & ANALYSIS
# ============================================================================

@lru_cache(maxsize=1)
def _get_tokenizer():
    """Get the BERT tokenizer for word segmentation."""
    try:
        from transformers import AutoTokenizer
        return AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    except Exception:
        return None


def fix_word_spacing_nlp(text: str) -> str:
    """
    Use NLP tokenizer to intelligently fix word spacing.
    The BERT tokenizer knows word boundaries and can segment glued text.
    """
    if not text or not text.strip():
        return text
    
    tokenizer = _get_tokenizer()
    if tokenizer is None:
        # Fallback to basic spacing if tokenizer not available
        return text

    # Protect mathematical / symbolic expressions from being spaced out.
    # Goal: keep expressions exactly as written (e.g., x^2-1, f(x)=..., (cid:0), 2.0×10-12, R→R).
    math_spans: List[str] = []

    def _store_math(m: re.Match) -> str:
        math_spans.append(m.group(0))
        # Use a placeholder unlikely to appear in normal text; avoid punctuation.
        return f" MATHPLACEHOLDER{len(math_spans) - 1} "

    # Heuristic patterns for "math-like" spans.
    # - Contains common operators/symbols
    # - Contains (cid:*) artifacts from PDF extraction
    # - Contains arrows / unicode multiplication
    math_pattern = re.compile(
        r"(\(cid:\d+\))"                       # PDF artifacts
        r"|([A-Za-z]\([^)]*\)\s*=\s*[^,\s]+)"   # f(x)=...
        r"|([0-9]+(?:\.[0-9]+)?\s*[×xX]\s*10\s*[-−]?\s*\d+)"  # 2.0×10-12
        r"|([A-Za-z0-9]+(?:\^|\*|/|=|\+|[-−])[A-Za-z0-9^*/=+−-]+)"  # x^2-1, a/b, etc.
        r"|([A-Za-z]\s*[→→\-]\s*[A-Za-z])",     # R→R or R-R (arrow-like)
        flags=re.UNICODE,
    )

    protected = math_pattern.sub(_store_math, text)
    
    try:
        # Tokenize the text - BERT tokenizer handles subword tokenization
        tokens = tokenizer.tokenize(protected)
        
        # Reconstruct with proper spacing
        # BERT uses ## prefix for continuation tokens
        result_parts = []
        for token in tokens:
            if token.startswith('##'):
                # This is a continuation of the previous word
                result_parts.append(token[2:])
            else:
                # New word - add space before (except for first)
                if result_parts:
                    result_parts.append(' ')
                result_parts.append(token)
        
        result = ''.join(result_parts)
        
        # Clean up: fix spacing around punctuation
        result = re.sub(r'\s+([.,;:!?)])', r'\1', result)  # no space before punctuation
        result = re.sub(r'([(])\s+', r'\1', result)        # no space after opening paren
        result = re.sub(r'\s+', ' ', result).strip()       # collapse spaces

        # Restore protected math spans exactly as they were.
        for i, span in enumerate(math_spans):
            result = result.replace(f"MATHPLACEHOLDER{i}", span)
        
        return result
    except Exception:
        return text


def preprocess_text(text: str) -> str:
    """
    Basic text preprocessing:
    - Lowercase
    - Remove extra whitespace
    - Basic punctuation normalization
    """
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r'\s+', ' ', text)  # collapse whitespace
    return text


def analyze_grammar_and_length(text: str, min_words: int = 10, max_words: int = 1000) -> Dict[str, Any]:
    """
    Analyze text for grammar issues and length constraints.
    Returns analysis dict with issues found.
    """
    issues = []
    warnings = []
    
    words = text.split()
    word_count = len(words)
    sentence_count = len(re.findall(r'[.!?]+', text)) or 1
    avg_sentence_length = word_count / sentence_count
    
    # Length checks
    if word_count < min_words:
        issues.append(f"Answer too short ({word_count} words, minimum {min_words} expected)")
    elif word_count > max_words:
        warnings.append(f"Answer quite long ({word_count} words)")
    
    # Basic grammar checks
    sentences = re.split(r'[.!?]+', text)
    for sent in sentences:
        sent = sent.strip()
        if sent and sent[0].islower():
            warnings.append("Some sentences don't start with capital letters")
            break
    
    # Check for repeated words (potential copy-paste or filler)
    word_freq = {}
    for w in words:
        w_clean = re.sub(r'[^\w]', '', w.lower())
        if len(w_clean) > 3:  # ignore short words
            word_freq[w_clean] = word_freq.get(w_clean, 0) + 1
    
    for word, count in word_freq.items():
        if count > 5 and count / word_count > 0.1:
            warnings.append(f"Word '{word}' repeated excessively ({count} times)")
    
    # Check for very short sentences
    short_sentences = sum(1 for s in sentences if len(s.split()) < 3 and s.strip())
    if short_sentences > 2:
        warnings.append("Multiple very short/incomplete sentences detected")
    
    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_length": round(avg_sentence_length, 1),
        "issues": issues,
        "warnings": warnings,
        "passed": len(issues) == 0
    }


def check_mandatory_terms(text: str, mandatory_terms: List[str]) -> Dict[str, Any]:
    """
    Check if mandatory terms/concepts are present in the answer.
    Returns dict with found/missing terms.
    """
    text_lower = preprocess_text(text)
    found = []
    missing = []
    
    for term in mandatory_terms:
        term_lower = term.lower().strip()
        # Check for term or close variations
        if term_lower in text_lower or re.search(rf'\b{re.escape(term_lower)}\b', text_lower):
            found.append(term)
        else:
            missing.append(term)
    
    return {
        "found_terms": found,
        "missing_terms": missing,
        "coverage": len(found) / len(mandatory_terms) if mandatory_terms else 1.0
    }


# ============================================================================
# 3. PLAGIARISM DETECTION
# ============================================================================

def detect_plagiarism(
    student_answer: str,
    other_answers: List[str],
    threshold: float = 0.92
) -> Dict[str, Any]:
    """
    Detect potential plagiarism by comparing student answer against other submissions.
    Uses semantic similarity - catches paraphrasing too.
    
    Args:
        student_answer: The answer to check
        other_answers: List of other student answers to compare against
        threshold: Similarity threshold above which plagiarism is flagged (0.92 = very similar)
    
    Returns:
        Dict with plagiarism detection results
    """
    if not student_answer or not other_answers:
        return {"is_plagiarized": False, "max_similarity": 0.0, "similar_indices": []}
    
    texts = [student_answer] + other_answers
    embeddings = _embed_texts(texts)
    student_vec = embeddings[0]
    other_vecs = embeddings[1:]
    
    similarities = []
    similar_indices = []
    
    for i, other_vec in enumerate(other_vecs):
        sim = _cosine(student_vec, other_vec)
        similarities.append(sim)
        if sim >= threshold:
            similar_indices.append({"index": i, "similarity": round(sim, 3)})
    
    max_sim = max(similarities) if similarities else 0.0
    
    return {
        "is_plagiarized": max_sim >= threshold,
        "max_similarity": round(max_sim, 3),
        "similar_indices": similar_indices,
        "threshold": threshold
    }


def detect_web_plagiarism_indicators(text: str) -> Dict[str, Any]:
    """
    Detect indicators that text might be copied from web sources.
    (Basic heuristic checks - not actual web search)
    """
    indicators = []
    
    # Check for URL remnants
    if re.search(r'https?://|www\.|\.com|\.org|\.edu', text, re.I):
        indicators.append("Contains URL fragments")
    
    # Check for citation markers without actual citations
    if re.search(r'\[\d+\]|\(\d{4}\)|\bet al\b', text, re.I):
        indicators.append("Contains citation-like markers")
    
    # Check for Wikipedia-style formatting
    if re.search(r'\[edit\]|\[citation needed\]', text, re.I):
        indicators.append("Contains Wikipedia-style markers")
    
    # Check for unusual formatting
    if re.search(r'^\s*[-•]\s', text, re.MULTILINE):
        indicators.append("Contains bullet points (possible copy-paste)")
    
    return {
        "has_indicators": len(indicators) > 0,
        "indicators": indicators
    }


# ============================================================================
# 4. SCORING ENGINE WITH HYBRID APPROACH
# ============================================================================

def calculate_hybrid_score(
    semantic_score: float,
    grammar_analysis: Dict[str, Any],
    term_coverage: float,
    plagiarism_result: Dict[str, Any],
    max_points: float,
    weights: Optional[Dict[str, float]] = None
) -> Tuple[float, List[str]]:
    """
    Calculate final score using hybrid approach combining:
    - Semantic similarity (NLP)
    - Grammar/length checks (rule-based)
    - Mandatory term coverage (rule-based)
    - Plagiarism penalty
    
    Returns (final_score, list of deductions/adjustments made)
    """
    if weights is None:
        weights = {
            "semantic": 0.7,      # 70% weight on meaning
            "terms": 0.2,         # 20% weight on key terms
            "grammar": 0.1        # 10% weight on grammar/length
        }
    
    adjustments = []
    
    # Base semantic score
    base_score = semantic_score * weights["semantic"]
    
    # Term coverage bonus/penalty
    term_score = term_coverage * weights["terms"] * max_points
    if term_coverage < 0.5:
        adjustments.append(f"Missing key concepts (-{round((1-term_coverage) * weights['terms'] * max_points, 2)} pts)")
    
    # Grammar score
    grammar_score = weights["grammar"] * max_points
    if not grammar_analysis["passed"]:
        grammar_score *= 0.5
        adjustments.append("Length requirements not met (-50% grammar score)")
    if grammar_analysis["warnings"]:
        grammar_score *= 0.8
        adjustments.append("Minor grammar/style issues detected")
    
    # Plagiarism penalty
    plagiarism_penalty = 0
    if plagiarism_result.get("is_plagiarized"):
        plagiarism_penalty = max_points * 0.5  # 50% penalty for plagiarism
        adjustments.append(f"⚠️ Potential plagiarism detected (-{plagiarism_penalty} pts)")
    
    # Calculate final score
    final_score = base_score + term_score + grammar_score - plagiarism_penalty
    final_score = max(0, min(max_points, round(final_score, 2)))
    
    return final_score, adjustments


# ============================================================================
# 5. FEEDBACK GENERATION
# ============================================================================

def generate_detailed_feedback(
    similarity: float,
    grammar_analysis: Dict[str, Any],
    term_check: Dict[str, Any],
    plagiarism_result: Dict[str, Any],
    adjustments: List[str]
) -> str:
    """
    Generate comprehensive feedback for the student.
    """
    feedback_parts = []
    
    # Overall assessment
    if similarity >= 0.85:
        feedback_parts.append("✅ **Excellent answer!** Your response demonstrates strong understanding of the concepts.")
    elif similarity >= 0.7:
        feedback_parts.append("👍 **Good answer.** You covered most key ideas well.")
    elif similarity >= 0.5:
        feedback_parts.append("📝 **Partial answer.** Some important concepts need more development.")
    else:
        feedback_parts.append("⚠️ **Needs improvement.** Please review the topic and expand your answer.")
    
    # Missing concepts
    if term_check.get("missing_terms"):
        missing = ", ".join(term_check["missing_terms"][:5])  # limit to 5
        feedback_parts.append(f"\n**Missing concepts:** {missing}")
    
    # Grammar/length feedback
    if grammar_analysis.get("issues"):
        for issue in grammar_analysis["issues"]:
            feedback_parts.append(f"\n⚠️ {issue}")
    
    if grammar_analysis.get("warnings"):
        feedback_parts.append("\n**Suggestions for improvement:**")
        for warning in grammar_analysis["warnings"][:3]:  # limit to 3
            feedback_parts.append(f"  • {warning}")
    
    # Plagiarism warning
    if plagiarism_result.get("is_plagiarized"):
        feedback_parts.append("\n🚨 **Warning:** Your answer shows high similarity to another submission. Please ensure your work is original.")
    
    # Score adjustments
    if adjustments:
        feedback_parts.append("\n**Score adjustments:**")
        for adj in adjustments:
            feedback_parts.append(f"  • {adj}")
    
    # Similarity score
    feedback_parts.append(f"\n(Semantic similarity: {similarity:.2f})")
    
    return "\n".join(feedback_parts)


# ============================================================================
# 6. MAIN GRADING FUNCTION (ENHANCED)
# ============================================================================

def grade_answer(
    student_answer: str,
    reference_answers: List[str],
    max_points: float,
    mandatory_terms: Optional[List[str]] = None,
    other_student_answers: Optional[List[str]] = None,
    min_words: int = 10,
    max_words: int = 1000,
    enable_plagiarism_check: bool = True,
    enable_grammar_check: bool = True
) -> Tuple[float, str, float]:
    """
    Grade a single descriptive/essay answer using hybrid NLP + rule-based approach.
    
    Args:
        student_answer: The student's answer text
        reference_answers: List of ideal/reference answers
        max_points: Maximum points for this question
        mandatory_terms: Optional list of key terms that should be present
        other_student_answers: Optional list of other submissions for plagiarism check
        min_words: Minimum word count expected
        max_words: Maximum word count expected
        enable_plagiarism_check: Whether to check for plagiarism
        enable_grammar_check: Whether to check grammar/length
    
    Returns:
        Tuple of (score, feedback, similarity)
    """
    student_answer = (student_answer or "").strip()
    if not student_answer:
        return 0.0, "No answer provided.", 0.0

    clean_refs = [r.strip() for r in reference_answers or [] if r and r.strip()]
    if not clean_refs:
        return 0.0, "No reference answer configured for this question.", 0.0

    # 1. Compute semantic similarity
    texts = [student_answer] + clean_refs
    embeddings = _embed_texts(texts)
    student_vec = embeddings[0]
    ref_vecs = embeddings[1:]

    sims = [_cosine(student_vec, rv) for rv in ref_vecs]
    best_sim = max(sims) if sims else 0.0

    # 2. Grammar and length analysis
    if enable_grammar_check:
        grammar_analysis = analyze_grammar_and_length(student_answer, min_words, max_words)
    else:
        grammar_analysis = {"passed": True, "issues": [], "warnings": [], "word_count": len(student_answer.split())}
    
    # 3. Mandatory terms check
    if mandatory_terms:
        term_check = check_mandatory_terms(student_answer, mandatory_terms)
    else:
        term_check = {"found_terms": [], "missing_terms": [], "coverage": 1.0}
    
    # 4. Plagiarism detection
    if enable_plagiarism_check and other_student_answers:
        plagiarism_result = detect_plagiarism(student_answer, other_student_answers)
    else:
        plagiarism_result = {"is_plagiarized": False, "max_similarity": 0.0}
    
    # Also check for web plagiarism indicators
    web_plag = detect_web_plagiarism_indicators(student_answer)
    if web_plag["has_indicators"]:
        plagiarism_result["web_indicators"] = web_plag["indicators"]
    
    # 5. Calculate semantic base score
    min_sim = 0.4
    max_sim = 0.9
    if best_sim <= min_sim:
        semantic_ratio = 0.0
    elif best_sim >= max_sim:
        semantic_ratio = 1.0
    else:
        semantic_ratio = (best_sim - min_sim) / (max_sim - min_sim)
    
    semantic_score = max_points * semantic_ratio
    
    # 6. Calculate hybrid score
    final_score, adjustments = calculate_hybrid_score(
        semantic_score=semantic_score,
        grammar_analysis=grammar_analysis,
        term_coverage=term_check["coverage"],
        plagiarism_result=plagiarism_result,
        max_points=max_points
    )
    
    # 7. Generate detailed feedback
    feedback = generate_detailed_feedback(
        similarity=best_sim,
        grammar_analysis=grammar_analysis,
        term_check=term_check,
        plagiarism_result=plagiarism_result,
        adjustments=adjustments
    )
    
    return final_score, feedback, best_sim


# ============================================================================
# 7. MODEL FINE-TUNING SUPPORT (DATA COLLECTION)
# ============================================================================

TRAINING_DATA_FILE = Path(__file__).parent / "grading_training_data.json"


def save_grading_example(
    question: str,
    student_answer: str,
    reference_answers: List[str],
    ai_score: float,
    teacher_score: float,
    teacher_feedback: str
):
    """
    Save a grading example for future model fine-tuning.
    Collects cases where teacher adjusted the AI score.
    """
    example = {
        "question": question,
        "student_answer": student_answer,
        "reference_answers": reference_answers,
        "ai_score": ai_score,
        "teacher_score": teacher_score,
        "teacher_feedback": teacher_feedback,
        "score_difference": teacher_score - ai_score
    }
    
    # Load existing data
    data = []
    if TRAINING_DATA_FILE.exists():
        try:
            with open(TRAINING_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            data = []
    
    data.append(example)
    
    # Save updated data
    with open(TRAINING_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return len(data)


def get_training_data() -> List[Dict[str, Any]]:
    """Load collected training data for analysis or fine-tuning."""
    if not TRAINING_DATA_FILE.exists():
        return []
    try:
        with open(TRAINING_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def analyze_grading_patterns() -> Dict[str, Any]:
    """
    Analyze collected grading data to understand teacher patterns.
    Useful for adjusting scoring thresholds.
    """
    data = get_training_data()
    if not data:
        return {"message": "No training data collected yet."}
    
    diffs = [d["score_difference"] for d in data]
    avg_diff = sum(diffs) / len(diffs)
    
    # Cases where teacher gave higher/lower scores
    teacher_higher = sum(1 for d in diffs if d > 0.1)
    teacher_lower = sum(1 for d in diffs if d < -0.1)
    similar = len(diffs) - teacher_higher - teacher_lower
    
    return {
        "total_examples": len(data),
        "average_score_difference": round(avg_diff, 2),
        "teacher_scored_higher": teacher_higher,
        "teacher_scored_lower": teacher_lower,
        "similar_scores": similar,
        "recommendation": "Consider adjusting thresholds" if abs(avg_diff) > 0.5 else "Current thresholds seem appropriate"
    }
