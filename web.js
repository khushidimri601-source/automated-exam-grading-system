/* app.js
   Frontend-only exam prototype.
   Data stored in browser localStorage under keys: users, exams, results
*/

const $ = id => document.getElementById(id);

// --- init / seed ---
function readLS(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null } }
function writeLS(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

function seed(){
  if(!readLS('users')){
    writeLS('users', [
      { email:'teacher@example.com', password:'pass', role:'teacher', name:'Teacher Sample' },
      { email:'student@example.com', password:'pass', role:'student', name:'Student Sample' }
    ]);
  }
  if(!readLS('exams')){
    const sample = {
      id: id(),
      title: 'Math Basics',
      duration: 5, // minutes
      total: 3,
      questions: [
        { id:id(), text:'2 + 2 = ?', opts:{A:'3',B:'4',C:'5',D:'6'}, correct:'B', marks:1 },
        { id:id(), text:'5 * 3 = ?', opts:{A:'15',B:'10',C:'8',D:'12'}, correct:'A', marks:1 },
        { id:id(), text:'Square root of 16?', opts:{A:'3',B:'2',C:'4',D:'5'}, correct:'C', marks:1 }
      ]
    };
    writeLS('exams',[sample]);
  }
  if(!readLS('results')) writeLS('results', []);
}
seed();

// --- helpers ---
function id(){ return Math.random().toString(36).slice(2,10); }
function hide(el){ el.classList.add('hidden'); }
function show(el){ el.classList.remove('hidden'); }
function escapeHtml(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// --- UI elements ---
const home = $('home');
const teacherDashboard = $('teacher-dashboard');
const studentDashboard = $('student-dashboard');
const examEditor = $('exam-editor');
const takeExam = $('take-exam');
const resultPage = $('result-page');

let currentUser = null;
let editingExam = null;
let runningExam = null;
let runningAnswers = [];
let currentIndex = 0;
let timerInterval = null;
let timeLeftSec = 0;

// --- Auth ---
$('btn-register').addEventListener('click', ()=>{
  const em = $('auth-email').value.trim();
  const pw = $('auth-password').value;
  const role = $('auth-role').value;
  if(!em || !pw){ alert('Enter email and password'); return; }
  const users = readLS('users') || [];
  if(users.find(u=>u.email===em)){ alert('Email exists. Please login.'); return; }
  users.push({ email:em, password:pw, role, name: em.split('@')[0] });
  writeLS('users', users);
  alert('Registered. You can login now.');
});

$('btn-login').addEventListener('click', ()=>{
  const em = $('auth-email').value.trim();
  const pw = $('auth-password').value;
  const role = $('auth-role').value;
  const users = readLS('users') || [];
  const u = users.find(x => x.email===em && x.password===pw && x.role===role);
  if(!u){ alert('Invalid credentials or role mismatch'); return; }
  currentUser = { email:u.email, role:u.role, name:u.name };
  navigateToDashboard();
});

// --- Navigation ---
function navigateToDashboard(){
  hide(home); hide(examEditor); hide(takeExam); hide(resultPage);
  if(currentUser.role === 'teacher'){
    renderExamsForTeacher();
    show(teacherDashboard);
  } else {
    renderAvailableExams();
    show(studentDashboard);
  }
}

// --- Teacher: create exam ---
$('btn-new-exam').addEventListener('click', ()=>{
  editingExam = { id:id(), title:'', duration:20, total:null, questions:[] };
  $('exam-title').value = '';
  $('exam-duration').value = 20;
  $('exam-total').value = '';
  $('q-text').value = ''; $('q-a').value=''; $('q-b').value=''; $('q-c').value=''; $('q-d').value=''; $('q-marks').value='1';
  renderQuestionsAdded();
  hide(teacherDashboard); show(examEditor);
});

$('btn-add-q').addEventListener('click', ()=>{
  const q = {
    id: id(),
    text: $('q-text').value.trim(),
    opts: { A: $('q-a').value.trim(), B: $('q-b').value.trim(), C: $('q-c').value.trim(), D: $('q-d').value.trim() },
    correct: $('q-correct').value,
    marks: parseInt($('q-marks').value) || 1
  };
  if(!q.text || (!q.opts.A && !q.opts.B)) { alert('Fill question and at least two options'); return; }
  editingExam.questions.push(q);
  $('q-text').value=''; $('q-a').value=''; $('q-b').value=''; $('q-c').value=''; $('q-d').value='';
  renderQuestionsAdded();
});

$('btn-save-exam').addEventListener('click', ()=>{
  const exams = readLS('exams') || [];
  editingExam.title = $('exam-title').value.trim() || 'Untitled Exam';
  editingExam.duration = parseInt($('exam-duration').value) || 20;
  const total = parseInt($('exam-total').value);
  editingExam.total = isNaN(total) ? editingExam.questions.reduce((s,q)=>s+q.marks,0) : total;
  exams.push(editingExam);
  writeLS('exams', exams);
  editingExam = null;
  alert('Exam saved.');
  hide(examEditor); show(teacherDashboard); renderExamsForTeacher();
});

$('btn-cancel-exam').addEventListener('click', ()=>{
  editingExam = null; hide(examEditor); show(teacherDashboard);
});

function renderQuestionsAdded(){
  const wrap = $('questions-added');
  wrap.innerHTML = '';
  if(!editingExam) return;
  editingExam.questions.forEach((q,i)=>{
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = `<strong>Q${i+1}:</strong> ${escapeHtml(q.text)} <div class="muted">A:${escapeHtml(q.opts.A)||'-'} | B:${escapeHtml(q.opts.B)||'-'} | C:${escapeHtml(q.opts.C)||'-'} | D:${escapeHtml(q.opts.D)||'-'} — Correct:${q.correct} — Marks:${q.marks}</div>`;
    wrap.appendChild(div);
  });
}

// render teacher exams list
function renderExamsForTeacher(){
  const wrap = $('exams-list'); wrap.innerHTML = '';
  const exams = readLS('exams') || [];
  if(!exams.length){ wrap.innerHTML = '<div class="muted">No exams yet</div>'; return; }
  exams.forEach(ex=>{
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${escapeHtml(ex.title)}</strong><div class="muted">${ex.questions.length} questions • ${ex.duration} mins • total ${ex.total || 0}</div></div>
      <div>
        <button class="btn" onclick="previewExam('${ex.id}')">Preview</button>
        <button class="btn" onclick="deleteExam('${ex.id}')">Delete</button>
      </div>
    </div>`;
    wrap.appendChild(div);
  });
}
window.previewExam = function(id){
  const exams = readLS('exams') || []; const ex = exams.find(e=>e.id===id);
  if(!ex) return alert('Not found');
  alert(`Preview: ${ex.title}\nQuestions: ${ex.questions.length}`);
}
window.deleteExam = function(id){
  if(!confirm('Delete this exam?')) return;
  let exams = readLS('exams') || []; exams = exams.filter(x=>x.id!==id); writeLS('exams',exams);
  renderExamsForTeacher();
}

// --- Student: available exams ---
function renderAvailableExams(){
  const wrap = $('available-exams'); wrap.innerHTML = '';
  const exams = readLS('exams') || [];
  if(!exams.length){ wrap.innerHTML = '<div class="muted">No exams available</div>'; return; }
  exams.forEach(ex=>{
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${escapeHtml(ex.title)}</strong><div class="muted">${ex.questions.length} Q • ${ex.duration} min</div></div>
      <div><button class="btn primary" onclick="startExam('${ex.id}')">Start Exam</button></div>
    </div>`;
    wrap.appendChild(div);
  });
}

// --- Exam taking ---
window.startExam = function(id){
  const exams = readLS('exams') || []; const ex = exams.find(e=>e.id===id);
  if(!ex) return alert('Exam not found');
  runningExam = JSON.parse(JSON.stringify(ex)); // clone
  runningAnswers = runningExam.questions.map(q => ({ qId:q.id, selected:null, isCorrect:false, marks:0 }));
  currentIndex = 0;
  timeLeftSec = runningExam.duration * 60;
  renderQuestion();
  hide(studentDashboard); show(takeExam);
  startTimer();
}

function renderQuestion(){
  const q = runningExam.questions[currentIndex];
  const area = $('question-area'); area.innerHTML = `
    <div><strong>Question ${currentIndex+1} of ${runningExam.questions.length}</strong></div>
    <div class="mt">${escapeHtml(q.text)}</div>
    <div class="mt">
      ${['A','B','C','D'].map(letter=>{
        const label = q.opts[letter]||'';
        const checked = runningAnswers[currentIndex].selected === letter ? 'checked' : '';
        return `<label style="display:block;margin:8px 0"><input type="radio" name="opt" value="${letter}" ${checked}> <strong>${letter}:</strong> ${escapeHtml(label)}</label>`;
      }).join('')}
    </div>
  `;
}

$('next-q').addEventListener('click', ()=>{
  saveCurrentAnswer();
  if(currentIndex < runningExam.questions.length - 1){ currentIndex++; renderQuestion(); }
});
$('prev-q').addEventListener('click', ()=>{
  saveCurrentAnswer();
  if(currentIndex > 0){ currentIndex--; renderQuestion(); }
});

function saveCurrentAnswer(){
  const sel = document.querySelector('input[name="opt"]:checked');
  runningAnswers[currentIndex].selected = sel ? sel.value : null;
}

$('submit-exam').addEventListener('click', ()=>{
  if(!confirm('Submit exam now?')) return;
  saveCurrentAnswer();
  submitExam();
});

function submitExam(){
  clearInterval(timerInterval);
  let score = 0;
  runningAnswers.forEach((a,i)=>{
    const q = runningExam.questions[i];
    if(a.selected && a.selected === q.correct){ a.isCorrect = true; a.marks = q.marks; score += q.marks; }
  });
  const results = readLS('results') || [];
  results.push({ examId: runningExam.id, studentEmail: currentUser.email, score, timestamp: new Date().toISOString(), total: runningExam.total });
  writeLS('results', results);
  showResult(score, runningAnswers, runningExam);
  hide(takeExam); show(resultPage);
}

// --- Timer ---
function startTimer(){
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(()=>{
    timeLeftSec--;
    if(timeLeftSec <= 0){ clearInterval(timerInterval); alert('Time up — auto-submitting'); submitExam(); }
    updateTimerDisplay();
  }, 1000);
}
function updateTimerDisplay(){
  const m = Math.floor(timeLeftSec/60), s = timeLeftSec % 60;
  $('time-left').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// --- Result rendering ---
function showResult(score, answers, exam){
  $('result-summary').innerHTML = `<div><strong>${escapeHtml(exam.title)}</strong></div>
    <div class="mt muted">Submitted: ${new Date().toLocaleString()}</div>
    <div class="mt"><strong>Score:</strong> ${score} / ${exam.total}</div>`;
  const wrap = $('result-answers'); wrap.innerHTML = '';
  answers.forEach((a,i)=>{
    const q = exam.questions[i];
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = `<div><strong>Q${i+1}:</strong> ${escapeHtml(q.text)}</div>
      <div class="muted">Your: ${a.selected||'<em>Unanswered</em>'} • Correct: ${q.correct} • Marks: ${a.marks}</div>`;
    wrap.appendChild(div);
  });
}

// back to dashboard from result
$('btn-back-dashboard').addEventListener('click', ()=>{
  hide(resultPage);
  navigateToDashboard();
});

// small logout buttons
$('btn-logout-teacher').addEventListener('click', ()=>{
  if(confirm('Logout?')) { currentUser = null; hide(teacherDashboard); show(home); }
});
$('btn-logout-student').addEventListener('click', ()=>{
  if(confirm('Logout?')) { currentUser = null; hide(studentDashboard); show(home); }
});

// Initialize view
hide(teacherDashboard); hide(studentDashboard); hide(examEditor); hide(takeExam); hide(resultPage);

// Expose a couple things for buttons generated in HTML
window.startExam = window.startExam;
window.previewExam = window.previewExam;
window.deleteExam = window.deleteExam;
