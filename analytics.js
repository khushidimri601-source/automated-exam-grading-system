checkAuth('teacher');

const user = getCurrentUser();

function loadAnalytics() {
    const exams = getExams().filter(e => e.teacherId === user.id);
    const allResults = getResults();
    const users = getUsers();
    
    const myExamIds = exams.map(e => e.id);
    const myResults = allResults.filter(r => myExamIds.includes(r.examId));
    
    const uniqueStudentIds = [...new Set(myResults.map(r => r.studentId))];
    const students = users.filter(u => uniqueStudentIds.includes(u.id));
    
    document.getElementById('totalExams').textContent = exams.length;
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalAttempts').textContent = myResults.length;
    
    displayExamsOverview(exams, myResults);
    displayStudentsOverview(students, myResults);
    displayPerformanceStats(myResults);
    displayAllResults(myResults, exams, users);
}

function displayExamsOverview(exams, results) {
    const container = document.getElementById('examsOverview');
    
    if (exams.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exams created yet.</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Exam Name</th><th>Questions</th><th>Attempts</th><th>Avg Score</th></tr></thead><tbody>';
    
    exams.forEach(exam => {
        const examResults = results.filter(r => r.examId === exam.id);
        const attempts = examResults.length;
        
        let avgScore = 0;
        if (attempts > 0) {
            const totalScore = examResults.reduce((sum, r) => sum + (r.score / r.totalQuestions * 100), 0);
            avgScore = (totalScore / attempts).toFixed(0);
        }
        
        let scoreClass = 'badge-success';
        if (avgScore < 50) scoreClass = 'badge-danger';
        else if (avgScore < 75) scoreClass = 'badge-warning';
        
        html += `
            <tr>
                <td><strong>${exam.title}</strong></td>
                <td>${exam.questions.length}</td>
                <td><span class="badge badge-success">${attempts}</span></td>
                <td><span class="badge ${scoreClass}">${avgScore}%</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayStudentsOverview(students, results) {
    const container = document.getElementById('studentsOverview');
    
    if (students.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No students have attempted your exams yet.</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Student Name</th><th>Email</th><th>Attempts</th><th>Avg Score</th></tr></thead><tbody>';
    
    students.forEach(student => {
        const studentResults = results.filter(r => r.studentId === student.id);
        const attempts = studentResults.length;
        
        let avgScore = 0;
        if (attempts > 0) {
            const totalScore = studentResults.reduce((sum, r) => sum + (r.score / r.totalQuestions * 100), 0);
            avgScore = (totalScore / attempts).toFixed(0);
        }
        
        let scoreClass = 'badge-success';
        if (avgScore < 50) scoreClass = 'badge-danger';
        else if (avgScore < 75) scoreClass = 'badge-warning';
        
        html += `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td>${student.email}</td>
                <td><span class="badge badge-success">${attempts}</span></td>
                <td><span class="badge ${scoreClass}">${avgScore}%</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayPerformanceStats(results) {
    if (results.length === 0) {
        document.getElementById('avgScore').textContent = '0%';
        document.getElementById('highestScore').textContent = '0%';
        document.getElementById('lowestScore').textContent = '0%';
        return;
    }
    
    const scores = results.map(r => (r.score / r.totalQuestions * 100));
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const avgScore = (totalScore / results.length).toFixed(0);
    const highestScore = Math.max(...scores).toFixed(0);
    const lowestScore = Math.min(...scores).toFixed(0);
    
    document.getElementById('avgScore').textContent = `${avgScore}%`;
    document.getElementById('highestScore').textContent = `${highestScore}%`;
    document.getElementById('lowestScore').textContent = `${lowestScore}%`;
}

function displayAllResults(results, exams, users) {
    const container = document.getElementById('allResults');
    
    if (results.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exam attempts yet.</p>';
        return;
    }
    
    const sortedResults = results.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    let html = '<table class="table"><thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Percentage</th><th>Date</th><th>Action</th></tr></thead><tbody>';
    
    sortedResults.forEach(result => {
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
                <td><span class="badge ${badgeClass}">${result.score}/${result.totalQuestions}</span></td>
                <td>${percentage}%</td>
                <td>${new Date(result.completedAt).toLocaleDateString()}</td>
                <td><button class="btn btn-primary" style="padding: 6px 12px; font-size: 14px;" onclick="viewResult('${result.id}')">View Details</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function viewResult(resultId) {
    localStorage.setItem('viewResultId', resultId);
    window.location.href = 'result.html';
}

loadAnalytics();
