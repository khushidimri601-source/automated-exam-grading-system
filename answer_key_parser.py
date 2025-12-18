import re
from pathlib import Path
from typing import Dict, Any, Tuple, List


def _extract_text_from_pdf(path: Path) -> str:
    try:
        import pdfplumber  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Missing dependency 'pdfplumber'. Install it with: pip install pdfplumber") from exc

    chunks: List[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def _extract_text_from_docx(path: Path) -> str:
    try:
        import docx  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Missing dependency 'python-docx'. Install it with: pip install python-docx") from exc

    document = docx.Document(str(path))
    return "\n".join(p.text for p in document.paragraphs)


def parse_answer_key_text(text: str) -> Dict[str, Any]:
    """
    Parse an answer key into a mapping: questionNumber -> answer string.

    Supports common patterns like:
      1) A
      2. B
      Q3: C
      Question 4 - D
      5: True
      6: A,C
      7: Paris
    """
    answers: Dict[str, str] = {}
    if not text:
        return {"answers": answers, "unparsedLines": []}

    unparsed: List[str] = []
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Matches: [Q|Question] <num> [:.-)] <answer>
    pat = re.compile(
        r"^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[:.\-)\]]\s*(.+?)\s*$",
        flags=re.IGNORECASE,
    )

    for line in lines:
        m = pat.match(line)
        if not m:
            # also match "Question 3 Answer: B"
            m2 = re.search(r"(?:Q(?:uestion)?\s*)?(\d{1,3}).*?(?:Answer\s*[:\-]\s*)(.+)$", line, re.IGNORECASE)
            if not m2:
                unparsed.append(line)
                continue
            qn, ans = m2.group(1), m2.group(2)
        else:
            qn, ans = m.group(1), m.group(2)

        ans = ans.strip()
        # Normalize common MCQ formats like "Option A", "(A)", "A."
        ans = re.sub(r"^(?:option\s*)", "", ans, flags=re.IGNORECASE).strip()
        ans = re.sub(r"^[\(\[]?([A-D])[\)\].]?$", r"\1", ans, flags=re.IGNORECASE).strip()
        answers[str(int(qn))] = ans

    return {"answers": answers, "unparsedLines": unparsed}


def parse_answer_key_file(path_str: str) -> Tuple[bool, Dict[str, Any], str]:
    """
    Parse a PDF/DOCX/TXT answer key file.
    Returns (success, payload, message)
    """
    path = Path(path_str)
    if not path.exists():
        return False, {}, f"File not found: {path}"

    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            text = _extract_text_from_pdf(path)
        elif ext == ".docx":
            text = _extract_text_from_docx(path)
        elif ext in (".txt", ".text"):
            text = path.read_text(encoding="utf-8", errors="ignore")
        else:
            return False, {}, "Unsupported file type. Use PDF, DOCX, or TXT."
    except Exception as e:
        return False, {}, f"Error reading answer key: {e}"

    parsed = parse_answer_key_text(text)
    if not parsed["answers"]:
        return False, parsed, "No answers could be parsed. Ensure the file contains lines like '1) A' or 'Q2: B'."

    return True, parsed, f"Parsed {len(parsed['answers'])} answers."


