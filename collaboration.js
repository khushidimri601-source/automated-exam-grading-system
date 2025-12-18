// Collaboration Features - Multiple Teachers, Shared Banks

function shareQuestionBank(questionId, teacherIds) {
    const bank = getQuestionBank();
    const question = bank.find(q => q.id === questionId);
    
    if (!question) {
        showAlert('Question not found!', 'error');
        return;
    }
    
    // Add shared flag
    question.shared = true;
    question.sharedWith = teacherIds;
    question.sharedAt = new Date().toISOString();
    
    saveQuestionBank(bank);
    showAlert('Question shared successfully!', 'success');
}

function getSharedQuestions() {
    const bank = getQuestionBank();
    return bank.filter(q => q.shared === true);
}

function addCollaboratorToExam(examId, teacherId) {
    const exam = getExamById(examId);
    if (!exam) {
        showAlert('Exam not found!', 'error');
        return;
    }
    
    if (!exam.collaborators) {
        exam.collaborators = [];
    }
    
    if (!exam.collaborators.includes(teacherId)) {
        exam.collaborators.push(teacherId);
        const exams = getExams();
        const examIndex = exams.findIndex(e => e.id === examId);
        exams[examIndex] = exam;
        saveExams(exams);
        showAlert('Collaborator added!', 'success');
    } else {
        showAlert('Teacher is already a collaborator!', 'error');
    }
}

function removeCollaboratorFromExam(examId, teacherId) {
    const exam = getExamById(examId);
    if (!exam || !exam.collaborators) {
        return;
    }
    
    exam.collaborators = exam.collaborators.filter(id => id !== teacherId);
    const exams = getExams();
    const examIndex = exams.findIndex(e => e.id === examId);
    exams[examIndex] = exam;
    saveExams(exams);
    showAlert('Collaborator removed!', 'success');
}

function getCollaborativeExams() {
    const user = getCurrentUser();
    const exams = getExams();
    
    // Get exams where user is owner or collaborator
    return exams.filter(e => 
        e.teacherId === user.id || 
        (e.collaborators && e.collaborators.includes(user.id))
    );
}


