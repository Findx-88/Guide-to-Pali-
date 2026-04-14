/* ═══ SHARED EXERCISE ENGINE FOR ALL LESSONS ═══ */

function normalise(str) {
  return str.trim().toLowerCase()
    .replace(/[āa]/g,'a').replace(/[īi]/g,'i').replace(/[ūu]/g,'u')
    .replace(/[ṃṅñṇṭḍḷ]/g, c => ({ṃ:'m',ṅ:'n',ñ:'n',ṇ:'n',ṭ:'t',ḍ:'d',ḷ:'l'}[c]||c))
    .replace(/\s+/g,' ').replace(/[.!?]$/, '');
}

function isCorrect(input, idx, ex) {
  const norm = normalise(input);
  const ansObj = window.lessonAnswers[ex]?.[idx];
  if (!ansObj) return false;
  if (normalise(ansObj.main) === norm) return true;
  if (ansObj.alts && ansObj.alts.some(a => normalise(a) === norm)) return true;
  return false;
}

function checkItem(btn, ex) {
  const item = btn.closest('.ex-item');
  const items = [...document.querySelectorAll(`#exercise-${ex}-items .ex-item`)];
  const idx = items.indexOf(item);
  const input = item.querySelector('.ex-input');
  const fb = item.querySelector('.ex-feedback');
  const val = input.value.trim();
  if (!val) return;

  const correct = isCorrect(val, idx, ex);
  const correctAnswer = window.lessonAnswers[ex]?.[idx]?.main || '';

  item.classList.remove('correct','wrong');
  input.classList.remove('correct-input','wrong-input');
  fb.classList.remove('visible','correct-fb','wrong-fb');
  void item.offsetWidth;

  if (correct) {
    item.classList.add('correct');
    input.classList.add('correct-input');
    fb.innerHTML = `<span>✓</span> <span class="fb-answer">Correct!</span>`;
    fb.classList.add('visible','correct-fb');
    PaliProgress.addXP(10);
  } else {
    item.classList.add('wrong');
    input.classList.add('wrong-input');
    fb.innerHTML = `<span>✗</span> <span>Answer: </span><span class="fb-answer">${correctAnswer}</span>`;
    fb.classList.add('visible','wrong-fb');
  }
  updateScore(ex);
}

function checkAll(ex) {
  const items = [...document.querySelectorAll(`#exercise-${ex}-items .ex-item`)];
  items.forEach((item) => {
    const input = item.querySelector('.ex-input');
    if (input.value.trim()) checkItem(item.querySelector('.ex-check-btn'), ex);
  });
  updateScore(ex);

  // Save to progress
  const correct = items.filter(i => i.classList.contains('correct')).length;
  PaliProgress.saveLessonScore(window.currentLesson, ex, correct, items.length);

  // Check for perfect first try
  if (correct === items.length) {
    PaliProgress.set('perfect_first_try', true);
    const otherEx = ex === 'a' ? 'b' : 'a';
    const otherItems = [...document.querySelectorAll(`#exercise-${otherEx}-items .ex-item`)];
    const otherCorrect = otherItems.filter(i => i.classList.contains('correct')).length;
    if (otherCorrect === otherItems.length) {
      PaliProgress.set('perfect_lesson', true);
    }
  }

  // Check completion
  if (ex === 'b') checkCompletion();
}

function clearFeedback(input) {
  const item = input.closest('.ex-item');
  item.classList.remove('correct','wrong');
  input.classList.remove('correct-input','wrong-input');
  const fb = item.querySelector('.ex-feedback');
  fb.classList.remove('visible','correct-fb','wrong-fb');
}

function resetExercise(ex) {
  document.querySelectorAll(`#exercise-${ex}-items .ex-item`).forEach(item => {
    item.querySelector('.ex-input').value = '';
    clearFeedback(item.querySelector('.ex-input'));
  });
  document.getElementById(`score-${ex}`).textContent = '—';
}

function updateScore(ex) {
  const items = [...document.querySelectorAll(`#exercise-${ex}-items .ex-item`)];
  const correct = items.filter(i => i.classList.contains('correct')).length;
  const answered = items.filter(i => i.querySelector('.ex-input').value.trim()).length;
  document.getElementById(`score-${ex}`).textContent = answered === 0 ? '—' : `${correct} / ${items.length}`;
}

function checkCompletion() {
  const itemsA = [...document.querySelectorAll('#exercise-a-items .ex-item')];
  const itemsB = [...document.querySelectorAll('#exercise-b-items .ex-item')];
  const correctA = itemsA.filter(i => i.classList.contains('correct')).length;
  const correctB = itemsB.filter(i => i.classList.contains('correct')).length;
  const allDone = correctB === itemsB.length && correctA === itemsA.length;

  if (allDone) {
    const newBadges = PaliProgress.checkBadges();
    PaliProgress.showCompletion(window.currentLesson, correctA, correctB, newBadges);
  }
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.ex-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const btn = input.closest('.ex-item').querySelector('.ex-check-btn');
        const ex = input.closest('[id]')?.id?.includes('exercise-b') ? 'b' : 'a';
        checkItem(btn, ex);
      }
    });
  });

  // Strip tab observer
  const stripTabs = document.querySelectorAll('.strip-tab');
  const sections = document.querySelectorAll('.lesson-section[id]');
  if (stripTabs.length && sections.length) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          stripTabs.forEach(t => t.classList.toggle('active', t.getAttribute('href') === '#' + id));
          // Update learning path steps
          document.querySelectorAll('.path-step').forEach(s => {
            s.classList.toggle('active', s.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(s => sectionObserver.observe(s));
  }

  // Revision quiz click handler
  document.querySelectorAll('.revision-q').forEach(q => {
    q.addEventListener('click', () => {
      q.classList.toggle('show-answer');
      q.classList.add('answered-correct');
    });
  });
});
