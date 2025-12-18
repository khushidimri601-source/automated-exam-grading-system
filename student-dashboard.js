checkAuth('student');

const user = getCurrentUser();
document.getElementById('userName').textContent = `Hello, ${user.name}`;

function loadDashboard() {
    const exams = getExams();
    const results = getResultsByStudent(user.id);
    
    document.getElementById('availableExams').textContent = exams.length;
    document.getElementById('completedExams').textContent = results.length;
    
    if (results.length > 0) {
        const totalScore = results.reduce((sum, r) => sum + (r.score / r.totalQuestions * 100), 0);
        const average = (totalScore / results.length).toFixed(0);
        document.getElementById('averageScore').textContent = `${average}%`;
    }
    
    displayExams(exams, results);
    displayResults(results);
}

function displayExams(exams, results) {
    const examsList = document.getElementById('examsList');
    
    // Filter exams by schedule
    const now = new Date();
    const availableExams = exams.filter(exam => {
        const settings = exam.settings || {};
        if (settings.startDate) {
            const startDate = new Date(settings.startDate + (settings.startTime ? 'T' + settings.startTime : ''));
            if (now < startDate) return false;
        }
        if (settings.endDate) {
            const endDate = new Date(settings.endDate + (settings.endTime ? 'T' + settings.endTime : ''));
            if (now > endDate) return false;
        }
        return true;
    });
    
    if (availableExams.length === 0) {
        examsList.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exams available yet. Check back later!</p>';
        return;
    }
    
    let html = '<div class="grid grid-2">';
    
    availableExams.forEach(exam => {
        const hasAttempted = results.some(r => r.examId === exam.id && !exam.settings?.allowRetakes);
        const result = results.find(r => r.examId === exam.id);
        const settings = exam.settings || {};
        const deadline = settings.endDate ? `<br><small style="color: var(--warning-color);">Deadline: ${new Date(settings.endDate).toLocaleDateString()}</small>` : '';
        
        html += `
            <div class="card">
                <h3 style="color: var(--primary-color); margin-bottom: 10px;">${exam.title}</h3>
                <p style="color: var(--gray); margin-bottom: 10px;">${exam.description}</p>
                <div style="margin-bottom: 15px;">
                    <span style="color: var(--gray); font-size: 14px;">📝 ${exam.questions.length} questions</span> | 
                    <span style="color: var(--gray); font-size: 14px;">⏱️ ${exam.duration} minutes</span>
                    ${deadline}
                </div>
                <p style="color: var(--gray); font-size: 14px; margin-bottom: 15px;">Created by: ${exam.teacherName}</p>
        `;
        
        if (hasAttempted && !settings.allowRetakes) {
            const percentage = ((result.score / (result.totalPoints || result.totalQuestions)) * 100).toFixed(0);
            html += `
                <div class="alert alert-success" style="margin-bottom: 10px;">
                    ✅ Completed - Score: ${result.score}/${result.totalPoints || result.totalQuestions} (${percentage}%)
                </div>
                <button class="btn btn-primary" onclick="viewResult('${result.id}')" style="width: 100%;">View Result</button>
            `;
        } else {
            html += `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-success" onclick="startExam('${exam.id}')" style="flex: 1;">Type Answers (Online)</button>
                        <button class="btn btn-secondary" onclick="startStudyMode('${exam.id}')" style="flex: 1;">Study Mode</button>
                    </div>
                    <button class="btn btn-outline" onclick="uploadWrittenAnswers('${exam.id}')" style="width: 100%;">
                        Upload Written Answer Sheet (PDF/Image)
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
    });
    
    html += '</div>';
    examsList.innerHTML = html;
}

function displayResults(results) {
    const resultsList = document.getElementById('resultsList');
    const exams = getExams();
    
    if (results.length === 0) {
        resultsList.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exam attempts yet. Start an exam to see your results!</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Date</th><th>Action</th></tr></thead><tbody>';
    
    results.forEach(result => {
        const exam = exams.find(e => e.id === result.examId);
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(0);
        
        let badgeClass = 'badge-success';
        if (percentage < 50) badgeClass = 'badge-danger';
        else if (percentage < 75) badgeClass = 'badge-warning';
        
        html += `
            <tr>
                <td>${exam ? exam.title : 'Unknown'}</td>
                <td><span class="badge ${badgeClass}">${result.score}/${result.totalQuestions}</span></td>
                <td>${percentage}%</td>
                <td>${new Date(result.completedAt).toLocaleDateString()}</td>
                <td><button class="btn btn-primary" style="padding: 6px 12px; font-size: 14px;" onclick="viewResult('${result.id}')">View Details</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    resultsList.innerHTML = html;
}

function startExam(examId) {
    localStorage.setItem('currentExamId', examId);
    window.location.href = 'take-exam.html';
}

function uploadWrittenAnswers(examId) {
    // Remember which exam the student chose and go to upload page
    localStorage.setItem('uploadExamId', examId);
    window.location.href = 'student-upload-answers.html';
}

function viewResult(resultId) {
    localStorage.setItem('viewResultId', resultId);
    window.location.href = 'result.html';
}

loadDashboard();
