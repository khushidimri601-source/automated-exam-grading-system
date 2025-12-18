checkAuth('teacher');

let selectedQuestions = [];
// Start with formatting off; user can enable via checkbox
let applyFormatting = false;
let currentEditId = null;
const mode = new URLSearchParams(window.location.search).get('mode');

function loadQuestionBank() {
    const bank = getQuestionBank();
    const container = document.getElementById('questionBankContainer');
    
    if (bank.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No questions in bank yet. Create exams and save questions to build your bank!</p>';
        return;
    }
    
    displayQuestions(bank);
    populateCategories(bank);
}

// Domain words we try to separate when glued together
const COMMON_WORDS = [
    'physically','acceptable','wave','function','wavefunction','requirements','probability',
    'between','ground','excited','states','group','phase','velocity','velocities','electron',
    'energy','kinetic','broglie','wavelength','describe','significance','particle','trapped',
    'power','powerset','set','sets','element','elements','empty','nonempty','show','that','has',
    'and','or','for','let','be','with','proof','the','this','from','into','find','given',
    'check','whether','injective','surjective','bijective','composition','compositions',
    'define','definition','theorem','prove','proof','example','solution','answer',
    'equation','equations','formula','value','values','calculate','compute','determine'
];

function doFormatText(text) {
    // Core formatting logic - always runs when called
    if (!text) return '';
    let out = String(text);

    // 1. Add spaces at common boundaries
    out = out
        .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ABCDef -> ABC Def
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')       // letter-number
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')       // number-letter
        .replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ');// punctuation followed by letter

    // 2. Insert spaces around known domain words when glued to other letters
    COMMON_WORDS.forEach(word => {
        // word glued in middle: "abcWORDxyz" -> "abc WORD xyz"
        const reMiddle = new RegExp(`([a-zA-Z])(${word})([a-zA-Z])`, 'gi');
        out = out.replace(reMiddle, '$1 $2 $3');
        // word at start glued: "WORDabc" -> "WORD abc"
        const reStart = new RegExp(`^(${word})([a-zA-Z])`, 'gi');
        out = out.replace(reStart, '$1 $2');
        // word at end glued: "abcWORD" -> "abc WORD"
        const reEnd = new RegExp(`([a-zA-Z])(${word})$`, 'gi');
        out = out.replace(reEnd, '$1 $2');
        // Also handle word boundaries mid-string
        const reBoundary = new RegExp(`([a-zA-Z])(${word})(?=\\s|$|[^a-zA-Z])`, 'gi');
        out = out.replace(reBoundary, '$1 $2');
        const reBoundary2 = new RegExp(`(?:^|\\s|[^a-zA-Z])(${word})([a-zA-Z])`, 'gi');
        out = out.replace(reBoundary2, ' $1 $2');
    });

    // 3. Fix common stuck patterns like "forthephysically" -> "for the physically"
    out = out
        .replace(/forthe/gi, 'for the ')
        .replace(/ofthe/gi, 'of the ')
        .replace(/inthe/gi, 'in the ')
        .replace(/tothe/gi, 'to the ')
        .replace(/isthe/gi, 'is the ')
        .replace(/andthe/gi, 'and the ')
        .replace(/ofaset/gi, 'of a set ')
        .replace(/ofset/gi, 'of set ')
        .replace(/hasn/gi, 'has n')
        .replace(/withn/gi, 'with n')
        .replace(/Showthat/gi, 'Show that ')
        .replace(/Provethat/gi, 'Prove that ')
        .replace(/Findthe/gi, 'Find the ')
        .replace(/Checkwhether/gi, 'Check whether ')
        .replace(/isinjectiveornot/gi, 'is injective or not')
        .replace(/issurjectiveornot/gi, 'is surjective or not')
        .replace(/findthecomposition/gi, 'find the composition')
        .replace(/findcomposition/gi, 'find composition');

    // 4. Collapse repeated spaces and trim
    out = out.replace(/\s+/g, ' ').trim();
    return out;
}

function formatText(text) {
    // Wrapper that respects the toggle
    if (!text) return '';
    if (!applyFormatting) return String(text);
    return doFormatText(text);
}

function populateCategories(bank) {
    const categories = [...new Set(bank.map(q => q.category).filter(c => c))];
    const select = document.getElementById('categoryFilter');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function filterQuestions() {
    const bank = getQuestionBank();
    const search = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const type = document.getElementById('typeFilter').value;
    
    let filtered = bank.filter(q => {
        const matchSearch = !search || q.question.toLowerCase().includes(search);
        const matchCategory = !category || q.category === category;
        const matchType = !type || q.type === type;
        return matchSearch && matchCategory && matchType;
    });
    
    displayQuestions(filtered);
}

function displayQuestions(questions) {
    const container = document.getElementById('questionBankContainer');
    
    if (questions.length === 0) {
        container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 20px;">No questions match your filters.</p>';
        return;
    }
    
    let html = '<div class="question-bank-list">';
    
    if (mode === 'select') {
        html += `
            <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; cursor: pointer; gap: 8px;">
                    <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll(this.checked)">
                    Select All
                </label>
                <button class="btn btn-success" onclick="addSelectedToExam()">Add Selected to Exam</button>
            </div>
        `;
    }
    
    questions.forEach((q, index) => {
        const typeLabels = {
            'multiple_choice': 'Multiple Choice',
            'true_false': 'True/False',
            'short_answer': 'Short Answer',
            'essay': 'Essay',
            'multiple_select': 'Multiple Select',
            'fill_blank': 'Fill in the Blank'
        };
        
        html += `
            <div class="card question-card" id="question-${q.id}">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        ${mode === 'select' ? `
                            <label style="display: flex; align-items: start; cursor: pointer;">
                                <input type="checkbox" class="question-checkbox" value="${q.id}" style="margin-right: 10px; margin-top: 5px;" onchange="syncSelectAllState()">
                                <div style="flex: 1;">
                        ` : ''}
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <span class="badge badge-primary">${typeLabels[q.type] || q.type}</span>
                            ${q.category ? `<span class="badge badge-success">${q.category}</span>` : ''}
                            <span class="badge">${q.points || 1} points</span>
                        </div>
                        <h4 style="color: var(--primary-color); margin-bottom: 10px;">${formatText(q.question)}</h4>
                        ${q.options && q.options.length > 0 ? `
                            <div style="margin-left: 20px; margin-bottom: 10px;">
                                ${q.options.map((opt, i) => `<p style="color: var(--gray);">${String.fromCharCode(65 + i)}. ${formatText(opt)}</p>`).join('')}
                            </div>
                        ` : ''}
                        <p style="color: var(--success-color); font-weight: 600;">Correct: ${Array.isArray(q.correctAnswer) ? q.correctAnswer.map(i => String.fromCharCode(65 + i)).join(', ') : formatText(q.correctAnswer)}</p>
                        ${mode === 'select' ? `
                                </div>
                            </label>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 14px;" onclick="openEditModal('${q.id}')">Edit</button>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteQuestion('${q.id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;

    if (mode === 'select') {
        syncSelectAllState();
    }
}

function toggleSelectAll(checked) {
    const boxes = Array.from(document.querySelectorAll('.question-checkbox'));
    boxes.forEach(cb => {
        cb.checked = checked;
    });
    syncSelectAllState();
}

function syncSelectAllState() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (!selectAll) return;
    const boxes = Array.from(document.querySelectorAll('.question-checkbox'));
    if (boxes.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }
    const checkedCount = boxes.filter(b => b.checked).length;
    selectAll.checked = checkedCount === boxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
}

function deleteQuestion(id) {
    let bank = getQuestionBank();
    bank = bank.filter(q => q.id !== id);
    saveQuestionBank(bank);
    showAlert('Question deleted successfully.', 'success');
    loadQuestionBank();
}

function openEditModal(id) {
    currentEditId = id;
    const bank = getQuestionBank();
    const q = bank.find(item => item.id === id);
    if (!q) return;
    document.getElementById('editQuestionText').value = q.question || '';
    document.getElementById('editCategory').value = q.category || '';
    document.getElementById('editPoints').value = q.points || 1;
    document.getElementById('editModalOverlay').classList.remove('hidden');
}

function closeEditModal() {
    currentEditId = null;
    document.getElementById('editModalOverlay').classList.add('hidden');
}

function saveEdit() {
    if (!currentEditId) return;
    const bank = getQuestionBank();
    const idx = bank.findIndex(q => q.id === currentEditId);
    if (idx === -1) return;

    const questionText = document.getElementById('editQuestionText').value.trim();
    const categoryText = document.getElementById('editCategory').value.trim();
    const pointsVal = Number(document.getElementById('editPoints').value) || 1;

    bank[idx] = {
        ...bank[idx],
        question: questionText,
        category: categoryText,
        points: pointsVal,
        updatedAt: new Date().toISOString()
    };

    saveQuestionBank(bank);
    showAlert('Question updated.', 'success');
    closeEditModal();
    loadQuestionBank();
}

function addSelectedToExam() {
    const selected = Array.from(document.querySelectorAll('.question-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        showAlert('Please select at least one question!', 'error');
        return;
    }
    
    const bank = getQuestionBank();
    const questions = bank.filter(q => selected.includes(q.id));
    
    localStorage.setItem('selectedBankQuestions', JSON.stringify(questions));
    window.location.href = 'create-exam.html';
}

function clearQuestionBank() {
    const count = getQuestionBank().length;
    if (count === 0) {
        showAlert('Question bank is already empty.', 'info');
        return;
    }
    if (!confirm(`This will delete all ${count} question(s) from the bank. Continue?`)) {
        return;
    }
    saveQuestionBank([]);
    showAlert('Question bank cleared successfully.', 'success');
    loadQuestionBank();
}

function toggleFormatting() {
    const checkbox = document.getElementById('formatToggle');
    applyFormatting = checkbox ? checkbox.checked : true;
    loadQuestionBank();
}

async function fixSpacingNow() {
    // Uses NLP endpoint when available; falls back to pattern-based fix
    let bank = getQuestionBank();
    if (!Array.isArray(bank) || bank.length === 0) {
        showAlert('Question bank is empty.', 'info');
        return;
    }

    showAlert('Fixing spacing using AI... please wait.', 'info');

    try {
        // Collect all texts that need fixing
        const textsToFix = [];
        const textMap = []; // Track which text belongs to which question field

        bank.forEach((q, qIdx) => {
            if (typeof q.question === 'string' && q.question.trim()) {
                textsToFix.push(q.question);
                textMap.push({ qIdx, field: 'question' });
            }
            if (Array.isArray(q.options)) {
                q.options.forEach((opt, optIdx) => {
                    if (typeof opt === 'string' && opt.trim()) {
                        textsToFix.push(opt);
                        textMap.push({ qIdx, field: 'options', optIdx });
                    }
                });
            }
            if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
                textsToFix.push(q.correctAnswer);
                textMap.push({ qIdx, field: 'correctAnswer' });
            }
        });

        if (textsToFix.length === 0) {
            showAlert('No text to fix.', 'info');
            return;
        }

        // Call NLP API to fix spacing
        const response = await fetch('/api/fix-spacing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: textsToFix })
        });

        const data = await response.json();

        if (!data.success) {
            // Fallback to pattern-based fix
            console.warn('NLP spacing failed, using fallback:', data.message);
            bank = bank.map(q => {
                const updated = { ...q };
                if (typeof updated.question === 'string') {
                    updated.question = doFormatText(updated.question);
                }
                if (Array.isArray(updated.options)) {
                    updated.options = updated.options.map(opt => typeof opt === 'string' ? doFormatText(opt) : opt);
                }
                if (typeof updated.correctAnswer === 'string') {
                    updated.correctAnswer = doFormatText(updated.correctAnswer);
                }
                return updated;
            });
        } else {
            // Apply NLP-fixed texts back to bank
            const fixedTexts = data.texts;
            textMap.forEach((mapping, idx) => {
                const fixed = fixedTexts[idx];
                if (mapping.field === 'question') {
                    bank[mapping.qIdx].question = fixed;
                } else if (mapping.field === 'options') {
                    bank[mapping.qIdx].options[mapping.optIdx] = fixed;
                } else if (mapping.field === 'correctAnswer') {
                    bank[mapping.qIdx].correctAnswer = fixed;
                }
            });
        }

        saveQuestionBank(bank);
        showAlert('Spacing fixed using AI for all questions!', 'success');
        loadQuestionBank();
    } catch (err) {
        console.error('Fix spacing error:', err);
        // Fallback to pattern-based fix
        bank = bank.map(q => {
            const updated = { ...q };
            if (typeof updated.question === 'string') {
                updated.question = doFormatText(updated.question);
            }
            if (Array.isArray(updated.options)) {
                updated.options = updated.options.map(opt => typeof opt === 'string' ? doFormatText(opt) : opt);
            }
            if (typeof updated.correctAnswer === 'string') {
                updated.correctAnswer = doFormatText(updated.correctAnswer);
            }
            return updated;
        });
        saveQuestionBank(bank);
        showAlert('Spacing fixed (fallback mode).', 'success');
        loadQuestionBank();
    }
}

function importQuestions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.pdf,.doc,.docx';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const name = file.name.toLowerCase();

        // Read import mode from radio buttons: 'merge' (default) or 'replace'
        let importMode = 'merge';
        const modeInput = document.querySelector('input[name="importMode"]:checked');
        if (modeInput && (modeInput.value === 'merge' || modeInput.value === 'replace')) {
            importMode = modeInput.value;
        }

        // For document types, send raw file to backend converter API
        if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) {
            fetch('/api/convert-questions?filename=' + encodeURIComponent(file.name), {
                method: 'POST',
                headers: {
                    'X-Filename': file.name
                },
                body: file
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showAlert(data.message || 'Error converting document.', 'error');
                    return;
                }

                const questions = Array.isArray(data.questions) ? data.questions : [];
                const processed = questions.map(q => ({
                    ...q,
                    id: Date.now().toString() + Math.random(),
                    addedAt: new Date().toISOString()
                }));

                if (processed.length > 0) {
                    if (importMode === 'replace') {
                        saveQuestionBank(processed);
                    } else {
                        const bank = getQuestionBank();
                        processed.forEach(q => bank.push(q));
                        saveQuestionBank(bank);
                    }
                    showAlert('Questions imported from document successfully!', 'success');
                    loadQuestionBank();
                } else {
                    showAlert('No questions were found in the document.', 'info');
                }
            })
            .catch(error => {
                showAlert('Error importing questions from document: ' + error.message, 'error');
            });

            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                if (name.endsWith('.json')) {
                    const questions = JSON.parse(event.target.result);
                    if (Array.isArray(questions)) {
                        const processed = questions.map(q => ({
                            ...q,
                            id: Date.now().toString() + Math.random(),
                            addedAt: new Date().toISOString()
                        }));

                        if (importMode === 'replace') {
                            saveQuestionBank(processed);
                        } else {
                            const bank = getQuestionBank();
                            processed.forEach(q => bank.push(q));
                            saveQuestionBank(bank);
                        }
                        showAlert('Questions imported successfully!', 'success');
                        loadQuestionBank();
                    }
                } else if (name.endsWith('.csv')) {
                    // CSV import logic would go here
                    showAlert('CSV import coming soon!', 'info');
                }
            } catch (error) {
                showAlert('Error importing questions: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

loadQuestionBank();

