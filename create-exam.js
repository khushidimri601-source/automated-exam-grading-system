checkAuth('teacher');

let questionCount = 0;

// Question types
const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    SHORT_ANSWER: 'short_answer',
    ESSAY: 'essay',
    MULTIPLE_SELECT: 'multiple_select',
    FILL_BLANK: 'fill_blank'
};

function allowMissingCorrectAnswersEnabled() {
    return document.getElementById('allowMissingCorrectAnswers')?.checked === true;
}

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'card mb-2';
    questionDiv.id = `question-${questionCount}`;
    questionDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color: var(--primary-color);">Question ${questionCount}</h4>
            <button type="button" class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="removeQuestion(${questionCount})">Remove</button>
        </div>
        
        <div class="form-group">
            <label>Question Type</label>
            <select class="form-control question-type" onchange="updateQuestionType(${questionCount})" required>
                <option value="${QUESTION_TYPES.MULTIPLE_CHOICE}">Multiple Choice</option>
                <option value="${QUESTION_TYPES.TRUE_FALSE}">True/False</option>
                <option value="${QUESTION_TYPES.SHORT_ANSWER}">Short Answer</option>
                <option value="${QUESTION_TYPES.ESSAY}">Essay</option>
                <option value="${QUESTION_TYPES.MULTIPLE_SELECT}">Multiple Select</option>
                <option value="${QUESTION_TYPES.FILL_BLANK}">Fill in the Blank</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Question Text</label>
            <input type="text" class="form-control question-text" placeholder="Enter your question" required>
        </div>
        
        <div class="question-options" id="options-${questionCount}">
            <div class="form-group">
                <label>Options (4 options required)</label>
                <input type="text" class="form-control option" placeholder="Option A" required>
                <input type="text" class="form-control option mt-1" placeholder="Option B" required>
                <input type="text" class="form-control option mt-1" placeholder="Option C" required>
                <input type="text" class="form-control option mt-1" placeholder="Option D" required>
            </div>
            <div class="form-group">
                <label>Correct Answer</label>
                <select class="form-control correct-answer" required>
                    <option value="">Select correct answer</option>
                    <option value="0">Option A</option>
                    <option value="1">Option B</option>
                    <option value="2">Option C</option>
                    <option value="3">Option D</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label>Points</label>
            <input type="number" class="form-control question-points" value="1" min="0" step="0.5" required>
        </div>
        
        <div class="form-group">
            <label>Category/Tag (optional)</label>
            <input type="text" class="form-control question-category" placeholder="e.g., Algebra, History">
        </div>
    `;
    
    container.appendChild(questionDiv);
}

// Add a question card pre-filled with data (used when importing from Question Bank)
function addQuestionWithData(questionData) {
    if (!questionData) return;

    addQuestion();

    const questionDiv = document.getElementById(`question-${questionCount}`);
    if (!questionDiv) return;

    const type = questionData.type || QUESTION_TYPES.MULTIPLE_CHOICE;
    const points = questionData.points ?? 1;
    const category = questionData.category ?? '';

    // Set question type first and render correct inputs
    const typeSelect = questionDiv.querySelector('.question-type');
    if (typeSelect) {
        typeSelect.value = type;
        updateQuestionType(questionCount);
    }

    // Question text
    const questionTextInput = questionDiv.querySelector('.question-text');
    if (questionTextInput) {
        questionTextInput.value = questionData.question || '';
    }

    // Points & category
    const pointsInput = questionDiv.querySelector('.question-points');
    if (pointsInput) {
        pointsInput.value = points;
    }
    const categoryInput = questionDiv.querySelector('.question-category');
    if (categoryInput) {
        categoryInput.value = category;
    }

    // Fill options + correct answer depending on type
    if (type === QUESTION_TYPES.MULTIPLE_CHOICE || type === QUESTION_TYPES.MULTIPLE_SELECT) {
        const options = Array.isArray(questionData.options) ? questionData.options : [];
        const optionInputs = Array.from(questionDiv.querySelectorAll('.option'));
        optionInputs.forEach((inp, idx) => {
            inp.value = options[idx] ?? '';
        });

        if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
            const correctSelect = questionDiv.querySelector('.correct-answer');
            if (correctSelect != null && questionData.correctAnswer != null) {
                correctSelect.value = String(questionData.correctAnswer);
            }
        } else {
            const correctSet = Array.isArray(questionData.correctAnswer)
                ? questionData.correctAnswer.map(String)
                : (questionData.correctAnswer != null ? [String(questionData.correctAnswer)] : []);
            const checkboxes = Array.from(questionDiv.querySelectorAll('.correct-answer-checkbox'));
            checkboxes.forEach(cb => {
                cb.checked = correctSet.includes(cb.value);
            });
        }
    } else if (type === QUESTION_TYPES.TRUE_FALSE) {
        const correctSelect = questionDiv.querySelector('.correct-answer');
        if (correctSelect != null && questionData.correctAnswer != null) {
            correctSelect.value = String(questionData.correctAnswer);
        }
    } else if (type === QUESTION_TYPES.SHORT_ANSWER || type === QUESTION_TYPES.FILL_BLANK || type === QUESTION_TYPES.ESSAY) {
        const correctInput = questionDiv.querySelector('.correct-answer-text');
        if (correctInput) {
            correctInput.value = questionData.correctAnswer || '';
        }
    }
}

function updateQuestionType(questionId) {
    const questionDiv = document.getElementById(`question-${questionId}`);
    const typeSelect = questionDiv.querySelector('.question-type');
    const type = typeSelect.value;
    const optionsDiv = questionDiv.querySelector('.question-options');
    
    let html = '';
    
    if (type === QUESTION_TYPES.MULTIPLE_CHOICE || type === QUESTION_TYPES.MULTIPLE_SELECT) {
        html = `
            <div class="form-group">
                <label>Options (4 options required)</label>
                <input type="text" class="form-control option" placeholder="Option A" required>
                <input type="text" class="form-control option mt-1" placeholder="Option B" required>
                <input type="text" class="form-control option mt-1" placeholder="Option C" required>
                <input type="text" class="form-control option mt-1" placeholder="Option D" required>
            </div>
            <div class="form-group">
                <label>${type === QUESTION_TYPES.MULTIPLE_SELECT ? 'Correct Answers (select all that apply)' : 'Correct Answer'}</label>
                ${type === QUESTION_TYPES.MULTIPLE_SELECT ? `
                    <div>
                        <label style="font-weight: normal;"><input type="checkbox" class="correct-answer-checkbox" value="0"> Option A</label><br>
                        <label style="font-weight: normal;"><input type="checkbox" class="correct-answer-checkbox" value="1"> Option B</label><br>
                        <label style="font-weight: normal;"><input type="checkbox" class="correct-answer-checkbox" value="2"> Option C</label><br>
                        <label style="font-weight: normal;"><input type="checkbox" class="correct-answer-checkbox" value="3"> Option D</label>
                    </div>
                ` : `
                    <select class="form-control correct-answer" ${allowMissingCorrectAnswersEnabled() ? '' : 'required'}>
                        <option value="">Select correct answer</option>
                        <option value="0">Option A</option>
                        <option value="1">Option B</option>
                        <option value="2">Option C</option>
                        <option value="3">Option D</option>
                    </select>
                `}
            </div>
        `;
    } else if (type === QUESTION_TYPES.TRUE_FALSE) {
        html = `
            <div class="form-group">
                <label>Correct Answer</label>
                <select class="form-control correct-answer" ${allowMissingCorrectAnswersEnabled() ? '' : 'required'}>
                    <option value="">Select correct answer</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                </select>
            </div>
        `;
    } else if (type === QUESTION_TYPES.SHORT_ANSWER || type === QUESTION_TYPES.FILL_BLANK) {
        html = `
            <div class="form-group">
                <label>Correct Answer(s) - Separate multiple acceptable answers with semicolons</label>
                <input type="text" class="form-control correct-answer-text" placeholder="e.g., Paris; paris; PARIS" ${allowMissingCorrectAnswersEnabled() ? '' : 'required'}>
            </div>
        `;
    } else if (type === QUESTION_TYPES.ESSAY) {
        html = `
            <div class="form-group">
                <label>Sample Answer / Rubric (for manual grading)</label>
                <textarea class="form-control correct-answer-text" rows="3" placeholder="Provide sample answer or grading rubric"></textarea>
            </div>
        `;
    }
    
    optionsDiv.innerHTML = html;
}

// When the "allow missing answers" toggle is changed, re-render answer inputs for all questions
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'allowMissingCorrectAnswers') {
        const questionDivs = document.querySelectorAll('#questionsContainer .card');
        questionDivs.forEach(div => {
            const idStr = div.id.replace('question-', '');
            const id = parseInt(idStr, 10);
            if (!Number.isNaN(id)) {
                updateQuestionType(id);
            }
        });
        showAlert(
            allowMissingCorrectAnswersEnabled()
                ? 'Missing correct answers are now allowed (remember to import/fill them later).'
                : 'Correct answers are now required again.',
            'info'
        );
    }
});

function removeQuestion(id) {
    const questionDiv = document.getElementById(`question-${id}`);
    if (questionDiv) {
        questionDiv.remove();
    }
}

// Load from question bank
function loadFromQuestionBank() {
    window.location.href = 'question-bank.html?mode=select';
}

// Import Answer Key (PDF/DOCX/TXT) and auto-fill correct answers for existing question cards.
function importAnswerKey() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        showAlert('Parsing answer key... please wait.', 'info');

        try {
            const resp = await fetch('/api/parse-answer-key?filename=' + encodeURIComponent(file.name), {
                method: 'POST',
                headers: { 'X-Filename': file.name },
                body: file
            });
            const data = await resp.json();
            if (!data.success) {
                showAlert(data.message || 'Could not parse answer key.', 'error');
                return;
            }

            applyAnswerKeyToForm(data.answers || {});

            const unparsed = Array.isArray(data.unparsedLines) ? data.unparsedLines.length : 0;
            showAlert(`Answer key imported. Filled ${Object.keys(data.answers || {}).length} answer(s).` + (unparsed ? ` (${unparsed} line(s) not recognized)` : ''), 'success');
        } catch (err) {
            showAlert('Error importing answer key: ' + err.message, 'error');
        }
    };
    input.click();
}

function applyAnswerKeyToForm(answerMap) {
    // answerMap keys are "1", "2", ... corresponding to question number order in the PDF.
    const questionDivs = Array.from(document.querySelectorAll('#questionsContainer .card'));
    if (questionDivs.length === 0) {
        showAlert('Add questions first, then import the answer key.', 'error');
        return;
    }

    function normalizeToken(raw) {
        if (raw == null) return '';
        const s = String(raw).trim();
        if (!s) return '';
        // If it contains a clear A-D, use first match
        const m = s.match(/[A-D]/i);
        if (m) return m[0].toUpperCase();
        // True/False
        if (/^\s*(true|t)\s*$/i.test(s)) return 'TRUE';
        if (/^\s*(false|f)\s*$/i.test(s)) return 'FALSE';
        // Numeric 1-4
        const n = s.match(/\b([1-4])\b/);
        if (n) return n[1];
        return s;
    }

    const missing = [];
    const filled = [];

    questionDivs.forEach((div, idx) => {
        const qNum = String(idx + 1);
        const ansRaw = (answerMap && answerMap[qNum] != null) ? String(answerMap[qNum]).trim() : '';
        if (!ansRaw) {
            missing.push(qNum);
            return;
        }

        const questionType = div.querySelector('.question-type')?.value;
        const norm = normalizeToken(ansRaw);

        if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
            const correctSelect = div.querySelector('.correct-answer');
            const idxMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
            if (correctSelect && idxMap[norm] != null) {
                correctSelect.value = String(idxMap[norm]);
                filled.push(qNum);
            } else {
                missing.push(qNum);
            }
        } else if (questionType === QUESTION_TYPES.MULTIPLE_SELECT) {
            // Accept formats like "A,C" or "A C" or "1/3"
            const parts = ansRaw
                .toUpperCase()
                .replace(/OPTION/g, '')
                .replace(/[()\.\]]/g, ' ')
                .split(/[\s,;/]+/)
                .filter(Boolean);
            const idxMap = { 'A': '0', 'B': '1', 'C': '2', 'D': '3', '1': '0', '2': '1', '3': '2', '4': '3' };
            const selected = new Set(parts.map(p => idxMap[p]).filter(v => v != null));
            const checkboxes = Array.from(div.querySelectorAll('.correct-answer-checkbox'));
            checkboxes.forEach(cb => {
                cb.checked = selected.has(cb.value);
            });
            if (selected.size > 0) filled.push(qNum); else missing.push(qNum);
        } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
            const correctSelect = div.querySelector('.correct-answer');
            if (correctSelect) {
                if (norm === 'TRUE' || norm === 'T') correctSelect.value = 'true';
                if (norm === 'FALSE' || norm === 'F') correctSelect.value = 'false';
                if (correctSelect.value) filled.push(qNum); else missing.push(qNum);
            }
        } else if (questionType === QUESTION_TYPES.SHORT_ANSWER || questionType === QUESTION_TYPES.FILL_BLANK || questionType === QUESTION_TYPES.ESSAY) {
            const correctText = div.querySelector('.correct-answer-text');
            if (correctText) {
                // Keep answer exactly as parsed (don’t uppercase)
                correctText.value = ansRaw;
                if (ansRaw) filled.push(qNum); else missing.push(qNum);
            }
        } else {
            // unknown type
            missing.push(qNum);
        }
    });

    if (missing.length > 0) {
        showAlert(
            `Answer key imported, but these question numbers still need correct answers: ${missing.join(', ')}`,
            'error'
        );
    }
}

document.getElementById('examForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const duration = parseInt(document.getElementById('duration').value);
    
    // Exam settings
    const startDate = document.getElementById('startDate')?.value || null;
    const endDate = document.getElementById('endDate')?.value || null;
    const startTime = document.getElementById('startTime')?.value || null;
    const endTime = document.getElementById('endTime')?.value || null;
    const shuffleQuestions = document.getElementById('shuffleQuestions')?.checked || false;
    const shuffleOptions = document.getElementById('shuffleOptions')?.checked || false;
    const allowRetakes = document.getElementById('allowRetakes')?.checked || false;
    const showResultsImmediately = document.getElementById('showResultsImmediately')?.checked || true;
    const passingScore = parseFloat(document.getElementById('passingScore')?.value || 0);
    const negativeMarking = document.getElementById('negativeMarking')?.checked || false;
    const negativeMarkValue = parseFloat(document.getElementById('negativeMarkValue')?.value || 0);
    
    const questionDivs = document.querySelectorAll('#questionsContainer .card');
    
    if (questionDivs.length === 0) {
        showAlert('Please add at least one question!', 'error');
        return;
    }
    
    const questions = [];
    let isValid = true;
    
    questionDivs.forEach((div, index) => {
        const questionType = div.querySelector('.question-type').value;
        const questionText = div.querySelector('.question-text').value;
        const points = parseFloat(div.querySelector('.question-points').value) || 1;
        const category = div.querySelector('.question-category').value || '';
        
        let correctAnswer = null;
        let options = [];
        
        if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
            options = Array.from(div.querySelectorAll('.option')).map(opt => opt.value);
            correctAnswer = parseInt(div.querySelector('.correct-answer').value);
            if (!questionText || options.some(opt => !opt) || (!allowMissingCorrectAnswersEnabled() && isNaN(correctAnswer))) {
                isValid = false;
                return;
            }
            if (allowMissingCorrectAnswersEnabled() && isNaN(correctAnswer)) {
                correctAnswer = null;
            }
        } else if (questionType === QUESTION_TYPES.MULTIPLE_SELECT) {
            options = Array.from(div.querySelectorAll('.option')).map(opt => opt.value);
            const checkedBoxes = Array.from(div.querySelectorAll('.correct-answer-checkbox:checked'));
            correctAnswer = checkedBoxes.map(cb => parseInt(cb.value));
            if (!questionText || options.some(opt => !opt) || (!allowMissingCorrectAnswersEnabled() && correctAnswer.length === 0)) {
                isValid = false;
                return;
            }
            if (allowMissingCorrectAnswersEnabled() && correctAnswer.length === 0) {
                correctAnswer = [];
            }
        } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
            options = ['True', 'False'];
            correctAnswer = div.querySelector('.correct-answer').value;
            if (!questionText || (!allowMissingCorrectAnswersEnabled() && !correctAnswer)) {
                isValid = false;
                return;
            }
            if (allowMissingCorrectAnswersEnabled() && !correctAnswer) {
                correctAnswer = null;
            }
        } else if (questionType === QUESTION_TYPES.SHORT_ANSWER || questionType === QUESTION_TYPES.FILL_BLANK) {
            correctAnswer = div.querySelector('.correct-answer-text').value;
            if (!questionText || (!allowMissingCorrectAnswersEnabled() && !correctAnswer)) {
                isValid = false;
                return;
            }
            if (allowMissingCorrectAnswersEnabled() && !correctAnswer) {
                correctAnswer = '';
            }
        } else if (questionType === QUESTION_TYPES.ESSAY) {
            correctAnswer = div.querySelector('.correct-answer-text').value || '';
            if (!questionText) {
                isValid = false;
                return;
            }
        }
        
        questions.push({
            id: (index + 1).toString(),
            type: questionType,
            question: questionText,
            options: options,
            correctAnswer: correctAnswer,
            points: points,
            category: category
        });
    });
    
    if (!isValid) {
        showAlert('Please fill in all question fields!', 'error');
        return;
    }
    
    const user = getCurrentUser();
    const exam = {
        id: Date.now().toString(),
        teacherId: user.id,
        teacherName: user.name,
        title,
        description,
        duration,
        questions,
        createdAt: new Date().toISOString(),
        settings: {
            startDate,
            endDate,
            startTime,
            endTime,
            shuffleQuestions,
            shuffleOptions,
            allowRetakes,
            showResultsImmediately,
            passingScore,
            negativeMarking,
            negativeMarkValue
        }
    };
    
    const exams = getExams();
    exams.push(exam);
    saveExams(exams);
    
    // Save questions to question bank if checkbox is checked
    if (document.getElementById('saveToBank')?.checked) {
        questions.forEach(q => {
            addToQuestionBank({
                ...q,
                id: Date.now().toString() + Math.random(),
                addedAt: new Date().toISOString()
            });
        });
    }
    
    showAlert('Exam created successfully! Redirecting...', 'success');
    
    setTimeout(() => {
        window.location.href = 'teacher-dashboard.html';
    }, 1500);
});

addQuestion();
