// Study Mode - Practice exams without grading

function startStudyMode(examId) {
    localStorage.setItem('studyModeExamId', examId);
    window.location.href = 'study-mode.html';
}

function loadStudyMode() {
    const examId = localStorage.getItem('studyModeExamId');
    if (!examId) {
        window.location.href = 'student-dashboard.html';
    }
    
    const exam = getExamById(examId);
    if (!exam) {
        alert('Exam not found!');
        window.location.href = 'student-dashboard.html';
    }
    
    document.getElementById('examTitle').textContent = exam.title + ' (Study Mode)';
    document.getElementById('examDescription').textContent = exam.description;
    
    displayStudyQuestions(exam);
}

function displayStudyQuestions(exam) {
    const container = document.getElementById('questionsContainer');
    let html = '<div class="alert alert-info mb-3">This is study mode. Answer the questions and click "Check Answers" to see the correct answers.</div>';
    
    exam.questions.forEach((q, index) => {
        const questionType = q.type || 'multiple_choice';
        html += `<div class="card mb-2" id="study-question-${index}">`;
        html += `<h4 style="color: var(--primary-color); margin-bottom: 15px;">Question ${index + 1}</h4>`;
        html += `<p style="margin-bottom: 15px; font-weight: 500;">${q.question}</p>`;
        
        if (questionType === 'multiple_choice' || !questionType) {
            q.options.forEach((option, optIndex) => {
                html += `
                    <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                        <input type="radio" name="question-${index}" value="${optIndex}" style="margin-right: 10px;">
                        <strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}
                        <span id="answer-indicator-${index}-${optIndex}" style="display: none; margin-left: 10px;"></span>
                    </label>
                `;
            });
        } else if (questionType === 'true_false') {
            html += `
                <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                    <input type="radio" name="question-${index}" value="true" style="margin-right: 10px;"> True
                    <span id="answer-indicator-${index}-true" style="display: none; margin-left: 10px;"></span>
                </label>
                <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                    <input type="radio" name="question-${index}" value="false" style="margin-right: 10px;"> False
                    <span id="answer-indicator-${index}-false" style="display: none; margin-left: 10px;"></span>
                </label>
            `;
        } else if (questionType === 'multiple_select') {
            q.options.forEach((option, optIndex) => {
                html += `
                    <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="question-${index}" value="${optIndex}" style="margin-right: 10px;">
                        <strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}
                        <span id="answer-indicator-${index}-${optIndex}" style="display: none; margin-left: 10px;"></span>
                    </label>
                `;
            });
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            html += `
                <input type="text" name="question-${index}" class="form-control" placeholder="Enter your answer">
                <div id="answer-indicator-${index}" style="margin-top: 10px; display: none;"></div>
            `;
        } else if (questionType === 'essay') {
            html += `
                <textarea name="question-${index}" class="form-control" rows="5" placeholder="Enter your answer"></textarea>
                <div id="answer-indicator-${index}" style="margin-top: 10px; display: none;"></div>
            `;
        }
        
        html += `<div id="explanation-${index}" style="margin-top: 10px; padding: 10px; background: #f3f4f6; border-radius: 8px; display: none;"></div>`;
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function checkStudyAnswers() {
    const examId = localStorage.getItem('studyModeExamId');
    const exam = getExamById(examId);
    const form = document.getElementById('studyForm');
    const formData = new FormData(form);
    
    exam.questions.forEach((q, index) => {
        const questionType = q.type || 'multiple_choice';
        let userAnswer = null;
        let isCorrect = false;
        
        if (questionType === 'multiple_choice' || questionType === 'true_false') {
            userAnswer = formData.get(`question-${index}`);
            isCorrect = String(userAnswer) === String(q.correctAnswer);
            
            // Show indicators for all options
            if (questionType === 'multiple_choice') {
                q.options.forEach((option, optIndex) => {
                    const indicator = document.getElementById(`answer-indicator-${index}-${optIndex}`);
                    if (indicator) {
                        indicator.style.display = 'inline';
                        if (optIndex === q.correctAnswer) {
                            indicator.innerHTML = ' ✅ <strong style="color: var(--success-color);">Correct Answer</strong>';
                            // Highlight correct answer
                            const label = indicator.closest('label');
                            if (label) {
                                label.style.borderColor = 'var(--success-color)';
                                label.style.background = 'rgba(16, 185, 129, 0.1)';
                            }
                        } else if (optIndex === parseInt(userAnswer)) {
                            indicator.innerHTML = ' ❌ <strong style="color: var(--danger-color);">Your Answer (Incorrect)</strong>';
                            const label = indicator.closest('label');
                            if (label) {
                                label.style.borderColor = 'var(--danger-color)';
                                label.style.background = 'rgba(239, 68, 68, 0.1)';
                            }
                        }
                    }
                });
            } else if (questionType === 'true_false') {
                // Show indicator for True
                const trueIndicator = document.getElementById(`answer-indicator-${index}-true`);
                if (trueIndicator) {
                    trueIndicator.style.display = 'inline';
                    if (q.correctAnswer === 'true') {
                        trueIndicator.innerHTML = ' ✅ <strong style="color: var(--success-color);">Correct Answer</strong>';
                        const label = trueIndicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--success-color)';
                            label.style.background = 'rgba(16, 185, 129, 0.1)';
                        }
                    } else if (userAnswer === 'true') {
                        trueIndicator.innerHTML = ' ❌ <strong style="color: var(--danger-color);">Your Answer (Incorrect)</strong>';
                        const label = trueIndicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--danger-color)';
                            label.style.background = 'rgba(239, 68, 68, 0.1)';
                        }
                    }
                }
                
                // Show indicator for False
                const falseIndicator = document.getElementById(`answer-indicator-${index}-false`);
                if (falseIndicator) {
                    falseIndicator.style.display = 'inline';
                    if (q.correctAnswer === 'false') {
                        falseIndicator.innerHTML = ' ✅ <strong style="color: var(--success-color);">Correct Answer</strong>';
                        const label = falseIndicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--success-color)';
                            label.style.background = 'rgba(16, 185, 129, 0.1)';
                        }
                    } else if (userAnswer === 'false') {
                        falseIndicator.innerHTML = ' ❌ <strong style="color: var(--danger-color);">Your Answer (Incorrect)</strong>';
                        const label = falseIndicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--danger-color)';
                            label.style.background = 'rgba(239, 68, 68, 0.1)';
                        }
                    }
                }
            }
        } else if (questionType === 'multiple_select') {
            const userAnswers = formData.getAll(`question-${index}`).map(a => parseInt(a)).sort();
            const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer.sort() : [q.correctAnswer];
            isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
            
            q.options.forEach((option, optIndex) => {
                const indicator = document.getElementById(`answer-indicator-${index}-${optIndex}`);
                if (indicator) {
                    indicator.style.display = 'inline';
                    const isCorrectAnswer = correctAnswers.includes(optIndex);
                    const isUserAnswer = userAnswers.includes(optIndex);
                    
                    if (isCorrectAnswer) {
                        indicator.innerHTML = ' ✅ <strong style="color: var(--success-color);">Correct Answer</strong>';
                        const label = indicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--success-color)';
                            label.style.background = 'rgba(16, 185, 129, 0.1)';
                        }
                    } else if (isUserAnswer) {
                        indicator.innerHTML = ' ❌ <strong style="color: var(--danger-color);">Your Answer (Incorrect)</strong>';
                        const label = indicator.closest('label');
                        if (label) {
                            label.style.borderColor = 'var(--danger-color)';
                            label.style.background = 'rgba(239, 68, 68, 0.1)';
                        }
                    }
                }
            });
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            userAnswer = formData.get(`question-${index}`)?.trim().toLowerCase() || '';
            const correctAnswers = q.correctAnswer.split(';').map(a => a.trim().toLowerCase());
            isCorrect = correctAnswers.includes(userAnswer);
            
            const indicator = document.getElementById(`answer-indicator-${index}`);
            if (indicator) {
                indicator.style.display = 'block';
                indicator.innerHTML = `
                    <div style="padding: 10px; background: ${isCorrect ? '#d1fae5' : '#fee2e2'}; border-radius: 8px;">
                        <strong>Your Answer:</strong> ${formData.get(`question-${index}`) || 'Not answered'}<br>
                        <strong>Correct Answer(s):</strong> ${q.correctAnswer}
                        ${isCorrect ? ' ✅' : ' ❌'}
                    </div>
                `;
            }
        } else if (questionType === 'essay') {
            userAnswer = formData.get(`question-${index}`);
            const indicator = document.getElementById(`answer-indicator-${index}`);
            if (indicator) {
                indicator.style.display = 'block';
                indicator.innerHTML = `
                    <div style="padding: 10px; background: #dbeafe; border-radius: 8px;">
                        <strong>Your Answer:</strong><br>
                        ${userAnswer || 'No answer provided'}
                    </div>
                `;
            }
        }
        
        // Show explanation
        const explanationDiv = document.getElementById(`explanation-${index}`);
        if (explanationDiv) {
            explanationDiv.style.display = 'block';
            explanationDiv.style.background = isCorrect ? '#d1fae5' : '#fee2e2';
            explanationDiv.innerHTML = isCorrect 
                ? '<strong style="color: var(--success-color);">✓ Correct!</strong>' 
                : `<strong style="color: var(--danger-color);">✗ Incorrect.</strong>`;
        }
    });
    
    showAlert('Answers checked! Review your results below.', 'success');
}

function saveStudyAttempt() {
    const examId = localStorage.getItem('studyModeExamId');
    const form = document.getElementById('studyForm');
    const formData = new FormData(form);
    
    const user = getCurrentUser();
    const exam = getExamById(examId);
    
    let score = 0;
    const answers = [];
    
    exam.questions.forEach((q, index) => {
        const questionType = q.type || 'multiple_choice';
        let userAnswer = null;
        let isCorrect = false;
        
        if (questionType === 'multiple_choice' || questionType === 'true_false') {
            userAnswer = formData.get(`question-${index}`);
            isCorrect = String(userAnswer) === String(q.correctAnswer);
        } else if (questionType === 'multiple_select') {
            userAnswer = formData.getAll(`question-${index}`).map(a => parseInt(a)).sort();
            const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer.sort() : [q.correctAnswer];
            isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswers);
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            userAnswer = formData.get(`question-${index}`)?.trim().toLowerCase() || '';
            const correctAnswers = q.correctAnswer.split(';').map(a => a.trim().toLowerCase());
            isCorrect = correctAnswers.includes(userAnswer);
        } else if (questionType === 'essay') {
            userAnswer = formData.get(`question-${index}`);
            isCorrect = false; // Essays need manual grading
        }
        
        if (isCorrect) score++;
        
        answers.push({
            questionId: q.id,
            userAnswer: userAnswer,
            correctAnswer: q.correctAnswer,
            isCorrect: isCorrect
        });
    });
    
    const attempt = {
        id: Date.now().toString(),
        examId: examId,
        studentId: user.id,
        score: score,
        totalQuestions: exam.questions.length,
        answers: answers,
        completedAt: new Date().toISOString(),
        mode: 'study'
    };
    
    const attempts = getStudyAttempts();
    attempts.push(attempt);
    saveStudyAttempts(attempts);
    
    showAlert('Study attempt saved!', 'success');
}
