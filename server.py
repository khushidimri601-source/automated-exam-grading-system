import http.server
import socketserver
import os
import argparse
import sys
import json
import tempfile
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from converter import convert_file
from answer_key_parser import parse_answer_key_file
from nlp_grader import (
    grade_answer,
    detect_plagiarism,
    analyze_grammar_and_length,
    check_mandatory_terms,
    save_grading_example,
    get_training_data,
    analyze_grading_patterns,
    fix_word_spacing_nlp
)
try:
    from ocr_grading import grade_ocr_answer_sheet
    OCR_GRADING_AVAILABLE = True
except ImportError:
    OCR_GRADING_AVAILABLE = False
    grade_ocr_answer_sheet = None

PORT = 5000


def parse_port():
    # Priority: CLI arg -> env var PORT -> default 5000
    parser = argparse.ArgumentParser(description='Start a static file HTTP server for ExamGradeFlow')
    parser.add_argument('--port', '-p', type=int, help='Port to listen on')
    args, _ = parser.parse_known_args()

    port = None
    if args.port:
        port = args.port
    elif os.environ.get('PORT'):
        try:
            port = int(os.environ.get('PORT'))
        except ValueError:
            print('Invalid PORT environment variable, falling back to default 5000', file=sys.stderr)
            port = 5000
    else:
        port = 5000

    return port


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_POST(self):
        if self.path.startswith("/api/convert-questions"):
            self.handle_convert_questions()
        elif self.path.startswith("/api/parse-answer-key"):
            self.handle_parse_answer_key()
        elif self.path.startswith("/api/grade-essay"):
            self.handle_grade_essay()
        elif self.path.startswith("/api/check-plagiarism"):
            self.handle_check_plagiarism()
        elif self.path.startswith("/api/analyze-text"):
            self.handle_analyze_text()
        elif self.path.startswith("/api/save-grading-example"):
            self.handle_save_grading_example()
        elif self.path.startswith("/api/fix-spacing"):
            self.handle_fix_spacing()
        elif self.path.startswith("/api/grade-ocr"):
            self.handle_grade_ocr()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path.startswith("/api/training-data"):
            self.handle_get_training_data()
        elif self.path.startswith("/api/grading-patterns"):
            self.handle_get_grading_patterns()
        else:
            # Default: serve static files
            super().do_GET()

    def _read_json_body(self):
        """Helper to read and parse JSON request body."""
        try:
            content_length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            content_length = 0

        if content_length <= 0:
            return None, "Empty request body"

        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8")), None
        except json.JSONDecodeError:
            return None, "Invalid JSON"

    def _send_json(self, data: dict, status: int = 200):
        """Helper to send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def handle_convert_questions(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json({"success": False, "message": "Empty request body"}, 400)
            return

        raw_data = self.rfile.read(content_length)

        filename = self.headers.get("X-Filename") or "uploaded"
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if "filename" in query and query["filename"]:
            filename = query["filename"][0]

        filename = Path(filename).name

        suffix = Path(filename).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(raw_data)
            tmp_path = Path(tmp.name)

        try:
            ok, questions, message = convert_file(str(tmp_path))
            self._send_json({
                "success": ok,
                "message": message,
                "questions": questions if ok else [],
            }, 200 if ok else 400)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def handle_parse_answer_key(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json({"success": False, "message": "Empty request body"}, 400)
            return

        raw_data = self.rfile.read(content_length)

        filename = self.headers.get("X-Filename") or "uploaded"
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if "filename" in query and query["filename"]:
            filename = query["filename"][0]
        filename = Path(filename).name

        suffix = Path(filename).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(raw_data)
            tmp_path = Path(tmp.name)

        try:
            ok, payload, message = parse_answer_key_file(str(tmp_path))
            self._send_json(
                {"success": ok, "message": message, **payload},
                200 if ok else 400,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def handle_grade_essay(self):
        """
        Grade an essay answer using NLP + hybrid approach.
        
        Request body:
        {
            "studentAnswer": "...",
            "referenceAnswers": ["...", "..."],
            "maxPoints": 10,
            "mandatoryTerms": ["term1", "term2"],  // optional
            "otherAnswers": ["...", "..."],        // optional, for plagiarism check
            "minWords": 10,                        // optional
            "maxWords": 1000                       // optional
        }
        """
        payload, error = self._read_json_body()
        if error:
            self._send_json({"success": False, "message": error}, 400)
            return

        student_answer = payload.get("studentAnswer", "")
        reference_answers = payload.get("referenceAnswers") or []
        max_points = float(payload.get("maxPoints") or 0)
        mandatory_terms = payload.get("mandatoryTerms") or []
        other_answers = payload.get("otherAnswers") or []
        min_words = int(payload.get("minWords") or 10)
        max_words = int(payload.get("maxWords") or 1000)

        try:
            score, feedback, similarity = grade_answer(
                student_answer=student_answer,
                reference_answers=reference_answers,
                max_points=max_points,
                mandatory_terms=mandatory_terms if mandatory_terms else None,
                other_student_answers=other_answers if other_answers else None,
                min_words=min_words,
                max_words=max_words,
                enable_plagiarism_check=bool(other_answers),
                enable_grammar_check=True
            )
            self._send_json({
                "success": True,
                "score": score,
                "similarity": similarity,
                "feedback": feedback,
            })
        except RuntimeError as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_check_plagiarism(self):
        """
        Check a single answer against multiple other answers for plagiarism.
        
        Request body:
        {
            "studentAnswer": "...",
            "otherAnswers": ["...", "..."],
            "threshold": 0.92  // optional
        }
        """
        payload, error = self._read_json_body()
        if error:
            self._send_json({"success": False, "message": error}, 400)
            return

        student_answer = payload.get("studentAnswer", "")
        other_answers = payload.get("otherAnswers") or []
        threshold = float(payload.get("threshold") or 0.92)

        try:
            result = detect_plagiarism(student_answer, other_answers, threshold)
            self._send_json({"success": True, **result})
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_analyze_text(self):
        """
        Analyze text for grammar, length, and mandatory terms.
        
        Request body:
        {
            "text": "...",
            "mandatoryTerms": ["term1", "term2"],  // optional
            "minWords": 10,                        // optional
            "maxWords": 1000                       // optional
        }
        """
        payload, error = self._read_json_body()
        if error:
            self._send_json({"success": False, "message": error}, 400)
            return

        text = payload.get("text", "")
        mandatory_terms = payload.get("mandatoryTerms") or []
        min_words = int(payload.get("minWords") or 10)
        max_words = int(payload.get("maxWords") or 1000)

        try:
            grammar_result = analyze_grammar_and_length(text, min_words, max_words)
            terms_result = check_mandatory_terms(text, mandatory_terms) if mandatory_terms else None
            
            self._send_json({
                "success": True,
                "grammar": grammar_result,
                "terms": terms_result
            })
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_save_grading_example(self):
        """
        Save a grading example for future model fine-tuning.
        Called when teacher adjusts AI-suggested score.
        
        Request body:
        {
            "question": "...",
            "studentAnswer": "...",
            "referenceAnswers": ["..."],
            "aiScore": 7.5,
            "teacherScore": 8.0,
            "teacherFeedback": "..."
        }
        """
        payload, error = self._read_json_body()
        if error:
            self._send_json({"success": False, "message": error}, 400)
            return

        try:
            count = save_grading_example(
                question=payload.get("question", ""),
                student_answer=payload.get("studentAnswer", ""),
                reference_answers=payload.get("referenceAnswers") or [],
                ai_score=float(payload.get("aiScore") or 0),
                teacher_score=float(payload.get("teacherScore") or 0),
                teacher_feedback=payload.get("teacherFeedback", "")
            )
            self._send_json({
                "success": True,
                "message": f"Example saved. Total examples: {count}"
            })
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_get_training_data(self):
        """Get all collected training data."""
        try:
            data = get_training_data()
            self._send_json({"success": True, "data": data, "count": len(data)})
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_get_grading_patterns(self):
        """Analyze grading patterns from collected data."""
        try:
            analysis = analyze_grading_patterns()
            self._send_json({"success": True, **analysis})
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_fix_spacing(self):
        """
        Use NLP (BERT tokenizer) to intelligently fix word spacing.
        
        Request body:
        {
            "text": "Showthatthepowersetofaset..."
        }
        or
        {
            "texts": ["text1", "text2", ...]
        }
        """
        payload, error = self._read_json_body()
        if error:
            self._send_json({"success": False, "message": error}, 400)
            return

        try:
            # Handle single text
            if "text" in payload:
                fixed = fix_word_spacing_nlp(payload["text"])
                self._send_json({"success": True, "text": fixed})
            # Handle multiple texts
            elif "texts" in payload:
                texts = payload["texts"]
                if not isinstance(texts, list):
                    self._send_json({"success": False, "message": "texts must be an array"}, 400)
                    return
                fixed = [fix_word_spacing_nlp(t) if isinstance(t, str) else t for t in texts]
                self._send_json({"success": True, "texts": fixed})
            else:
                self._send_json({"success": False, "message": "Provide 'text' or 'texts'"}, 400)
        except Exception as e:
            self._send_json({"success": False, "message": str(e)}, 500)

    def handle_grade_ocr(self):
        """
        Grade a scanned answer sheet using OCR.
        
        Request:
        - Multipart form data with:
          - answerSheet: image/PDF file
          - questions: JSON array of questions
          - lang: (optional) OCR language code (default: 'eng')
          - minConfidence: (optional) minimum OCR confidence (default: 30.0)
        """
        if not OCR_GRADING_AVAILABLE:
            self._send_json({
                "success": False,
                "message": "OCR grading not available. Install dependencies: pip install pytesseract pillow pdf2image"
            }, 503)
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json({"success": False, "message": "Empty request body"}, 400)
            return

        # Read raw data
        raw_data = self.rfile.read(content_length)
        
        # Parse multipart form data
        # Simple multipart parser (for basic use cases)
        # In production, consider using a proper library like `python-multipart`
        
        try:
            # Extract filename from headers
            filename = self.headers.get("X-Filename") or "uploaded_answer_sheet"
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            
            # Get questions from query parameter or form data
            questions_json = query.get("questions", [None])[0]
            if not questions_json:
                # Try to parse from request body (if sent as JSON with file)
                # For simplicity, we'll use query parameter approach
                self._send_json({
                    "success": False,
                    "message": "Questions must be provided as 'questions' query parameter (JSON array)"
                }, 400)
                return
            
            questions = json.loads(questions_json)
            lang = query.get("lang", ["eng"])[0]
            min_confidence = float(query.get("minConfidence", ["30.0"])[0])
            
            # Save uploaded file
            suffix = Path(filename).suffix or ".bin"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(raw_data)
                tmp_path = Path(tmp.name)
            
            try:
                # Grade the answer sheet
                result = grade_ocr_answer_sheet(
                    answer_sheet_path=str(tmp_path),
                    questions=questions,
                    lang=lang,
                    min_confidence=min_confidence
                )
                
                self._send_json(result, 200 if result.get("success") else 400)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                    
        except json.JSONDecodeError:
            self._send_json({"success": False, "message": "Invalid JSON in questions parameter"}, 400)
        except Exception as e:
            self._send_json({"success": False, "message": f"OCR grading error: {str(e)}"}, 500)


script_dir = os.path.dirname(os.path.abspath(__file__))
def main():
    PORT = parse_port()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, 'public')
    os.chdir(public_dir)

    Handler = MyHTTPRequestHandler

    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Server running at http://0.0.0.0:{PORT}/")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down server')


if __name__ == '__main__':
    main()
os.chdir(public_dir)

Handler = MyHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Server running at http://0.0.0.0:{PORT}/")
    print("NLP Grading API endpoints:")
    print("  POST /api/grade-essay        - Grade essay with NLP + hybrid approach")
    print("  POST /api/check-plagiarism   - Check for plagiarism")
    if OCR_GRADING_AVAILABLE:
        print("  POST /api/grade-ocr          - Grade scanned answer sheet with OCR")
    print("  POST /api/analyze-text       - Analyze grammar/length/terms")
    print("  POST /api/save-grading-example - Save example for fine-tuning")
    print("  GET  /api/training-data      - Get collected training data")
    print("  GET  /api/grading-patterns   - Analyze grading patterns")
    print("Press Ctrl+C to stop the server")
    httpd.serve_forever()
