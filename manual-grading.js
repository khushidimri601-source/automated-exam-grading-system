// Manual Grading for Essay Questions with NLP Support

// Store AI suggestions for comparison when saving
let aiSuggestions = {};

function loadManualGrading() {
    const results = getResults();
    const exams = getExams();
    const users = getUsers();
    
    // Filter results that need manual grading (essay questions)
    const needsGrading = results.filter(result => {
        const exam = exams.find(e => e.id === result.examId);
        if (!exam) return false;
        return exam.questions.some(q => q.type === 'essay' || q.type === 'short_answer');
    });
    
    displayGradingQueue(needsGrading, exams, users);
}

function displayGradingQueue(results, exams, users) {
    const container = document.getElementById('gradingQueue');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No exams need manual grading.</p>';
        return;
    }
    
    let html = '<table class="table"><thead><tr><th>Student</th><th>Exam</th><th>Essay Questions</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    
    results.forEach(result => {
        const student = users.find(u => u.id === result.studentId);
        const exam = exams.find(e => e.id === result.examId);
        const essayAnswers = result.answers.filter(a => {
            const question = exam.questions.find(q => q.id === a.questionId);
            return question && (question.type === 'essay' || question.type === 'short_answer');
        });
        
        const status = result.manuallyGraded ? 
            '<span class="badge badge-success">Graded</span>' : 
            '<span class="badge badge-warning">Pending</span>';
        
        html += `
            <tr>
                <td>${student ? student.name : 'Unknown'}</td>
                <td>${exam ? exam.title : 'Unknown'}</td>
                <td>${essayAnswers.length}</td>
                <td>${status}</td>
                <td><button class="btn btn-primary" onclick="gradeExam('${result.id}')">Grade</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function gradeExam(resultId) {
    localStorage.setItem('gradingResultId', resultId);
    window.location.href = 'manual-grading.html';
}

function loadGradingInterface() {
    const resultId = localStorage.getItem('gradingResultId');
    if (!resultId) {
        window.location.href = 'teacher-dashboard.html';
        return;
    }
    
    const results = getResults();
    const result = results.find(r => r.id === resultId);
    if (!result) {
        alert('Result not found!');
        window.location.href = 'teacher-dashboard.html';
        return;
    }
    
    const exam = getExamById(result.examId);
    const users = getUsers();
    const student = users.find(u => u.id === result.studentId);
    
    document.getElementById('studentName').textContent = student ? student.name : 'Unknown';
    document.getElementById('examTitle').textContent = exam ? exam.title : 'Unknown';
    
    displayEssayQuestions(result, exam);
}

function displayEssayQuestions(result, exam) {
    const container = document.getElementById('essayQuestions');
    let html = '';
    let questionNum = 0;
    
    result.answers.forEach((answer, index) => {
        const question = exam.questions.find(q => q.id === answer.questionId);
        if (question && (question.type === 'essay' || question.type === 'short_answer')) {
            questionNum++;
            const maxPoints = question.points || 1;
            
            html += `
                <div class="card mb-3" id="question-card-${question.id}">
                    <h4>Question ${questionNum}</h4>
                    <p><strong>Question:</strong> ${question.question}</p>
                    <p><strong>Points:</strong> ${maxPoints}</p>
                    ${question.correctAnswer ? `
                        <details style="margin-bottom: 15px;">
                            <summary style="cursor: pointer; color: var(--primary-color);">📖 View Reference Answer</summary>
                            <div style="padding: 10px; background: #e8f5e9; border-radius: 8px; margin-top: 10px;">
                                ${question.correctAnswer}
                            </div>
                        </details>
                    ` : ''}
                    
                    <div class="form-group">
                        <label>Student Answer:</label>
                        <div style="padding: 15px; background: #f3f4f6; border-radius: 8px; margin-bottom: 15px;">
                            ${answer.userAnswer || '<em style="color: var(--gray);">No answer provided</em>'}
                        </div>
                    </div>
                    
                    <!-- AI Grading Controls -->
                    <div class="form-group" style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                            <button type="button" class="btn btn-secondary" 
                                    onclick="suggestScore('${question.id}', '${result.id}')">
                                🤖 AI Grade
                            </button>
                            <button type="button" class="btn btn-outline" 
                                    onclick="checkPlagiarism('${question.id}', '${result.id}')">
                                🔍 Check Plagiarism
                            </button>
                            <button type="button" class="btn btn-outline" 
                                    onclick="analyzeText('${question.id}')">
                                📊 Analyze Text
                            </button>
                        </div>
                        <div id="ai-hint-${question.id}" style="margin-top: 10px; color: var(--gray); font-size: 14px;"></div>
                    </div>
                    
                    <!-- Analysis Results (hidden by default) -->
                    <div id="analysis-${question.id}" style="display: none; margin-bottom: 15px;"></div>
                    
                    <div class="form-group">
                        <label>Score (0 - ${maxPoints}):</label>
                        <input type="number" class="form-control essay-score" data-question-id="${question.id}" 
                               min="0" max="${maxPoints}" step="0.5" value="${answer.earnedPoints || 0}">
                    </div>
                    
                    <div class="form-group">
                        <label>Feedback:</label>
                        <textarea class="form-control essay-feedback" data-question-id="${question.id}" rows="4" 
                                  placeholder="Provide feedback to the student">${answer.feedback || ''}</textarea>
                    </div>
                </div>
            `;
        }
    });
    
    if (!html) {
        html = '<p style="color: var(--gray); text-align: center; padding: 20px;">No essay questions to grade.</p>';
    }
    
    container.innerHTML = html;
}

async function suggestScore(questionId, resultId) {
    const hintEl = document.getElementById(`ai-hint-${questionId}`);
    
    try {
        const results = getResults();
        const result = results.find(r => r.id === resultId);
        if (!result) return;
        
        const exam = getExamById(result.examId);
        const question = exam.questions.find(q => q.id === questionId);
        if (!question) return;
        
        const answer = result.answers.find(a => a.questionId === questionId);

        if (hintEl) {
            hintEl.innerHTML = '<span style="color: var(--primary-color);">🔄 Analyzing answer with AI...</span>';
        }

        // Prepare reference answers (split by ; for multiple)
        const refAnswers = [];
        if (typeof question.correctAnswer === 'string' && question.correctAnswer.trim()) {
            question.correctAnswer.split(';').forEach(p => {
                const t = p.trim();
                if (t) refAnswers.push(t);
            });
        }

        // Get other student answers for plagiarism check
        const allResults = getResults();
        const otherAnswers = allResults
            .filter(r => r.examId === result.examId && r.id !== result.id)
            .map(r => {
                const ans = r.answers.find(a => a.questionId === questionId);
                return ans ? ans.userAnswer : null;
            })
            .filter(a => a);

        // Extract mandatory terms from reference (simple heuristic: capitalized words, technical terms)
        const mandatoryTerms = extractKeyTerms(refAnswers.join(' '));

        const resp = await fetch('/api/grade-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentAnswer: answer ? (answer.userAnswer || '') : '',
                referenceAnswers: refAnswers,
                maxPoints: question.points || 1,
                mandatoryTerms: mandatoryTerms,
                otherAnswers: otherAnswers,
                minWords: 10,
                maxWords: 1000
            })
        });

        const data = await resp.json();
        
        if (!data.success) {
            if (hintEl) {
                hintEl.innerHTML = `<span style="color: var(--danger-color);">❌ ${data.message || 'AI suggestion failed.'}</span>`;
            }
            return;
        }

        // Store AI suggestion for later comparison
        aiSuggestions[questionId] = {
            score: data.score,
            similarity: data.similarity,
            feedback: data.feedback
        };

        // Update form fields
        const scoreInput = document.querySelector(`.essay-score[data-question-id="${questionId}"]`);
        const feedbackInput = document.querySelector(`.essay-feedback[data-question-id="${questionId}"]`);
        
        if (scoreInput) {
            scoreInput.value = data.score;
        }
        if (feedbackInput && (!feedbackInput.value || feedbackInput.value.trim().length === 0)) {
            feedbackInput.value = data.feedback;
        }
        
        if (hintEl) {
            const simPercent = Math.round(data.similarity * 100);
            hintEl.innerHTML = `
                <div style="color: var(--success-color);">
                    ✅ AI suggested <strong>${data.score}/${question.points || 1}</strong> points 
                    (${simPercent}% semantic match)
                </div>
                <small style="color: var(--gray);">You can adjust the score and feedback before saving.</small>
            `;
        }
    } catch (err) {
        console.error('AI grading error:', err);
        if (hintEl) {
            hintEl.innerHTML = `<span style="color: var(--danger-color);">❌ Error: ${err.message}</span>`;
        }
    }
}

async function checkPlagiarism(questionId, resultId) {
    const hintEl = document.getElementById(`ai-hint-${questionId}`);
    
    try {
        const results = getResults();
        const result = results.find(r => r.id === resultId);
        if (!result) return;
        
        const exam = getExamById(result.examId);
        const answer = result.answers.find(a => a.questionId === questionId);
        
        if (!answer || !answer.userAnswer) {
            if (hintEl) hintEl.innerHTML = '<span style="color: var(--gray);">No answer to check.</span>';
            return;
        }

        if (hintEl) {
            hintEl.innerHTML = '<span style="color: var(--primary-color);">🔄 Checking for plagiarism...</span>';
        }

        // Get all other answers for this question
        const allResults = getResults();
        const otherAnswers = allResults
            .filter(r => r.examId === result.examId && r.id !== result.id)
            .map(r => {
                const ans = r.answers.find(a => a.questionId === questionId);
                return ans ? ans.userAnswer : null;
            })
            .filter(a => a && a.trim());

        if (otherAnswers.length === 0) {
            if (hintEl) hintEl.innerHTML = '<span style="color: var(--gray);">No other submissions to compare against.</span>';
            return;
        }

        const resp = await fetch('/api/check-plagiarism', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentAnswer: answer.userAnswer,
                otherAnswers: otherAnswers,
                threshold: 0.90
            })
        });

        const data = await resp.json();
        
        if (!data.success) {
            if (hintEl) hintEl.innerHTML = `<span style="color: var(--danger-color);">❌ ${data.message}</span>`;
            return;
        }

        if (data.is_plagiarized) {
            if (hintEl) {
                hintEl.innerHTML = `
                    <div style="color: var(--danger-color); padding: 10px; background: #fee2e2; border-radius: 8px;">
                        🚨 <strong>Potential plagiarism detected!</strong><br>
                        Maximum similarity: ${Math.round(data.max_similarity * 100)}%<br>
                        Similar to ${data.similar_indices.length} other submission(s).
                    </div>
                `;
            }
        } else {
            if (hintEl) {
                hintEl.innerHTML = `
                    <div style="color: var(--success-color);">
                        ✅ No plagiarism detected (max similarity: ${Math.round(data.max_similarity * 100)}%)
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error('Plagiarism check error:', err);
        if (hintEl) hintEl.innerHTML = `<span style="color: var(--danger-color);">❌ Error: ${err.message}</span>`;
    }
}

async function analyzeText(questionId) {
    const resultId = localStorage.getItem('gradingResultId');
    const results = getResults();
    const result = results.find(r => r.id === resultId);
    if (!result) return;
    
    const answer = result.answers.find(a => a.questionId === questionId);
    const analysisEl = document.getElementById(`analysis-${questionId}`);
    
    if (!answer || !answer.userAnswer) {
        if (analysisEl) {
            analysisEl.style.display = 'block';
            analysisEl.innerHTML = '<p style="color: var(--gray);">No answer to analyze.</p>';
        }
        return;
    }

    try {
        const exam = getExamById(result.examId);
        const question = exam.questions.find(q => q.id === questionId);
        const mandatoryTerms = question && question.correctAnswer ? 
            extractKeyTerms(question.correctAnswer) : [];

        const resp = await fetch('/api/analyze-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: answer.userAnswer,
                mandatoryTerms: mandatoryTerms,
                minWords: 10,
                maxWords: 1000
            })
        });

        const data = await resp.json();
        
        if (!data.success) {
            if (analysisEl) {
                analysisEl.style.display = 'block';
                analysisEl.innerHTML = `<p style="color: var(--danger-color);">Error: ${data.message}</p>`;
            }
            return;
        }

        let html = '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">';
        html += '<h5 style="margin-bottom: 10px;">📊 Text Analysis</h5>';
        
        // Grammar analysis
        const g = data.grammar;
        html += `<p><strong>Word count:</strong> ${g.word_count} | <strong>Sentences:</strong> ${g.sentence_count} | <strong>Avg sentence length:</strong> ${g.avg_sentence_length} words</p>`;
        
        if (g.issues && g.issues.length > 0) {
            html += '<div style="color: var(--danger-color); margin: 10px 0;">';
            g.issues.forEach(issue => {
                html += `<p>⚠️ ${issue}</p>`;
            });
            html += '</div>';
        }
        
        if (g.warnings && g.warnings.length > 0) {
            html += '<div style="color: var(--warning-color); margin: 10px 0;">';
            g.warnings.forEach(warning => {
                html += `<p>💡 ${warning}</p>`;
            });
            html += '</div>';
        }
        
        // Term coverage
        if (data.terms) {
            const t = data.terms;
            const coverage = Math.round(t.coverage * 100);
            html += `<p><strong>Key term coverage:</strong> ${coverage}%</p>`;
            
            if (t.found_terms && t.found_terms.length > 0) {
                html += `<p style="color: var(--success-color);">✓ Found: ${t.found_terms.join(', ')}</p>`;
            }
            if (t.missing_terms && t.missing_terms.length > 0) {
                html += `<p style="color: var(--danger-color);">✗ Missing: ${t.missing_terms.join(', ')}</p>`;
            }
        }
        
        html += '</div>';
        
        if (analysisEl) {
            analysisEl.style.display = 'block';
            analysisEl.innerHTML = html;
        }
    } catch (err) {
        console.error('Text analysis error:', err);
        if (analysisEl) {
            analysisEl.style.display = 'block';
            analysisEl.innerHTML = `<p style="color: var(--danger-color);">Error: ${err.message}</p>`;
        }
    }
}

function extractKeyTerms(text) {
    /**
     * Extract potential key terms from reference answer.
     * Simple heuristic: words that are capitalized, longer than 5 chars, or technical-looking.
     */
    if (!text) return [];
    
    const words = text.split(/\s+/);
    const terms = new Set();
    
    words.forEach(word => {
        // Clean the word
        const clean = word.replace(/[^\w]/g, '');
        if (clean.length < 4) return;
        
        // Add if capitalized (proper noun/technical term)
        if (clean[0] === clean[0].toUpperCase() && clean.length > 3) {
            terms.add(clean.toLowerCase());
        }
        // Add longer words that might be important
        if (clean.length > 7) {
            terms.add(clean.toLowerCase());
        }
    });
    
    return Array.from(terms).slice(0, 10); // Limit to 10 terms
}

async function saveGrading() {
    const resultId = localStorage.getItem('gradingResultId');
    const results = getResults();
    const result = results.find(r => r.id === resultId);
    const exam = getExamById(result.examId);
    
    let totalScore = 0;
    
    // Calculate score from non-essay questions first
    result.answers.forEach(answer => {
        const question = exam.questions.find(q => q.id === answer.questionId);
        if (question && question.type !== 'essay' && question.type !== 'short_answer') {
            totalScore += answer.earnedPoints || 0;
        }
    });
    
    // Now add essay scores and save examples for fine-tuning
    for (const answer of result.answers) {
        const question = exam.questions.find(q => q.id === answer.questionId);
        if (question && (question.type === 'essay' || question.type === 'short_answer')) {
            const scoreInput = document.querySelector(`.essay-score[data-question-id="${question.id}"]`);
            const feedbackInput = document.querySelector(`.essay-feedback[data-question-id="${question.id}"]`);
            
            const newScore = parseFloat(scoreInput.value) || 0;
            totalScore += newScore;
            
            answer.earnedPoints = newScore;
            answer.feedback = feedbackInput.value;
            answer.isCorrect = newScore > 0;
            
            // Save example for fine-tuning if AI suggestion was used and teacher adjusted
            const aiSugg = aiSuggestions[question.id];
            if (aiSugg && Math.abs(aiSugg.score - newScore) > 0.1) {
                try {
                    await fetch('/api/save-grading-example', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            question: question.question,
                            studentAnswer: answer.userAnswer || '',
                            referenceAnswers: question.correctAnswer ? question.correctAnswer.split(';') : [],
                            aiScore: aiSugg.score,
                            teacherScore: newScore,
                            teacherFeedback: feedbackInput.value
                        })
                    });
                } catch (e) {
                    console.log('Could not save training example:', e);
                }
            }
        }
    }
    
    result.score = totalScore;
    result.percentage = (totalScore / result.totalPoints) * 100;
    result.gradedAt = new Date().toISOString();
    result.manuallyGraded = true;
    
    saveResults(results);
    
    showAlert('Grading saved successfully!', 'success');
    setTimeout(() => {
        window.location.href = 'teacher-dashboard.html';
    }, 1500);
}
