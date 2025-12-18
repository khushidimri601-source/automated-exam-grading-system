checkAuth('teacher');

const examId = localStorage.getItem('viewExamId');
if (!examId) {
    window.location.href = 'teacher-dashboard.html';
}

const exam = getExamById(examId);
if (!exam) {
    alert('Exam not found!');
    window.location.href = 'teacher-dashboard.html';
}

document.getElementById('examTitle').textContent = exam.title;
document.getElementById('examDescription').textContent = exam.description;

const results = getResultsByExam(examId);
const users = getUsers();

document.getElementById('totalAttempts').textContent = results.length;

if (results.length > 0) {
    const totalScore = results.reduce((sum, r) => sum + (r.score / r.totalQuestions * 100), 0);
    const average = (totalScore / results.length).toFixed(0);
    document.getElementById('averageScore').textContent = `${average}%`;
    
    const highest = Math.max(...results.map(r => (r.score / r.totalQuestions * 100)));
    document.getElementById('highestScore').textContent = `${highest.toFixed(0)}%`;
} else {
    document.getElementById('averageScore').textContent = '0%';
    document.getElementById('highestScore').textContent = '0%';
}

function displayResults() {
    const resultsList = document.getElementById('resultsList');
    
    if (results.length === 0) {
        resultsList.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No student attempts yet.</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Student Name</th><th>Score</th><th>Percentage</th><th>Date Completed</th><th>Action</th></tr></thead><tbody>';
    
    results.forEach(result => {
        const student = users.find(u => u.id === result.studentId);
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(0);
        
        let badgeClass = 'badge-success';
        if (percentage < 50) badgeClass = 'badge-danger';
        else if (percentage < 75) badgeClass = 'badge-warning';
        
        html += `
            <tr>
                <td>${student ? student.name : 'Unknown Student'}</td>
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

function viewResult(resultId) {
    localStorage.setItem('viewResultId', resultId);
    window.location.href = 'result.html';
}

displayResults();
