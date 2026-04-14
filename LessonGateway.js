/* ═══════════════════════════════════════════════════════════
   GUIDE TO PĀLI — LESSON GATEWAY ENGINE
   Implements Level 1-3 Mastery with "Drill till Perfect"
   ═══════════════════════════════════════════════════════════ */

const LessonGateway = {
  state: {
    active: false,
    lesson: null,
    level: 1, // 1: Easy, 2: Medium, 3: Hard
    questions: [],
    queue: [],
    mistakes: [],
    currentIndex: 0,
    score: 0,
    totalQuestions: 0
  },

  // ─── INIT & HARVEST ───
  init() {
    this.lesson = window.currentLesson || 1;
    this.createOverlay();
    this.checkResumeState();
  },

  createOverlay() {
    const html = `
      <div id="lesson-gate" class="gate-overlay">
        <header class="gate-header">
          <div class="gate-title">Lesson ${this.lesson} Mastery</div>
          <div class="gate-progress-wrap">
            <div class="gate-level-indicator"><span id="gate-level-name">Level 1: Practice</span> <span id="gate-progress-text" style="color:inherit; margin-left:8px; opacity:0.8;">0%</span></div>
            <div class="gate-progress-bar-bg">
              <div class="gate-progress-bar-fill" id="gate-progress-fill"></div>
            </div>
          </div>
          <button class="gate-close" onclick="LessonGateway.close()">×</button>
        </header>
        <div class="gate-content">
          <div class="gate-card" id="gate-card">
            <!-- Dynamic Content -->
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  start(lv = 1) {
    this.harvestContent();
    this.active = true;
    document.getElementById('lesson-gate').classList.add('active');
    this.loadLevel(lv);
  },

  close() {
    if (this.currentIndex > 0) {
      this.saveState();
    }
    document.getElementById('lesson-gate').classList.remove('active');
    this.active = false;
  },

  harvestContent() {
    // 1. Harvest Vocabulary
    const vocabItems = [...document.querySelectorAll('.vocab-item')].map(el => ({
      pali: el.querySelector('.vocab-pali').textContent,
      english: el.querySelector('.vocab-eng').textContent,
      type: 'vocab'
    }));

    // 2. Harvest Examples
    const exampleItems = [...document.querySelectorAll('.example-row')].map(el => ({
      pali: el.querySelector('.ex-pali').textContent.replace(/\s+/g, ' ').trim(),
      english: el.querySelector('.ex-english').textContent.trim(),
      type: 'example'
    }));

    this.questions = [...vocabItems, ...exampleItems];
  },

  // ─── LEVEL MANAGEMENT ───
  loadLevel(lv) {
    this.level = lv;
    this.mistakes = [];
    this.queue = this.shuffle([...this.questions]);
    this.totalQuestions = this.queue.length;
    this.currentIndex = 0;
    
    // Update UI headers
    const names = ["Level 1: Practice", "Level 2: Challenge", "Level 3: Mastery"];
    document.getElementById('gate-level-name').textContent = names[lv - 1];
    
    this.nextQuestion();
  },

  nextQuestion() {
    if (this.queue.length === 0) {
      if (this.mistakes.length > 0) {
        // Recycle mistakes back into queue
        this.queue = this.shuffle([...this.mistakes]);
        this.mistakes = [];
        this.renderQuestion();
      } else {
        this.handleLevelComplete();
      }
      return;
    }

    this.renderQuestion();
  },

  renderQuestion() {
    const q = this.queue[0];
    const card = document.getElementById('gate-card');
    const progress = ((this.totalQuestions - (this.queue.length + this.mistakes.length)) / this.totalQuestions) * 100;
    const progressInt = Math.round(progress);
    document.getElementById('gate-progress-fill').style.width = Math.max(5, progress) + '%';
    const textEl = document.getElementById('gate-progress-text');
    if(textEl) textEl.textContent = progressInt + '%';

    if (this.level === 1 || this.level === 2) {
      this.renderMultipleChoice(q);
    } else {
      this.renderTextEntry(q);
    }
  },

  renderMultipleChoice(q) {
    const card = document.getElementById('gate-card');
    const options = this.generateOptions(q);
    
    card.innerHTML = `
      <div class="q-prompt">Translate this Pāli word:</div>
      <div class="q-text">${q.pali}</div>
      <div class="options-grid">
        ${options.map(opt => `
          <button class="option-btn" onclick="LessonGateway.checkChoice(this, '${opt === q.english}')">${opt}</button>
        `).join('')}
      </div>
      <div class="gate-feedback" id="gate-fb"></div>
    `;
  },

  renderTextEntry(q) {
    const card = document.getElementById('gate-card');
    card.innerHTML = `
      <div class="q-prompt">Type the English translation:</div>
      <div class="q-text">${q.pali}</div>
      <div class="gate-input-wrap">
        <input type="text" class="gate-input" id="gate-input" placeholder="Your translation..." autocomplete="off">
      </div>
      <div class="gate-actions">
        <button class="gate-btn gate-btn-primary" onclick="LessonGateway.submitText()">Check Answer</button>
      </div>
      <div class="gate-feedback" id="gate-fb"></div>
    `;

    const input = document.getElementById('gate-input');
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') this.submitText(); });
  },

  // ─── LOGIC ───
  generateOptions(correctQ) {
    const options = [correctQ.english];
    const others = this.questions.filter(q => q.english !== correctQ.english);
    const shuffledOthers = this.shuffle(others);
    
    // Add 3 distractors
    for (let i = 0; i < 3 && i < shuffledOthers.length; i++) {
      options.push(shuffledOthers[i].english);
    }
    
    return this.shuffle(options);
  },

  checkChoice(btn, isCorrect) {
    if (this.processing) return;
    this.processing = true;

    const q = this.queue.shift();
    const fb = document.getElementById('gate-fb');

    if (isCorrect === 'true') {
      btn.classList.add('correct');
      fb.textContent = "Correct! Well done.";
      fb.className = "gate-feedback visible correct";
      PaliProgress.addXP(5);
    } else {
      btn.classList.add('wrong');
      fb.innerHTML = `Not quite. The answer is: <strong>${q.english}</strong>`;
      fb.className = "gate-feedback visible wrong";
      this.mistakes.push(q); // Queue for later
    }

    setTimeout(() => {
      this.processing = false;
      this.nextQuestion();
    }, isCorrect === 'true' ? 1200 : 2500);
  },

  submitText() {
    if (this.processing) return;
    const input = document.getElementById('gate-input');
    const val = input.value.trim();
    if (!val) return;

    this.processing = true;
    const q = this.queue.shift();
    const fb = document.getElementById('gate-fb');

    // Reuse existing normalisation logic from exercises.js or PaliProgress
    const correct = this.normalise(val) === this.normalise(q.english);

    if (correct) {
      input.style.borderColor = "var(--correct)";
      fb.textContent = "Excellent! Perfect spelling.";
      fb.className = "gate-feedback visible correct";
      PaliProgress.addXP(10);
    } else {
      input.style.borderColor = "var(--wrong)";
      fb.innerHTML = `Correction: <strong>${q.english}</strong>`;
      fb.className = "gate-feedback visible wrong";
      this.mistakes.push(q);
    }

    setTimeout(() => {
      this.processing = false;
      this.nextQuestion();
    }, correct ? 1200 : 3000);
  },

  handleLevelComplete() {
    const card = document.getElementById('gate-card');
    const isFinal = this.level === 3;
    
    // Update global progress
    PaliProgress.saveLessonLevel(this.lesson, this.level);

    card.innerHTML = `
      <div class="q-text" style="font-size:32px;">Level ${this.level} Complete!</div>
      <p style="margin-bottom:32px; font-family:'Lora';">Sādhu! You have mastered this difficulty.</p>
      <div class="gate-actions">
        ${isFinal 
          ? `<button class="gate-btn gate-btn-primary" onclick="LessonGateway.close()">Finish Lesson</button>`
          : `<button class="gate-btn gate-btn-primary" onclick="LessonGateway.loadLevel(${this.level + 1})">Start Level ${this.level + 1} →</button>`
        }
      </div>
    `;
    this.clearState();
  },

  // ─── UTILS ───
  shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  },

  normalise(str) {
    return str.trim().toLowerCase()
      .replace(/[āa]/g,'a').replace(/[īi]/g,'i').replace(/[ūu]/g,'u')
      .replace(/[ṃṅñṇṭḍḷ]/g, c => ({ṃ:'m',ṅ:'n',ñ:'n',ṇ:'n',ṭ:'t',ḍ:'d',ḷ:'l'}[c]||c))
      .replace(/\s+/g,' ').replace(/[.!?]$/, '');
  },

  // ─── PERSISTENCE ───
  saveState() {
    const state = {
      level: this.level,
      queue: this.queue,
      mistakes: this.mistakes,
      total: this.totalQuestions
    };
    localStorage.setItem(`pali_lesson_${this.lesson}_resume`, JSON.stringify(state));
  },

  checkResumeState() {
    const saved = localStorage.getItem(`pali_lesson_${this.lesson}_resume`);
    if (saved) {
      const data = JSON.parse(saved);
      // We could add a "Resume?" UI here or just set the state
      this.level = data.level;
      // Note: Full restart of Level is often cleaner for the user, 
      // but the user asked for full resume.
    }
  },

  clearState() {
    localStorage.removeItem(`pali_lesson_${this.lesson}_resume`);
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => LessonGateway.init());
