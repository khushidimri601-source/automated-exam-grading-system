checkAuth('student');

const examId = localStorage.getItem('currentExamId');
if (!examId) {
    window.location.href = 'student-dashboard.html';
}

const exam = getExamById(examId);
if (!exam) {
    alert('Exam not found!');
    window.location.href = 'student-dashboard.html';
}

// Check exam scheduling
const settings = exam.settings || {};
if (settings.startDate || settings.endDate) {
    const now = new Date();
    if (settings.startDate) {
        const startDate = new Date(settings.startDate + (settings.startTime ? 'T' + settings.startTime : ''));
        if (now < startDate) {
            alert('This exam is not available yet. It will be available on ' + startDate.toLocaleString());
            window.location.href = 'student-dashboard.html';
        }
    }
    if (settings.endDate) {
        const endDate = new Date(settings.endDate + (settings.endTime ? 'T' + settings.endTime : ''));
        if (now > endDate) {
            alert('This exam is no longer available. The deadline was ' + endDate.toLocaleString());
            window.location.href = 'student-dashboard.html';
        }
    }
}

const user = getCurrentUser();
const results = getResultsByStudent(user.id);
const existingResult = results.find(r => r.examId === examId);

if (existingResult && !settings.allowRetakes) {
    alert('You have already attempted this exam!');
    window.location.href = 'student-dashboard.html';
}

document.getElementById('examTitle').textContent = exam.title;
document.getElementById('examDescription').textContent = exam.description;

let timeLeft = exam.duration * 60;
const timerDisplay = document.getElementById('timerDisplay');
let questions = [...exam.questions];

// Shuffle questions if enabled
if (settings.shuffleQuestions) {
    questions = questions.sort(() => Math.random() - 0.5);
}

// Shuffle options if enabled
if (settings.shuffleOptions) {
    questions.forEach(q => {
        if (q.options && q.options.length > 0) {
            const shuffled = q.options.map((opt, idx) => ({ opt, idx })).sort(() => Math.random() - 0.5);
            q.shuffledOptions = shuffled.map(s => s.opt);
            q.shuffledIndices = shuffled.map(s => s.idx);
        }
    });
}

// Security: Prevent tab switching
let tabSwitchCount = 0;
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        tabSwitchCount++;
        if (tabSwitchCount > 2) {
            alert('Warning: Multiple tab switches detected. This may result in exam termination.');
        }
    }
});

// Security: Prevent copy/paste
document.addEventListener('copy', function(e) {
    e.preventDefault();
    alert('Copying is disabled during the exam.');
});

document.addEventListener('paste', function(e) {
    e.preventDefault();
    alert('Pasting is disabled during the exam.');
});

function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `⏱️ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
        alert('Time is up! Your exam will be submitted automatically.');
        submitExam();
        return;
    }
    
    timeLeft--;
}

const timerInterval = setInterval(updateTimer, 1000);
updateTimer();

function displayQuestions() {
    const container = document.getElementById('questionsContainer');
    let html = '<div style="margin-bottom: 20px;"><strong>Progress: </strong><span id="progressIndicator">0/' + questions.length + '</span></div>';
    
    questions.forEach((q, index) => {
        const questionType = q.type || 'multiple_choice';
        html += `<div class="card mb-2" id="q-${index}">`;
        html += `<h4 style="color: var(--primary-color); margin-bottom: 15px;">Question ${index + 1} <span class="badge">${q.points || 1} points</span></h4>`;
        html += `<p style="margin-bottom: 15px; font-weight: 500;">${q.question}</p>`;
        
        if (questionType === 'multiple_choice') {
            const options = settings.shuffleOptions && q.shuffledOptions ? q.shuffledOptions : q.options;
            options.forEach((option, optIndex) => {
                const originalIndex = settings.shuffleOptions && q.shuffledIndices ? q.shuffledIndices[optIndex] : optIndex;
                html += `
                    <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="question-${index}" value="${originalIndex}" required style="margin-right: 10px;" onchange="updateProgress()">
                        <strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}
                    </label>
                `;
            });
        } else if (questionType === 'true_false') {
            html += `
                <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                    <input type="radio" name="question-${index}" value="true" required style="margin-right: 10px;" onchange="updateProgress()"> True
                </label>
                <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                    <input type="radio" name="question-${index}" value="false" required style="margin-right: 10px;" onchange="updateProgress()"> False
                </label>
            `;
        } else if (questionType === 'multiple_select') {
            const options = settings.shuffleOptions && q.shuffledOptions ? q.shuffledOptions : q.options;
            options.forEach((option, optIndex) => {
                const originalIndex = settings.shuffleOptions && q.shuffledIndices ? q.shuffledIndices[optIndex] : optIndex;
                html += `
                    <label style="display: block; padding: 10px; margin-bottom: 8px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="question-${index}" value="${originalIndex}" style="margin-right: 10px;" onchange="updateProgress()">
                        <strong>${String.fromCharCode(65 + optIndex)}.</strong> ${option}
                    </label>
                `;
            });
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            html += `
                <input type="text" name="question-${index}" class="form-control" placeholder="Enter your answer" required onchange="updateProgress()">
            `;
        } else if (questionType === 'essay') {
            html += `
                <textarea name="question-${index}" class="form-control" rows="5" placeholder="Enter your answer" required onchange="updateProgress()"></textarea>
            `;
        }
        
        html += `</div>`;
    });
    
    html += '<div style="position: fixed; bottom: 20px; right: 20px; background: white; padding: 15px; border-radius: 10px; box-shadow: var(--card-shadow);">';
    html += '<div><strong>Navigation:</strong></div>';
    questions.forEach((q, index) => {
        html += `<button type="button" class="btn btn-outline" style="padding: 5px 10px; margin: 5px; font-size: 12px;" onclick="scrollToQuestion(${index})">Q${index + 1}</button>`;
    });
    html += '</div>';
    
    container.innerHTML = html;
    updateProgress();
}

function scrollToQuestion(index) {
    document.getElementById(`q-${index}`).scrollIntoView({ behavior: 'smooth' });
}

function updateProgress() {
    const form = document.getElementById('examForm');
    const formData = new FormData(form);
    let answered = 0;
    
    questions.forEach((q, index) => {
        if (q.type === 'multiple_select') {
            const answers = formData.getAll(`question-${index}`);
            if (answers.length > 0) answered++;
        } else {
            const answer = formData.get(`question-${index}`);
            if (answer) answered++;
        }
    });
    
    document.getElementById('progressIndicator').textContent = `${answered}/${questions.length}`;
}

function submitExam() {
    clearInterval(timerInterval);
    
    const form = document.getElementById('examForm');
    const formData = new FormData(form);
    
    let totalScore = 0;
    let totalPoints = 0;
    const answers = [];
    
    questions.forEach((q, index) => {
        const questionType = q.type || 'multiple_choice';
        const points = q.points || 1;
        totalPoints += points;
        
        let userAnswer = null;
        let isCorrect = false;
        let earnedPoints = 0;
        
        if (questionType === 'multiple_choice' || questionType === 'true_false') {
            userAnswer = formData.get(`question-${index}`);
            isCorrect = String(userAnswer) === String(q.correctAnswer);
            earnedPoints = isCorrect ? points : (settings.negativeMarking ? -(settings.negativeMarkValue || 0.25) * points : 0);
        } else if (questionType === 'multiple_select') {
            const userAnswers = formData.getAll(`question-${index}`).map(a => parseInt(a)).sort();
            const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer.sort() : [q.correctAnswer];
            userAnswer = userAnswers;
            isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
            earnedPoints = isCorrect ? points : (settings.negativeMarking ? -(settings.negativeMarkValue || 0.25) * points : 0);
        } else if (questionType === 'short_answer' || questionType === 'fill_blank') {
            userAnswer = formData.get(`question-${index}`).trim().toLowerCase();
            if (!q.correctAnswer) {
                // If no correct answer was configured (e.g., teacher plans to import later), do not crash.
                isCorrect = false;
                earnedPoints = 0;
            } else {
                const correctAnswers = String(q.correctAnswer).split(';').map(a => a.trim().toLowerCase()).filter(Boolean);
                isCorrect = correctAnswers.includes(userAnswer);
                earnedPoints = isCorrect ? points : 0;
            }
        } else if (questionType === 'essay') {
            userAnswer = formData.get(`question-${index}`);
            isCorrect = false; // Needs manual grading
            earnedPoints = 0; // Will be graded manually
        }
        
        totalScore += earnedPoints;
        
        answers.push({
            questionId: q.id,
            question: q.question,
            type: questionType,
            userAnswer: userAnswer,
            correctAnswer: q.correctAnswer,
            isCorrect: isCorrect,
            points: points,
            earnedPoints: earnedPoints
        });
    });
    
    const percentage = (totalScore / totalPoints) * 100;
    const passed = percentage >= (settings.passingScore || 0);
    
    const result = {
        id: Date.now().toString(),
        examId: exam.id,
        studentId: user.id,
        score: totalScore,
        totalPoints: totalPoints,
        totalQuestions: questions.length,
        percentage: percentage,
        passed: passed,
        answers: answers,
        completedAt: new Date().toISOString(),
        timeSpent: (exam.duration * 60) - timeLeft
    };
    
    addResult(result);
    
    // Show notification
    if (settings.showResultsImmediately !== false) {
        localStorage.setItem('viewResultId', result.id);
        window.location.href = 'result.html';
    } else {
        alert('Your exam has been submitted. Results will be available after the exam deadline.');
        window.location.href = 'student-dashboard.html';
    }
}

document.getElementById('examForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to submit your exam? You cannot change your answers after submission.')) {
        submitExam();
    }
});

function confirmCancel() {
    if (confirm('Are you sure you want to cancel? Your progress will not be saved.')) {
        clearInterval(timerInterval);
        window.location.href = 'student-dashboard.html';
    }
}

displayQuestions();
