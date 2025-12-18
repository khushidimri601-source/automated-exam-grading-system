// Student-side upload of written answer sheets using OCR

checkAuth('student');

let selectedExam = null;
let studentOcrResult = null;

const currentUser = getCurrentUser();

document.addEventListener('DOMContentLoaded', function () {
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan && currentUser) {
        userNameSpan.textContent = `Hello, ${currentUser.name}`;
    }
    loadStudentExamsForUpload();
});

function loadStudentExamsForUpload() {
    const exams = getExams();
    const select = document.getElementById('examSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select an Exam --</option>';

    exams.forEach(exam => {
        const opt = document.createElement('option');
        opt.value = exam.id;
        opt.textContent = `${exam.title} (${exam.questions.length} questions)`;
        select.appendChild(opt);
    });

    // If coming from dashboard with a chosen exam, pre-select it
    const preselectedId = localStorage.getItem('uploadExamId');
    if (preselectedId) {
        const match = exams.find(e => e.id === preselectedId);
        if (match) {
            select.value = preselectedId;
            selectedExam = match;
            document.getElementById('uploadCard').style.display = 'block';
            renderExamQuestions();
        }
        // Clear after use so it doesn't affect next time
        localStorage.removeItem('uploadExamId');
    }

    select.addEventListener('change', () => {
        const examId = select.value;
        if (!examId) {
            document.getElementById('uploadCard').style.display = 'none';
            const questionsCard = document.getElementById('questionsCard');
            if (questionsCard) questionsCard.style.display = 'none';
            return;
        }
        selectedExam = getExamById(examId);
        document.getElementById('uploadCard').style.display = 'block';
        document.getElementById('resultsCard').style.display = 'none';
        document.getElementById('processingStatus').style.display = 'none';
        renderExamQuestions();
    });
}

function renderExamQuestions() {
    if (!selectedExam) return;
    const card = document.getElementById('questionsCard');
    const container = document.getElementById('questionsPreview');
    if (!card || !container) return;

    let html = '';
    selectedExam.questions.forEach((q, index) => {
        html += `
            <div style="margin-bottom: 10px; padding: 10px; background: var(--bg-color); border-radius: 6px;">
                <div style="font-weight: 600; margin-bottom: 4px;">Q${index + 1}.</div>
                <div style="margin-bottom: 4px;">${q.question}</div>
                ${q.type ? `<div style="font-size: 12px; color: var(--gray);">Type: ${q.type}</div>` : ''}
            </div>
        `;
    });

    container.innerHTML = html || '<p style="color: var(--gray);">No questions found for this exam.</p>';
    card.style.display = 'block';
}

async function studentProcessOCR() {
    if (!selectedExam) {
        showStudentUploadAlert('Please select an exam first.', 'error');
        return;
    }

    const fileInput = document.getElementById('answerSheetFile');
    const file = fileInput.files[0];

    if (!file) {
        showStudentUploadAlert('Please select a PDF or image of your answer sheet.', 'error');
        return;
    }

    document.getElementById('processingStatus').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('statusMessage').textContent = 'Reading your answer sheet...';

    try {
        const fileData = await readFileAsArrayBuffer(file);

        const questions = selectedExam.questions.map(q => ({
            id: q.id,
            question: q.question,
            correctAnswer: q.correctAnswer || '',
            points: parseFloat(q.points) || 1.0,
            type: q.type || 'short_answer',
            mandatoryTerms: q.mandatoryTerms || []
        }));

        const queryParams = new URLSearchParams({
            questions: JSON.stringify(questions),
            lang: 'eng',
            minConfidence: '30.0'
        });

        const response = await fetch(`/api/grade-ocr?${queryParams}`, {
            method: 'POST',
            headers: {
                'X-Filename': file.name
            },
            body: fileData
        });

        const result = await response.json();

        document.getElementById('processingStatus').style.display = 'none';

        if (!result.success) {
            showStudentUploadAlert(result.message || 'Could not read your answer sheet. Please try a clearer scan.', 'error');
            return;
        }

        studentOcrResult = result;
        displayStudentOcrResult(result);
    } catch (err) {
        console.error('Student OCR error:', err);
        document.getElementById('processingStatus').style.display = 'none';
        showStudentUploadAlert('Error uploading answer sheet: ' + err.message, 'error');
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function displayStudentOcrResult(result) {
    const resultsCard = document.getElementById('resultsCard');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsDetails = document.getElementById('resultsDetails');

    resultsCard.style.display = 'block';

    const summary = result.summary;
    const confidence = result.ocr_confidence;

    resultsSummary.innerHTML = `
        <h4>Preview Summary</h4>
        <p><strong>Detected total marks (approx):</strong> ${summary.total_marks.toFixed(2)} / ${summary.max_total_marks.toFixed(2)}</p>
        <p><strong>OCR Confidence:</strong> ${confidence.toFixed(1)}%</p>
        <p style="color: var(--warning-color); font-size: 14px;">Note: This is an automatic preview only. Your teacher will review and finalize the marks.</p>
    `;

    let detailsHTML = '';

    result.results.forEach(qResult => {
        let questionText = '';
        if (selectedExam && Array.isArray(selectedExam.questions)) {
            const idx = (qResult.question_number || 1) - 1;
            if (idx >= 0 && idx < selectedExam.questions.length) {
                questionText = selectedExam.questions[idx].question || '';
            }
        }

        detailsHTML += `
            <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-color); border-radius: 6px;">
                <h4>Question ${qResult.question_number}</h4>
                ${questionText ? `<p><strong>Question Text:</strong> ${questionText}</p>` : ''}
                <p><strong>Detected Answer:</strong></p>
                <div style="background: white; padding: 8px; border-radius: 4px; font-family: monospace; white-space: pre-wrap;">${qResult.extracted_answer || '(No answer detected)'}</div>
                <p style="margin-top: 8px;"><strong>AI Feedback:</strong> ${qResult.feedback}</p>
                ${qResult.needs_manual_review ? '<p style="color: var(--warning-color); font-size: 13px;">⚠ This answer may need manual review.</p>' : ''}
            </div>
        `;
    });

    resultsDetails.innerHTML = detailsHTML;
}

function showStudentUploadAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.textContent = message;
    div.style.marginTop = '10px';

    container.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 5000);
}