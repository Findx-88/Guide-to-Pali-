/* ═══════════════════════════════════════════════════════════
   GUIDE TO PĀLI — PROGRESS & GAMIFICATION ENGINE
   XP, Streaks, Badges, localStorage persistence, 
   Dark mode, WIP toasts, scroll animations
   ═══════════════════════════════════════════════════════════ */

const PaliProgress = {
  // ─── STORAGE HELPERS ───
  get(key, fallback) {
    try { const v = localStorage.getItem('pali_' + key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('pali_' + key, JSON.stringify(val)); } catch {}
  },

  // ─── XP SYSTEM ───
  getXP()  { return this.get('xp', 0); },
  addXP(n) {
    const xp = this.getXP() + n;
    this.set('xp', xp);
    this.updateXPDisplay();
    this.checkBadges();
    return xp;
  },
  updateXPDisplay() {
    document.querySelectorAll('.nav-xp-count').forEach(el => el.textContent = this.getXP());
  },

  // ─── STREAK SYSTEM ───
  getStreak() { return this.get('streak', 0); },
  getLastActive() { return this.get('lastActive', null); },
  updateStreak() {
    const today = new Date().toDateString();
    const last  = this.getLastActive();
    if (last === today) return; // Already active today

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (last === yesterday) {
      this.set('streak', this.getStreak() + 1);
    } else if (last !== today) {
      this.set('streak', 1);
    }
    this.set('lastActive', today);
    this.updateStreakDisplay();
    this.checkBadges();
  },
  updateStreakDisplay() {
    const streak = this.getStreak();
    document.querySelectorAll('.nav-streak-count').forEach(el => {
      el.textContent = streak;
      el.closest('.nav-streak').style.display = streak > 0 ? 'flex' : 'none';
    });
  },

  // ─── LESSON PROGRESS ───
  getLessonData(n) {
    return this.get('lesson_' + n, { exerciseA: null, exerciseB: null, completed: false });
  },
  saveLessonScore(n, exercise, correct, total) {
    const data = this.getLessonData(n);
    data['exercise' + exercise.toUpperCase()] = correct + '/' + total;
    if (data.exerciseA && data.exerciseB) data.completed = true;
    this.set('lesson_' + n, data);
    if (data.completed) {
      this.addXP(50); // Lesson completion bonus
      this.checkBadges();
    }
  },
  saveLessonLevel(n, level) {
    const data = this.getLessonData(n);
    data['level' + level + '_completed'] = true;
    if (level === 3) data.mastered = true;
    this.set('lesson_' + n, data);
    this.addXP(25 * level);
    this.checkBadges();
  },
  isLessonCompleted(n) {
    return this.getLessonData(n).completed;
  },
  getCompletedCount() {
    let count = 0;
    for (let i = 1; i <= 32; i++) {
      if (this.isLessonCompleted(i)) count++;
    }
    return count;
  },

  // ─── BADGE SYSTEM ───
  badges: [
    { id: 'first_words', emoji: '📜', name: 'First Words', desc: 'Complete Lesson 1', check: p => p.isLessonCompleted(1) },
    { id: 'quick_learner', emoji: '⚡', name: 'Quick Learner', desc: '100% on any exercise first try', check: p => p.get('perfect_first_try', false) },
    { id: 'on_fire', emoji: '🔥', name: 'On Fire', desc: '7-day streak', check: p => p.getStreak() >= 7 },
    { id: 'scholar', emoji: '📖', name: 'Scholar', desc: 'Complete all 8 case lessons', check: p => { for(let i=1;i<=8;i++) if(!p.isLessonCompleted(i)) return false; return true; }},
    { id: 'vocab_master', emoji: '🧠', name: 'Vocab Master', desc: 'Master 50 vocabulary words', check: p => p.getMasteredWordCount() >= 50 },
    { id: 'perfectionist', emoji: '🎯', name: 'Perfectionist', desc: '100% on all exercises in a lesson', check: p => p.get('perfect_lesson', false) },
    { id: 'dhamma_student', emoji: '💎', name: 'Dhamma Student', desc: 'Earn 1000 XP', check: p => p.getXP() >= 1000 }
  ],
  getEarnedBadges() { return this.get('badges', []); },
  checkBadges() {
    const earned = this.getEarnedBadges();
    const newBadges = [];
    this.badges.forEach(b => {
      if (!earned.includes(b.id) && b.check(this)) {
        earned.push(b.id);
        newBadges.push(b);
      }
    });
    if (newBadges.length > 0) {
      this.set('badges', earned);
      this.renderBadges();
    }
    return newBadges;
  },
  renderBadges() {
    const earned = this.getEarnedBadges();
    document.querySelectorAll('.badges-display').forEach(container => {
      container.innerHTML = this.badges.map(b => `
        <div class="badge-item ${earned.includes(b.id) ? 'earned' : 'locked'}" title="${b.name}">
          ${b.emoji}
          <div class="badge-tooltip">${b.name}: ${b.desc}</div>
        </div>
      `).join('');
    });
  },

  // ─── VOCABULARY MASTERY ───
  getVocabData() { return this.get('vocab', {}); },
  saveVocabResult(word, correct) {
    const vocab = this.getVocabData();
    if (!vocab[word]) vocab[word] = { correct: 0, streak: 0, level: 'new', nextReview: null, interval: 1 };
    const w = vocab[word];
    if (correct) {
      w.correct++;
      w.streak++;
      w.interval = Math.min(w.interval * 2.5, 30);
      if (w.streak >= 5) w.level = 'mastered';
      else if (w.streak >= 3) w.level = 'familiar';
      else w.level = 'learning';
      this.addXP(5);
    } else {
      w.streak = 0;
      w.interval = 1;
      w.level = w.correct > 0 ? 'learning' : 'new';
    }
    const next = new Date();
    next.setDate(next.getDate() + Math.round(w.interval));
    w.nextReview = next.toISOString().split('T')[0];
    vocab[word] = w;
    this.set('vocab', vocab);
    return w;
  },
  getMasteredWordCount() {
    const vocab = this.getVocabData();
    return Object.values(vocab).filter(v => v.level === 'mastered').length;
  },
  getWordsForReview(lessonFilter) {
    const vocab = this.getVocabData();
    const today = new Date().toISOString().split('T')[0];
    return Object.entries(vocab)
      .filter(([, v]) => !v.nextReview || v.nextReview <= today)
      .sort((a, b) => (a[1].interval || 1) - (b[1].interval || 1));
  },

  // ─── DARK MODE ───
  initDarkMode() {
    const dark = this.get('dark_mode', false);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    this.updateDarkToggle();
  },
  toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      this.set('dark_mode', false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      this.set('dark_mode', true);
    }
    this.updateDarkToggle();
  },
  updateDarkToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.dark-toggle').forEach(btn => {
      btn.innerHTML = isDark ? '<svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="1em" height="1em" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>' : '<svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="1em" height="1em" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
      btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  },

  // ─── COMPLETION CEREMONY ───
  showCompletion(lessonNum, scoreA, scoreB, newBadges) {
    const overlay = document.getElementById('completion-overlay');
    if (!overlay) return;

    const xpEarned = 50 + (scoreA || 0) * 10 + (scoreB || 0) * 10;
    overlay.querySelector('.completion-eyebrow').textContent = `Lesson ${lessonNum} Complete`;
    overlay.querySelector('.cs-xp').textContent = '+' + xpEarned;

    const badgesHtml = newBadges.length > 0
      ? '<p style="font-size:12px;color:var(--saffron);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">New badges unlocked!</p>' +
        newBadges.map(b => `<span style="font-size:24px;margin:0 4px;">${b.emoji}</span>`).join('')
      : '';
    overlay.querySelector('.completion-badges').innerHTML = badgesHtml;

    const nextNum = parseInt(lessonNum) + 1;
    const nextBtn = overlay.querySelector('.completion-next');
    if (nextNum <= 8) {
      nextBtn.href = `guide-to-pali-lesson${nextNum}.html`;
      nextBtn.textContent = `Continue to Lesson ${nextNum} →`;
    } else {
      nextBtn.href = 'guide-to-pali-lessons.html';
      nextBtn.textContent = 'View All Lessons →';
    }

    overlay.classList.add('active');
    this.launchConfetti();
  },
  hideCompletion() {
    const el = document.getElementById('completion-overlay');
    if (el) el.classList.remove('active');
  },

  // ─── CONFETTI ───
  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#C8760A', '#E8972A', '#8B2500', '#B8962E', '#F5E0B0', '#D4AF50'];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 2,
        vx: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        rv: Math.random() * 6 - 3,
        opacity: 1
      });
    }

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rv;
        if (frame > 80) p.opacity -= 0.015;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 160 && pieces.some(p => p.opacity > 0)) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    draw();
  },

  // ─── UTILITIES ───
  startVocabQuiz(lessonNum) {
    window.location.href = `flashcards.html?lesson=${lessonNum}`;
  },

  // ─── INIT ───
  init() {
    this.initDarkMode();

    // ─── NAV: HAMBURGER LOGIC ───
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
      });

      // Close menu when a link is clicked
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          hamburger.classList.remove('active');
          mobileMenu.classList.remove('active');
          document.body.style.overflow = '';
        });
      });
    }

    this.updateStreak();
    this.updateXPDisplay();
    this.updateStreakDisplay();
    this.renderBadges();
    this.initScrollReveal();
    this.initWIPLinks();
    this.initNavScroll();
  },

  // ─── NAV SCROLL EFFECT ───
  initNavScroll() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    });
  },

  // ─── SCROLL REVEAL ───
  initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }});
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  },

  // ─── WIP TOAST ───
  showWIP() {
    let toast = document.querySelector('.wip-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'wip-toast';
      toast.textContent = '🚧 This section is coming soon — stay tuned!';
      document.body.appendChild(toast);
    }
    toast.classList.add('visible');
    clearTimeout(this._wipTimer);
    this._wipTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  },
  initWIPLinks() {
    document.querySelectorAll('a[href="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        this.showWIP();
      });
    });
  },
  getWordsForReview(lessonFilter) {
    const vocab = this.getVocabData();
    const today = new Date().toISOString().split('T')[0];
    return Object.entries(vocab)
      .filter(([, v]) => !v.nextReview || v.nextReview <= today)
      .sort((a, b) => (a[1].interval || 1) - (b[1].interval || 1));
  },

  // ─── DARK MODE ───
  initDarkMode() {
    const dark = this.get('dark_mode', false);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    this.updateDarkToggle();
  },
  toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      this.set('dark_mode', false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      this.set('dark_mode', true);
    }
    this.updateDarkToggle();
  },
  updateDarkToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.dark-toggle').forEach(btn => {
      btn.innerHTML = isDark ? '<svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="1em" height="1em" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>' : '<svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="1em" height="1em" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
      btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  },

  // ─── COMPLETION CEREMONY ───
  showCompletion(lessonNum, scoreA, scoreB, newBadges) {
    const overlay = document.getElementById('completion-overlay');
    if (!overlay) return;

    const xpEarned = 50 + (scoreA || 0) * 10 + (scoreB || 0) * 10;
    overlay.querySelector('.completion-eyebrow').textContent = `Lesson ${lessonNum} Complete`;
    overlay.querySelector('.cs-xp').textContent = '+' + xpEarned;

    const badgesHtml = newBadges.length > 0
      ? '<p style="font-size:12px;color:var(--saffron);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">New badges unlocked!</p>' +
        newBadges.map(b => `<span style="font-size:24px;margin:0 4px;">${b.emoji}</span>`).join('')
      : '';
    overlay.querySelector('.completion-badges').innerHTML = badgesHtml;

    const nextNum = parseInt(lessonNum) + 1;
    const nextBtn = overlay.querySelector('.completion-next');
    if (nextNum <= 8) {
      nextBtn.href = `guide-to-pali-lesson${nextNum}.html`;
      nextBtn.textContent = `Continue to Lesson ${nextNum} →`;
    } else {
      nextBtn.href = 'guide-to-pali-lessons.html';
      nextBtn.textContent = 'View All Lessons →';
    }

    overlay.classList.add('active');
    this.launchConfetti();
  },
  hideCompletion() {
    const el = document.getElementById('completion-overlay');
    if (el) el.classList.remove('active');
  },

  // ─── CONFETTI ───
  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#C8760A', '#E8972A', '#8B2500', '#B8962E', '#F5E0B0', '#D4AF50'];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 2,
        vx: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        rv: Math.random() * 6 - 3,
        opacity: 1
      });
    }

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rv;
        if (frame > 80) p.opacity -= 0.015;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 160 && pieces.some(p => p.opacity > 0)) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    draw();
  },

  // ─── UTILITIES ───
  startVocabQuiz(lessonNum) {
    window.location.href = `flashcards.html?lesson=${lessonNum}`;
  },

  // ─── INIT ───
  init() {
    this.initDarkMode();

    // ─── NAV: HAMBURGER LOGIC ───
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
      });

      // Close menu when a link is clicked
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          hamburger.classList.remove('active');
          mobileMenu.classList.remove('active');
          document.body.style.overflow = '';
        });
      });
    }

    this.updateStreak();
    this.updateXPDisplay();
    this.updateStreakDisplay();
    this.renderBadges();
    this.initScrollReveal();
    this.initWIPLinks();
    this.initNavScroll();
  },

  // ─── NAV SCROLL EFFECT ───
  initNavScroll() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    });
  },

  // ─── SCROLL REVEAL ───
  initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }});
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  },

  // ─── WIP TOAST ───
  showWIP() {
    let toast = document.querySelector('.wip-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'wip-toast';
      toast.textContent = '🚧 This section is coming soon — stay tuned!';
      document.body.appendChild(toast);
    }
    toast.classList.add('visible');
    clearTimeout(this._wipTimer);
    this._wipTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  },
  initWIPLinks() {
    document.querySelectorAll('a[href="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        this.showWIP();
      });
    });
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => PaliProgress.init());
