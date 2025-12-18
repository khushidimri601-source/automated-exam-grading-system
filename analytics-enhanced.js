// Enhanced Analytics with Charts
// Note: This uses Chart.js - you'll need to include it in HTML

function loadEnhancedAnalytics() {
    const user = getCurrentUser();
    const exams = getExams().filter(e => e.teacherId === user.id);
    const allResults = getResults();
    const users = getUsers();
    
    const myExamIds = exams.map(e => e.id);
    const myResults = allResults.filter(r => myExamIds.includes(r.examId));
    
    displayScoreDistributionChart(myResults);
    displayPerformanceOverTimeChart(myResults);
    displayQuestionAnalysisChart(exams, myResults);
    displayStudentPerformanceChart(myResults, users);
}

function displayScoreDistributionChart(results) {
    const canvas = document.getElementById('scoreDistributionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const scores = results.map(r => (r.score / r.totalQuestions * 100));
    
    // Create bins
    const bins = [0, 20, 40, 60, 80, 100];
    const counts = new Array(bins.length - 1).fill(0);
    
    scores.forEach(score => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (score >= bins[i] && score < bins[i + 1]) {
                counts[i]++;
                break;
            }
        }
        if (score === 100) counts[counts.length - 1]++;
    });
    
    if (typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
                datasets: [{
                    label: 'Number of Students',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

function displayPerformanceOverTimeChart(results) {
    const canvas = document.getElementById('performanceOverTimeChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const sortedResults = results.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    
    const dates = [];
    const scores = [];
    
    sortedResults.forEach(result => {
        dates.push(new Date(result.completedAt).toLocaleDateString());
        scores.push((result.score / result.totalQuestions * 100));
    });
    
    if (typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Average Score (%)',
                    data: scores,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }
}

function displayQuestionAnalysisChart(exams, results) {
    const canvas = document.getElementById('questionAnalysisChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const questionStats = {};
    
    exams.forEach(exam => {
        exam.questions.forEach((q, index) => {
            const key = `${exam.id}-${q.id}`;
            questionStats[key] = {
                question: q.question.substring(0, 30) + '...',
                correct: 0,
                incorrect: 0
            };
            
            const examResults = results.filter(r => r.examId === exam.id);
            examResults.forEach(result => {
                const answer = result.answers.find(a => a.questionId === q.id);
                if (answer) {
                    if (answer.isCorrect) {
                        questionStats[key].correct++;
                    } else {
                        questionStats[key].incorrect++;
                    }
                }
            });
        });
    });
    
    const labels = Object.values(questionStats).map(s => s.question);
    const correctData = Object.values(questionStats).map(s => s.correct);
    const incorrectData = Object.values(questionStats).map(s => s.incorrect);
    
    if (typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Correct',
                    data: correctData,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)'
                }, {
                    label: 'Incorrect',
                    data: incorrectData,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }
}

function displayStudentPerformanceChart(results, users) {
    const canvas = document.getElementById('studentPerformanceChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const studentStats = {};
    
    results.forEach(result => {
        if (!studentStats[result.studentId]) {
            const student = users.find(u => u.id === result.studentId);
            studentStats[result.studentId] = {
                name: student ? student.name : 'Unknown',
                scores: []
            };
        }
        studentStats[result.studentId].scores.push((result.score / result.totalQuestions * 100));
    });
    
    const labels = Object.values(studentStats).map(s => s.name);
    const avgScores = Object.values(studentStats).map(s => {
        const sum = s.scores.reduce((a, b) => a + b, 0);
        return (sum / s.scores.length).toFixed(1);
    });
    
    if (typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Score (%)',
                    data: avgScores,
                    backgroundColor: 'rgba(139, 92, 246, 0.8)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }
}

