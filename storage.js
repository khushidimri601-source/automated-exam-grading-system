// Enhanced storage functions with support for all new features

function getExams() {
    const exams = localStorage.getItem('exams');
    return exams ? JSON.parse(exams) : [];
}

function saveExams(exams) {
    localStorage.setItem('exams', JSON.stringify(exams));
}

function getExamById(examId) {
    const exams = getExams();
    return exams.find(e => e.id === examId);
}

function getResults() {
    const results = localStorage.getItem('results');
    return results ? JSON.parse(results) : [];
}

function saveResults(results) {
    localStorage.setItem('results', JSON.stringify(results));
}

function getResultsByStudent(studentId) {
    const results = getResults();
    return results.filter(r => r.studentId === studentId);
}

function getResultsByExam(examId) {
    const results = getResults();
    return results.filter(r => r.examId === examId);
}

function addResult(result) {
    const results = getResults();
    results.push(result);
    saveResults(results);
}

function deleteExam(examId) {
    let exams = getExams();
    exams = exams.filter(e => e.id !== examId);
    saveExams(exams);
    
    let results = getResults();
    results = results.filter(r => r.examId !== examId);
    saveResults(results);
}

// Question Bank Functions
function getQuestionBank() {
    const bank = localStorage.getItem('questionBank');
    return bank ? JSON.parse(bank) : [];
}

function saveQuestionBank(bank) {
    localStorage.setItem('questionBank', JSON.stringify(bank));
}

function addToQuestionBank(question) {
    const bank = getQuestionBank();
    bank.push(question);
    saveQuestionBank(bank);
}

// Notifications Functions
function getNotifications() {
    const notifications = localStorage.getItem('notifications');
    return notifications ? JSON.parse(notifications) : [];
}

function saveNotifications(notifications) {
    localStorage.setItem('notifications', JSON.stringify(notifications));
}

function addNotification(notification) {
    const notifications = getNotifications();
    notifications.push(notification);
    saveNotifications(notifications);
}

// Bookmarks Functions
function getBookmarks() {
    const bookmarks = localStorage.getItem('bookmarks');
    return bookmarks ? JSON.parse(bookmarks) : [];
}

function saveBookmarks(bookmarks) {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

// Exam Settings Functions
function getExamSettings() {
    const settings = localStorage.getItem('examSettings');
    return settings ? JSON.parse(settings) : {};
}

function saveExamSettings(settings) {
    localStorage.setItem('examSettings', JSON.stringify(settings));
}

// Study Mode Functions
function getStudyAttempts() {
    const attempts = localStorage.getItem('studyAttempts');
    return attempts ? JSON.parse(attempts) : [];
}

function saveStudyAttempts(attempts) {
    localStorage.setItem('studyAttempts', JSON.stringify(attempts));
}
