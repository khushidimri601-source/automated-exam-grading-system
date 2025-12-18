checkAuth('teacher');

const user = getCurrentUser();
document.getElementById('userName').textContent = `Hello, ${user.name}`;

function loadDashboard() {
    const exams = getExams().filter(e => e.teacherId === user.id);
    const results = getResults();
    const users = getUsers();
    
    document.getElementById('totalExams').textContent = exams.length;
    
    const students = users.filter(u => u.role === 'student');
    document.getElementById('totalStudents').textContent = students.length;
    
    const myExamIds = exams.map(e => e.id);
    const myResults = results.filter(r => myExamIds.includes(r.examId));
    document.getElementById('totalAttempts').textContent = myResults.length;
    
    displayExams(exams);
    displayResults(myResults);
}

function displayExams(exams) {
    const examsList = document.getElementById('examsList');
    
    if (exams.length === 0) {
        examsList.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exams created yet. Click "Create New Exam" to get started!</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Exam Title</th><th>Questions</th><th>Duration</th><th>Attempts</th><th>Actions</th></tr></thead><tbody>';
    
    exams.forEach(exam => {
        const attempts = getResultsByExam(exam.id).length;
        const settings = exam.settings || {};
        const hasDeadline = settings.endDate ? ` (Deadline: ${new Date(settings.endDate).toLocaleDateString()})` : '';
        
        html += `
            <tr>
                <td><strong>${exam.title}</strong>${hasDeadline}</td>
                <td>${exam.questions.length} questions</td>
                <td>${exam.duration} minutes</td>
                <td><span class="badge badge-success">${attempts}</span></td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 14px;" onclick="viewExamResults('${exam.id}')">View Results</button>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 14px;" onclick="editExam('${exam.id}')">Edit</button>
                    <button class="btn btn-warning" style="padding: 6px 12px; font-size: 14px;" onclick="duplicateExam('${exam.id}')">Duplicate</button>
                    <button class="btn btn-info" style="padding: 6px 12px; font-size: 14px;" onclick="exportResultsToCSV('${exam.id}')">Export</button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteExamConfirm('${exam.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    examsList.innerHTML = html;
}

function displayResults(results) {
    const resultsList = document.getElementById('resultsList');
    const users = getUsers();
    const exams = getExams();
    
    if (results.length === 0) {
        resultsList.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No student attempts yet.</p>';
        return;
    }
    
    const recentResults = results.slice(-10).reverse();
    
    let html = '<table class="table"><thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Date</th><th>Action</th></tr></thead><tbody>';
    
    recentResults.forEach(result => {
        const student = users.find(u => u.id === result.studentId);
        const exam = exams.find(e => e.id === result.examId);
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(0);
        
        let badgeClass = 'badge-success';
        if (percentage < 50) badgeClass = 'badge-danger';
        else if (percentage < 75) badgeClass = 'badge-warning';
        
        html += `
            <tr>
                <td>${student ? student.name : 'Unknown'}</td>
                <td>${exam ? exam.title : 'Unknown'}</td>
                <td><span class="badge ${badgeClass}">${result.score}/${result.totalQuestions} (${percentage}%)</span></td>
                <td>${new Date(result.completedAt).toLocaleDateString()}</td>
                <td><button class="btn btn-primary" style="padding: 6px 12px; font-size: 14px;" onclick="viewResult('${result.id}')">View Details</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    resultsList.innerHTML = html;
}

function viewExamResults(examId) {
    localStorage.setItem('viewExamId', examId);
    window.location.href = 'exam-results.html';
}

function viewResult(resultId) {
    localStorage.setItem('viewResultId', resultId);
    window.location.href = 'result.html';
}

function deleteExamConfirm(examId) {
    // Immediately delete the exam without prompting the user
    deleteExam(examId);
    loadDashboard();
}

loadDashboard();
