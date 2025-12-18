// Duplicate Exam Functionality

function duplicateExam(examId) {
    const exam = getExamById(examId);
    if (!exam) {
        showAlert('Exam not found!', 'error');
        return;
    }
    
    if (confirm(`Duplicate "${exam.title}"?`)) {
        const newExam = {
            ...exam,
            id: Date.now().toString(),
            title: exam.title + ' (Copy)',
            createdAt: new Date().toISOString()
        };
        
        const exams = getExams();
        exams.push(newExam);
        saveExams(exams);
        
        showAlert('Exam duplicated successfully!', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
}

