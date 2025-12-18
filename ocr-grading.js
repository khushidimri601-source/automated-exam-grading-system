// OCR-Based Exam Grading Frontend Logic

let selectedExam = null;
let gradingResults = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadExams();
    checkAuth();
});

function loadExams() {
    const exams = getExams();
    const examSelect = document.getElementById('examSelect');
    
    examSelect.innerHTML = '<option value="">-- Select an Exam --</option>';
    
    exams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.id;
        option.textContent = `${exam.title} (${exam.questions.length} questions)`;
        examSelect.appendChild(option);
    });
}

function loadExamQuestions() {
    const examId = document.getElementById('examSelect').value;
    if (!examId) {
        document.getElementById('uploadCard').style.display = 'none';
        document.getElementById('examInfo').style.display = 'none';
        selectedExam = null;
        return;
    }
    
    const exam = getExamById(examId);
    if (!exam) {
        showAlert('Exam not found.', 'error');
        return;
    }
    
    selectedExam = exam;
    
    // Display exam info
    const examInfo = document.getElementById('examInfo');
    const examDetails = document.getElementById('examDetails');
    examInfo.style.display = 'block';
    examDetails.innerHTML = `
        <strong>Title:</strong> ${exam.title}<br>
        <strong>Questions:</strong> ${exam.questions.length}<br>
        <strong>Total Points:</strong> ${exam.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0).toFixed(1)}<br>
        <strong>Duration:</strong> ${exam.duration || 'N/A'} minutes
    `;
    
    // Show upload card
    document.getElementById('uploadCard').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('processingStatus').style.display = 'none';
}

async function processOCRGrading() {
    if (!selectedExam) {
        showAlert('Please select an exam first.', 'error');
        return;
    }
    
    const fileInput = document.getElementById('answerSheetFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Please select an answer sheet file.', 'error');
        return;
    }
    
    // Show processing status
    document.getElementById('processingStatus').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('statusMessage').textContent = 'Extracting text from answer sheet...';
    
    try {
        // Read file as array buffer
        const fileData = await readFileAsArrayBuffer(file);
        
        // Get OCR settings
        const lang = document.getElementById('ocrLang').value;
        const minConfidence = parseFloat(document.getElementById('minConfidence').value);
        
        // Prepare questions data
        const questions = selectedExam.questions.map(q => ({
            id: q.id,
            question: q.question,
            correctAnswer: q.correctAnswer || '',
            points: parseFloat(q.points) || 1.0,
            type: q.type || 'short_answer',
            mandatoryTerms: q.mandatoryTerms || []
        }));
        
        // Build query parameters
        const queryParams = new URLSearchParams({
            questions: JSON.stringify(questions),
            lang: lang,
            minConfidence: minConfidence.toString()
        });
        
        // Send file to server
        const response = await fetch(`/api/grade-ocr?${queryParams}`, {
            method: 'POST',
            headers: {
                'X-Filename': file.name
            },
            body: fileData
        });
        
        const result = await response.json();
        
        // Hide processing status
        document.getElementById('processingStatus').style.display = 'none';
        
        if (!result.success) {
            showAlert(`Grading failed: ${result.message}`, 'error');
            return;
        }
        
        // Display results
        gradingResults = result;
        displayResults(result);
        
    } catch (error) {
        console.error('OCR grading error:', error);
        document.getElementById('processingStatus').style.display = 'none';
        showAlert(`Error processing answer sheet: ${error.message}`, 'error');
    }
}

function displayResults(result) {
    const resultsCard = document.getElementById('resultsCard');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsDetails = document.getElementById('resultsDetails');
    
    resultsCard.style.display = 'block';
    
    // Summary
    const summary = result.summary;
    const confidence = result.ocr_confidence;
    
    let summaryHTML = `
        <h3>Grading Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
            <div style="padding: 10px; background: var(--bg-color); border-radius: 5px;">
                <strong>Total Marks:</strong><br>
                <span style="font-size: 1.5em; color: var(--primary-color);">
                    ${summary.total_marks.toFixed(2)} / ${summary.max_total_marks.toFixed(2)}
                </span>
            </div>
            <div style="padding: 10px; background: var(--bg-color); border-radius: 5px;">
                <strong>Percentage:</strong><br>
                <span style="font-size: 1.5em; color: var(--primary-color);">
                    ${summary.percentage.toFixed(1)}%
                </span>
            </div>
            <div style="padding: 10px; background: var(--bg-color); border-radius: 5px;">
                <strong>OCR Confidence:</strong><br>
                <span style="font-size: 1.5em; color: ${confidence >= 70 ? 'green' : confidence >= 50 ? 'orange' : 'red'};">
                    ${confidence.toFixed(1)}%
                </span>
            </div>
            <div style="padding: 10px; background: var(--bg-color); border-radius: 5px;">
                <strong>Manual Review:</strong><br>
                <span style="font-size: 1.5em; color: ${summary.needs_manual_review > 0 ? 'orange' : 'green'};">
                    ${summary.needs_manual_review} question(s)
                </span>
            </div>
        </div>
    `;
    
    resultsSummary.innerHTML = summaryHTML;
    
    // Detailed results
    let detailsHTML = '<h3>Question-wise Results</h3>';
    
    result.results.forEach((qResult, index) => {
        const needsReview = qResult.needs_manual_review;
        const cardColor = needsReview ? 'rgba(255, 165, 0, 0.1)' : 'rgba(0, 128, 0, 0.1)';
        const borderColor = needsReview ? 'orange' : 'green';
        
        detailsHTML += `
            <div style="margin-bottom: 20px; padding: 15px; background: ${cardColor}; border-left: 4px solid ${borderColor}; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4>Question ${qResult.question_number} ${needsReview ? '<span style="color: orange;">⚠ Needs Manual Review</span>' : ''}</h4>
                    <div style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">
                        ${qResult.marks_awarded.toFixed(2)} / ${qResult.max_marks.toFixed(2)}
                    </div>
                </div>
                <p><strong>Question:</strong> ${qResult.question_text}</p>
                <p><strong>Extracted Answer:</strong></p>
                <div style="padding: 10px; background: white; border-radius: 5px; margin: 10px 0; font-family: monospace; white-space: pre-wrap;">
${qResult.extracted_answer || '(No answer found)'}
                </div>
                <p><strong>Feedback:</strong> ${qResult.feedback}</p>
                ${qResult.similarity_score !== undefined ? `
                    <p><strong>Semantic Similarity:</strong> ${(qResult.similarity_score * 100).toFixed(1)}%</p>
                ` : ''}
                ${qResult.confidence !== undefined ? `
                    <p><strong>Confidence:</strong> ${qResult.confidence.toFixed(1)}%</p>
                ` : ''}
            </div>
        `;
    });
    
    resultsDetails.innerHTML = detailsHTML;
    
    // Scroll to results
    resultsCard.scrollIntoView({ behavior: 'smooth' });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function saveResults() {
    if (!gradingResults || !selectedExam) {
        showAlert('No results to save.', 'error');
        return;
    }
    
    // Create a result entry
    const result = {
        id: 'ocr_' + Date.now(),
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        studentId: 'ocr_scanned',
        studentName: 'Scanned Answer Sheet',
        timestamp: new Date().toISOString(),
        totalScore: gradingResults.summary.total_marks,
        maxScore: gradingResults.summary.max_total_marks,
        percentage: gradingResults.summary.percentage,
        answers: gradingResults.results.map(q => ({
            questionId: q.question_id,
            question: q.question_text,
            userAnswer: q.extracted_answer,
            correctAnswer: selectedExam.questions.find(qq => qq.id === q.question_id)?.correctAnswer || '',
            isCorrect: q.marks_awarded >= q.max_marks * 0.8, // Approximate
            points: q.max_marks,
            earnedPoints: q.marks_awarded,
            feedback: q.feedback,
            needsManualReview: q.needs_manual_review
        })),
        ocrConfidence: gradingResults.ocr_confidence,
        gradingMethod: 'ocr'
    };
    
    // Save to results
    const results = getResults();
    results.push(result);
    saveResults(results);
    
    showAlert('Results saved successfully!', 'success');
}

function exportResults() {
    if (!gradingResults) {
        showAlert('No results to export.', 'error');
        return;
    }
    
    const exportData = {
        exam: selectedExam ? {
            id: selectedExam.id,
            title: selectedExam.title
        } : null,
        gradingResults: gradingResults,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_grading_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function resetForm() {
    document.getElementById('answerSheetFile').value = '';
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('processingStatus').style.display = 'none';
    gradingResults = null;
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.marginTop = '10px';
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function checkAuth() {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user || user.role !== 'teacher') {
        window.location.href = 'login.html';
    }
}

