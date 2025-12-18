import json
import os
import re
from pathlib import Path
from typing import List, Tuple, Dict, Any


QUESTION_PATTERN = re.compile(r"^\s*(Q\d+\.?|Question\s*\d+\.?)\s*", re.IGNORECASE)
OPTION_PATTERN = re.compile(r"^\s*([A-D])[\).]\s+(.*)$")
ANSWER_PATTERN = re.compile(r"^\s*Answer\s*[:\-]\s*([A-D])\s*$", re.IGNORECASE)


def _extract_text_from_pdf(path: Path) -> str:
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        raise RuntimeError(
            "Missing dependency 'pdfplumber'. Install it with: pip install pdfplumber"
        )

    text_chunks = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            text_chunks.append(page.extract_text() or "")
    return "\n".join(text_chunks)


def _extract_text_from_docx(path: Path) -> str:
    try:
        import docx  # type: ignore
    except ImportError:
        raise RuntimeError(
            "Missing dependency 'python-docx'. Install it with: pip install python-docx"
        )

    document = docx.Document(str(path))
    return "\n".join(p.text for p in document.paragraphs)


def _parse_questions_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Heuristic parser for simple exam documents.

    Expected style (flexible, but best-effort):

        Q1. What is 2 + 2?
        A) 1
        B) 2
        C) 3
        D) 4
        Answer: D
    """
    lines = [l.rstrip() for l in text.splitlines()]
    questions: List[Dict[str, Any]] = []

    current_q: str | None = None
    options: List[str] = []
    correct_letter: str | None = None

    def flush_current():
        nonlocal current_q, options, correct_letter
        if not current_q:
            return

        if options:
            letters = ["A", "B", "C", "D"]
            idx = letters.index(correct_letter) if correct_letter in letters else 0
            q_obj: Dict[str, Any] = {
                "question": current_q.strip(),
                "type": "multiple_choice",
                "options": options[:],
                "correctAnswer": [idx],
                "category": "",
                "points": 1,
            }
        else:
            q_obj = {
                "question": current_q.strip(),
                "type": "short_answer",
                "correctAnswer": correct_letter or "",
                "category": "",
                "points": 1,
            }

        questions.append(q_obj)
        current_q = None
        options = []
        correct_letter = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # New question line
        if QUESTION_PATTERN.match(line):
            flush_current()
            line = QUESTION_PATTERN.sub("", line).strip()
            current_q = line
            continue

        # Option line
        m_opt = OPTION_PATTERN.match(line)
        if m_opt and current_q:
            _letter, text_opt = m_opt.groups()
            options.append(text_opt.strip())
            continue

        # Answer line
        m_ans = ANSWER_PATTERN.match(line)
        if m_ans and current_q:
            correct_letter = m_ans.group(1).upper()
            continue

        # Continuation of the question (before options)
        if current_q and not options:
            current_q += " " + line

    flush_current()
    return questions


def convert_file(path_str: str) -> Tuple[bool, List[Dict[str, Any]], str]:
    """
    Convert a PDF/DOCX/DOC file at the given path into a list of question objects.

    Returns (success, questions, message).
    """
    path = Path(path_str)
    if not path.exists():
        return False, [], f"File not found: {path}"

    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            text = _extract_text_from_pdf(path)
        elif ext in (".docx", ".doc"):
            if ext == ".doc":
                # python-docx does not support legacy .doc directly
                return (
                    False,
                    [],
                    ".doc files are not supported directly. Please convert to .docx first.",
                )
            text = _extract_text_from_docx(path)
        else:
            return False, [], "Unsupported file type. Only PDF and DOCX are supported."
    except RuntimeError as e:
        return False, [], str(e)
    except Exception as e:  # pragma: no cover - best-effort
        return False, [], f"Error reading document: {e}"

    questions = _parse_questions_from_text(text)
    if not questions:
        return False, [], "No questions could be detected. Please check the document format."

    return True, questions, f"Converted {len(questions)} questions successfully."


