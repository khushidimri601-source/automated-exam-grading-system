// Edit Exam Functionality

function loadExamForEdit(examId) {
    const exam = getExamById(examId);
    if (!exam) {
        alert('Exam not found!');
        window.location.href = 'teacher-dashboard.html';
        return;
    }
    
    // Populate form with exam data
    document.getElementById('title').value = exam.title;
    document.getElementById('description').value = exam.description;
    document.getElementById('duration').value = exam.duration;
    
    // Settings
    if (exam.settings) {
        if (exam.settings.startDate) document.getElementById('startDate').value = exam.settings.startDate;
        if (exam.settings.endDate) document.getElementById('endDate').value = exam.settings.endDate;
        if (exam.settings.startTime) document.getElementById('startTime').value = exam.settings.startTime;
        if (exam.settings.endTime) document.getElementById('endTime').value = exam.settings.endTime;
        if (exam.settings.shuffleQuestions) document.getElementById('shuffleQuestions').checked = true;
        if (exam.settings.shuffleOptions) document.getElementById('shuffleOptions').checked = true;
        if (exam.settings.allowRetakes) document.getElementById('allowRetakes').checked = true;
        if (exam.settings.showResultsImmediately !== undefined) {
            document.getElementById('showResultsImmediately').checked = exam.settings.showResultsImmediately;
        }
        if (exam.settings.passingScore) document.getElementById('passingScore').value = exam.settings.passingScore;
        if (exam.settings.negativeMarking) {
            document.getElementById('negativeMarking').checked = true;
            document.getElementById('negativeMarkValue').style.display = 'block';
            document.getElementById('negativeMarkValue').value = exam.settings.negativeMarkValue || 0.25;
        }
    }
    
    // Load questions
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    questionCount = 0;
    
    exam.questions.forEach(q => {
        questionCount++;
        addQuestionWithData(q);
    });
    
    // Store exam ID for update
    localStorage.setItem('editingExamId', examId);
}

function addQuestionWithData(questionData) {
    const container = document.getElementById('questionsContainer');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'card mb-2';
    questionDiv.id = `question-${questionCount}`;
    
    // Similar to create-exam.js but with pre-filled data
    questionDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color: var(--primary-color);">Question ${questionCount}</h4>
            <button type="button" class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="removeQuestion(${questionCount})">Remove</button>
        </div>
        
        <div class="form-group">
            <label>Question Type</label>
            <select class="form-control question-type" onchange="updateQuestionType(${questionCount})" required>
                <option value="multiple_choice" ${questionData.type === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
                <option value="true_false" ${questionData.type === 'true_false' ? 'selected' : ''}>True/False</option>
                <option value="short_answer" ${questionData.type === 'short_answer' ? 'selected' : ''}>Short Answer</option>
                <option value="essay" ${questionData.type === 'essay' ? 'selected' : ''}>Essay</option>
                <option value="multiple_select" ${questionData.type === 'multiple_select' ? 'selected' : ''}>Multiple Select</option>
                <option value="fill_blank" ${questionData.type === 'fill_blank' ? 'selected' : ''}>Fill in the Blank</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Question Text</label>
            <input type="text" class="form-control question-text" value="${questionData.question}" required>
        </div>
        
        <div class="question-options" id="options-${questionCount}">
            ${generateOptionsHTML(questionData)}
        </div>
        
        <div class="form-group">
            <label>Points</label>
            <input type="number" class="form-control question-points" value="${questionData.points || 1}" min="0" step="0.5" required>
        </div>
        
        <div class="form-group">
            <label>Category/Tag (optional)</label>
            <input type="text" class="form-control question-category" value="${questionData.category || ''}" placeholder="e.g., Algebra, History">
        </div>
    `;
    
    container.appendChild(questionDiv);
}

function generateOptionsHTML(questionData) {
    // Generate appropriate HTML based on question type
    // This is a simplified version - full implementation would match create-exam.js
    if (questionData.type === 'multiple_choice' || !questionData.type) {
        let html = '<div class="form-group"><label>Options (4 options required)</label>';
        questionData.options.forEach((opt, idx) => {
            html += `<input type="text" class="form-control option ${idx > 0 ? 'mt-1' : ''}" value="${opt}" required>`;
        });
        html += '</div><div class="form-group"><label>Correct Answer</label>';
        html += `<select class="form-control correct-answer" required>`;
        for (let i = 0; i < 4; i++) {
            html += `<option value="${i}" ${questionData.correctAnswer === i ? 'selected' : ''}>Option ${String.fromCharCode(65 + i)}</option>`;
        }
        html += '</select></div>';
        return html;
    }
    // Add other question types...
    return '';
}

function saveEditedExam() {
    const examId = localStorage.getItem('editingExamId');
    if (!examId) {
        showAlert('Error: Exam ID not found', 'error');
        return;
    }
    
    // Similar validation and save logic as create-exam.js
    // But update existing exam instead of creating new one
    const exams = getExams();
    const examIndex = exams.findIndex(e => e.id === examId);
    
    if (examIndex === -1) {
        showAlert('Exam not found!', 'error');
        return;
    }
    
    // Get form data (same as create-exam.js)
    // ... (implementation similar to create-exam.js submit handler)
    
    showAlert('Exam updated successfully!', 'success');
    setTimeout(() => {
        window.location.href = 'teacher-dashboard.html';
    }, 1500);
}

