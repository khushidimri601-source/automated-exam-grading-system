checkAuth();

const user = getCurrentUser();
const resultId = localStorage.getItem('viewResultId');

if (!resultId) {
    alert('Result not found!');
    window.location.href = user.role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
}

const allResults = getResults();
const result = allResults.find(r => r.id === resultId);

if (!result) {
    alert('Result not found!');
    window.location.href = user.role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
}

const exam = getExamById(result.examId);
const percentage = result.percentage || ((result.score / (result.totalPoints || result.totalQuestions)) * 100).toFixed(0);

document.getElementById('examTitle').textContent = exam ? exam.title : 'Exam Result';
document.getElementById('correctCount').textContent = result.score || 0;
document.getElementById('incorrectCount').textContent = (result.totalPoints || result.totalQuestions) - (result.score || 0);
document.getElementById('totalCount').textContent = result.totalPoints || result.totalQuestions;

const scoreCircle = document.getElementById('scoreCircle');
scoreCircle.textContent = `${percentage}%`;

let scoreClass = 'score-excellent';
let message = '🎉 Excellent!';
let subtitle = 'Outstanding performance!';

if (percentage < 50) {
    scoreClass = 'score-poor';
    message = '📚 Keep Practicing';
    subtitle = 'Review the material and try again';
} else if (percentage < 75) {
    scoreClass = 'score-average';
    message = '👍 Good Effort';
    subtitle = 'You\'re on the right track!';
} else if (percentage < 90) {
    scoreClass = 'score-good';
    message = '✨ Great Job!';
    subtitle = 'Very good performance!';
}

if (result.passed !== undefined) {
    if (result.passed) {
        message = '✅ Passed!';
        subtitle = 'Congratulations! You passed the exam.';
    } else {
        message = '❌ Not Passed';
        subtitle = 'You did not meet the passing score.';
    }
}

scoreCircle.className = `score-circle ${scoreClass}`;
document.getElementById('resultMessage').textContent = message;
document.getElementById('resultSubtitle').textContent = subtitle;

function displayAnswers() {
    const container = document.getElementById('answersContainer');
    let html = '';
    
    result.answers.forEach((answer, index) => {
        const question = exam.questions.find(q => q.id === answer.questionId);
        if (!question) return;
        
        const questionType = question.type || 'multiple_choice';
        const isCorrect = answer.isCorrect !== undefined ? answer.isCorrect : 
                         (answer.earnedPoints > 0 || (answer.userAnswer && String(answer.userAnswer) === String(question.correctAnswer)));
        
        html += `
            <div class="card mb-2" style="border-left: 4px solid ${isCorrect ? 'var(--success-color)' : 'var(--danger-color)'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <h4 style="color: var(--primary-color);">Question ${index + 1} <span class="badge">${question.points || 1} points</span></h4>
                    <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">
                        ${isCorrect ? '✓ Correct' : '✗ Incorrect'} 
                        ${answer.earnedPoints !== undefined ? `(${answer.earnedPoints}/${question.points || 1})` : ''}
                    </span>
                </div>
                
                <p style="font-weight: 500; margin-bottom: 15px;">${answer.question}</p>
        `;
        
        if (questionType === 'multiple_choice' || questionType === 'multiple_select') {
            question.options.forEach((option, optIndex) => {
                let style = 'padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px;';
                let icon = '';
                
                const isCorrectAnswer = Array.isArray(question.correctAnswer) 
                    ? question.correctAnswer.includes(optIndex)
                    : optIndex === question.correctAnswer;
                
                const isUserAnswer = Array.isArray(answer.userAnswer)
                    ? answer.userAnswer.includes(optIndex)
                    : optIndex === answer.userAnswer;
                
                if (isCorrectAnswer) {
                    style = 'padding: 10px; margin-bottom: 8px; border: 2px solid var(--success-color); border-radius: 8px; background: rgba(16, 185, 129, 0.1);';
                    icon = ' ✓ Correct';
                } else if (isUserAnswer && !isCorrect) {
                    style = 'padding: 10px; margin-bottom: 8px; border: 2px solid var(--danger-color); border-radius: 8px; background: rgba(239, 68, 68, 0.1);';
                    icon = ' ✗ Your Answer (Incorrect)';
                }
                
                html += `
                    <div style="${style}">
                        <strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}${icon}
                    </div>
                `;
            });
            
            if (!isCorrect) {
                const correctAnswers = Array.isArray(question.correctAnswer) 
                    ? question.correctAnswer.map(i => String.fromCharCode(65 + i)).join(', ')
                    : String.fromCharCode(65 + question.correctAnswer);
                html += `
                    <div class="alert alert-info" style="margin-top: 10px;">
                        <strong>Correct Answer:</strong> ${correctAnswers}
                    </div>
                `;
            }
        } else if (questionType === 'true_false') {
            html += `
                <div style="padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px;">
                    <strong>Your Answer:</strong> ${answer.userAnswer || 'Not answered'}
                </div>
                <div class="alert alert-info" style="margin-top: 10px;">
                    <strong>Correct Answer:</strong> ${question.correctAnswer}
                </div>
            `;
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            html += `
                <div style="padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px;">
                    <strong>Your Answer:</strong> ${answer.userAnswer || 'Not answered'}
                </div>
                <div class="alert alert-info" style="margin-top: 10px;">
                    <strong>Correct Answer(s):</strong> ${question.correctAnswer}
                </div>
            `;
        } else if (questionType === 'essay') {
            html += `
                <div style="padding: 15px; margin-bottom: 8px; background: #f3f4f6; border-radius: 8px;">
                    <strong>Your Answer:</strong><br>
                    ${answer.userAnswer || 'No answer provided'}
                </div>
            `;
            if (answer.feedback) {
                html += `
                    <div class="alert alert-info" style="margin-top: 10px;">
                        <strong>Teacher Feedback:</strong><br>
                        ${answer.feedback}
                    </div>
                `;
            }
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function goBack() {
    window.location.href = user.role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
}

displayAnswers();
