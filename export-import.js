// Export/Import functionality

function exportResultsToCSV(examId) {
    const results = getResultsByExam(examId);
    const exam = getExamById(examId);
    const users = getUsers();
    
    if (results.length === 0) {
        showAlert('No results to export!', 'error');
        return;
    }
    
    let csv = 'Student Name,Email,Score,Total Questions,Percentage,Date\n';
    
    results.forEach(result => {
        const student = users.find(u => u.id === result.studentId);
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(2);
        csv += `"${student ? student.name : 'Unknown'}","${student ? student.email : ''}",${result.score},${result.totalQuestions},${percentage},"${new Date(result.completedAt).toLocaleString()}"\n`;
    });
    
    downloadFile(csv, `${exam.title}_results.csv`, 'text/csv');
}

function exportResultsToJSON(examId) {
    const results = getResultsByExam(examId);
    const exam = getExamById(examId);
    const users = getUsers();
    
    const exportData = {
        exam: {
            id: exam.id,
            title: exam.title,
            description: exam.description
        },
        results: results.map(result => {
            const student = users.find(u => u.id === result.studentId);
            return {
                student: {
                    name: student ? student.name : 'Unknown',
                    email: student ? student.email : ''
                },
                score: result.score,
                totalQuestions: result.totalQuestions,
                percentage: ((result.score / result.totalQuestions) * 100).toFixed(2),
                completedAt: result.completedAt,
                answers: result.answers
            };
        }),
        exportedAt: new Date().toISOString()
    };
    
    downloadFile(JSON.stringify(exportData, null, 2), `${exam.title}_results.json`, 'application/json');
}

function exportExamToJSON(examId) {
    const exam = getExamById(examId);
    if (!exam) {
        showAlert('Exam not found!', 'error');
        return;
    }
    
    downloadFile(JSON.stringify(exam, null, 2), `${exam.title}_exam.json`, 'application/json');
}

function exportAllData() {
    const data = {
        users: getUsers(),
        exams: getExams(),
        results: getResults(),
        questionBank: getQuestionBank(),
        exportedAt: new Date().toISOString()
    };
    
    downloadFile(JSON.stringify(data, null, 2), `exam_system_backup_${Date.now()}.json`, 'application/json');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                
                if (confirm('This will replace all existing data. Are you sure?')) {
                    if (data.users) {
                        localStorage.setItem('users', JSON.stringify(data.users));
                    }
                    if (data.exams) {
                        localStorage.setItem('exams', JSON.stringify(data.exams));
                    }
                    if (data.results) {
                        localStorage.setItem('results', JSON.stringify(data.results));
                    }
                    if (data.questionBank) {
                        localStorage.setItem('questionBank', JSON.stringify(data.questionBank));
                    }
                    
                    showAlert('Data imported successfully!', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            } catch (error) {
                showAlert('Error importing data: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// PDF Export (requires html2pdf library or similar)
function exportResultsToPDF(examId) {
    const results = getResultsByExam(examId);
    const exam = getExamById(examId);
    const users = getUsers();
    
    if (results.length === 0) {
        showAlert('No results to export!', 'error');
        return;
    }
    
    let html = `
        <html>
        <head>
            <title>${exam.title} - Results</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #6366f1; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f3f4f6; }
            </style>
        </head>
        <body>
            <h1>${exam.title} - Exam Results</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <table>
                <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Date</th>
                </tr>
    `;
    
    results.forEach(result => {
        const student = users.find(u => u.id === result.studentId);
        const percentage = ((result.score / result.totalQuestions) * 100).toFixed(2);
        html += `
            <tr>
                <td>${student ? student.name : 'Unknown'}</td>
                <td>${student ? student.email : ''}</td>
                <td>${result.score}/${result.totalQuestions}</td>
                <td>${percentage}%</td>
                <td>${new Date(result.completedAt).toLocaleDateString()}</td>
            </tr>
        `;
    });
    
    html += `
            </table>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

