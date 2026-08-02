/* ═══════════════════════════════════════════════════════════
   GUIDE TO PĀLI — LESSON GATEWAY ENGINE
   Implements Level 1-3 Mastery with "Drill till Perfect"
   ═══════════════════════════════════════════════════════════ */

const LessonGateway = {
  state: {
    active: false,
    lesson: null,
    level: 1, // 1: MC, 2: Vocab Text, 3: Sentences Text
    vocabPool: [],
    sentencePool: [],
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
            <div class="gate-level-indicator"><span id="gate-level-name">Level 1: Practice</span> <span id="gate-progress-text" style="color:inherit; margin-left:8px; opacity:0.8;">0/0 (0%)</span></div>
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
    if (window.lessonData) {
      this.vocabPool = window.lessonData.vocab || [];
      this.sentencePool = window.lessonData.sentences || [];
    }
  },

  // ─── LEVEL MANAGEMENT ───
  loadLevel(lv) {
    this.level = lv;
    this.mistakes = [];
    
    let pool = [];
    if (lv === 1 || lv === 2) {
      this.vocabPool.forEach(v => {
        pool.push({ text: v.pali[0], answers: v.english, type: 'vocab', dir: 'p2e', original: v });
        pool.push({ text: v.english[0], answers: v.pali, type: 'vocab', dir: 'e2p', original: v });
      });
    } else if (lv === 3) {
      this.sentencePool.forEach(s => {
        if (s.dir === 'p2e') {
           pool.push({ text: s.pali[0], answers: s.english, type: 'sentence', dir: 'p2e', original: s });
        } else {
           pool.push({ text: s.english[0], answers: s.pali, type: 'sentence', dir: 'e2p', original: s });
        }
      });
    }

    this.queue = this.shuffle(pool);
    this.totalQuestions = this.queue.length;
    this.currentIndex = 0;
    
    const names = ["Level 1: Practice", "Level 2: Vocab Typing", "Level 3: Sentences"];
    document.getElementById('gate-level-name').textContent = names[lv - 1];
    
    this.nextQuestion();
  },

  nextQuestion() {
    if (this.queue.length === 0) {
      if (this.mistakes.length > 0) {
        this.queue = this.shuffle([...this.mistakes]);
        this.mistakes = [];
        this.showReviewMessage(() => {
          this.renderQuestion();
        });
      } else {
        this.handleLevelComplete();
      }
      return;
    }

    this.renderQuestion();
  },

  showReviewMessage(callback) {
    const card = document.getElementById('gate-card');
    card.innerHTML = `
      <div class="q-prompt" style="font-size:24px; color:var(--bodhi-red); text-align:center;">Let's review your mistakes!</div>
      <p style="text-align:center; font-style:italic; color:var(--ink-muted); margin-top:16px;">Practice makes perfect.</p>
    `;
    setTimeout(callback, 2000);
  },

  renderQuestion() {
    const q = this.queue[0];
    
    // Progress calculation
    const remaining = this.queue.length + this.mistakes.length;
    const answered = this.totalQuestions - remaining;
    const progress = (answered / this.totalQuestions) * 100;
    
    document.getElementById('gate-progress-fill').style.width = Math.max(5, progress) + '%';
    const textEl = document.getElementById('gate-progress-text');
    if(textEl) textEl.textContent = `${answered}/${this.totalQuestions} (${Math.round(progress)}%)`;

    if (this.level === 1) {
      this.renderMultipleChoice(q);
    } else {
      this.renderTextEntry(q);
    }
  },

  renderMultipleChoice(q) {
    const card = document.getElementById('gate-card');
    const options = this.generateOptions(q);
    const prompt = q.dir === 'p2e' ? 'Translate this Pāli word:' : 'Translate this English word:';
    
    const optionsHtml = options.map(opt => {
      const isCorrect = q.answers.includes(opt);
      return `<button class="option-btn" onclick="LessonGateway.checkChoice(this, ${isCorrect})">${opt}</button>`;
    }).join('');

    card.innerHTML = `
      <div class="q-prompt">${prompt}</div>
      <div class="q-text">${q.text}</div>
      <div class="options-grid">
        ${optionsHtml}
      </div>
      <div class="gate-feedback" id="gate-fb"></div>
    `;
  },

  renderTextEntry(q) {
    const card = document.getElementById('gate-card');
    const prompt = q.dir === 'p2e' ? 'Type the English translation:' : 'Type the Pāli translation:';
    
    card.innerHTML = `
      <div class="q-prompt">${prompt}</div>
      <div class="q-text">${q.text}</div>
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
  generateOptions(q) {
    const correctOpt = q.answers[0];
    const options = [correctOpt];
    
    const others = [];
    if (q.type === 'vocab') {
      this.vocabPool.forEach(v => {
        if (v !== q.original) others.push(q.dir === 'p2e' ? v.english[0] : v.pali[0]);
      });
    } else {
      this.sentencePool.forEach(s => {
        if (s !== q.original) others.push(q.dir === 'p2e' ? s.english[0] : s.pali[0]);
      });
    }

    const shuffledOthers = this.shuffle(others);
    for (let i = 0; i < 3 && i < shuffledOthers.length; i++) {
      options.push(shuffledOthers[i]);
    }
    
    return this.shuffle(options);
  },

  checkChoice(btn, isCorrect) {
    if (this.processing) return;
    this.processing = true;

    const q = this.queue.shift();
    const fb = document.getElementById('gate-fb');

    if (isCorrect) {
      btn.classList.add('correct');
      fb.textContent = "Correct! Well done.";
      fb.className = "gate-feedback visible correct";
      PaliProgress.addXP(5);
    } else {
      btn.classList.add('wrong');
      fb.innerHTML = `Not quite. The answer is: <strong>${q.answers[0]}</strong>`;
      fb.className = "gate-feedback visible wrong";
      this.mistakes.push(q); 
    }

    setTimeout(() => {
      this.processing = false;
      this.nextQuestion();
    }, isCorrect ? 1200 : 2500);
  },

  submitText() {
    if (this.processing) return;
    const input = document.getElementById('gate-input');
    const val = input.value.trim();
    if (!val) return;

    this.processing = true;
    const q = this.queue.shift();
    const fb = document.getElementById('gate-fb');

    const isPaliTarget = q.dir === 'e2p';
    const userNorm = this.normalise(val, isPaliTarget);
    const isCorrect = q.answers.some(ans => this.normalise(ans, isPaliTarget) === userNorm);

    if (isCorrect) {
      input.style.borderColor = "var(--correct)";
      fb.textContent = "Excellent! Perfect spelling.";
      fb.className = "gate-feedback visible correct";
      PaliProgress.addXP(10);
    } else {
      input.style.borderColor = "var(--wrong)";
      fb.innerHTML = `Correction: <strong>${q.answers[0]}</strong>`;
      fb.className = "gate-feedback visible wrong";
      this.mistakes.push(q);
    }

    setTimeout(() => {
      this.processing = false;
      this.nextQuestion();
    }, isCorrect ? 1200 : 3000);
  },

  handleLevelComplete() {
    const card = document.getElementById('gate-card');
    const isFinal = this.level === 3;
    
    PaliProgress.saveLessonLevel(this.lesson, this.level);

    card.innerHTML = `
      <div class="q-text" style="font-size:32px;">Level ${this.level} Complete!</div>
      <p style="margin-bottom:32px; font-family:'Lora';">Sādhu! You have mastered this difficulty.</p>
      <div class="gate-actions">
        ${isFinal 
          ? `<button class="gate-btn gate-btn-primary" onclick="LessonGateway.close()">Finish Lesson</button>`
          : `<button class="gate-btn gate-btn-primary" onclick="LessonGateway.start(${this.level + 1})">Start Level ${this.level + 1} →</button>`
        }
      </div>
    `;
    this.clearState();
  },

  // ─── UTILS ───
  shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  },

  normalise(str, isPali = false) {
    let s = str.trim().toLowerCase();
    if (!isPali) {
      s = s.replace(/^(a|an|the)\s+/, '');
    }
    s = s.replace(/[.!?]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s;
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
      this.level = data.level;
    }
  },

  clearState() {
    localStorage.removeItem(`pali_lesson_${this.lesson}_resume`);
  }
};

document.addEventListener('DOMContentLoaded', () => LessonGateway.init());
