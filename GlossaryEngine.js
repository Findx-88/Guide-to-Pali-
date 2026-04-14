/* ═══════════════════════════════════════════════════════════
   GUIDE TO PĀLI — GLOSSARY ENGINE
   Dynamic harvester for Vocabulary Master page
   ═══════════════════════════════════════════════════════════ */

const GlossaryEngine = {
    allWords: [],
    allExamples: [],
    sources: [
        'guide-to-pali-lesson1.html',
        'guide-to-pali-lesson2.html',
        'guide-to-pali-lesson3.html',
        'guide-to-pali-lesson4.html',
        'guide-to-pali-lesson5.html',
        'guide-to-pali-lesson6.html',
        'guide-to-pali-lesson7.html',
        'guide-to-pali-lesson8.html'
    ],
    // ─── EMBEDDED VOCABULARY DATABASE ───
    // Words from all 8 lessons, so the page works without fetch (file:// compatible)
    vocabDB: [
        // Lesson 1 — Nouns
        {pali:"nara",english:"man",lesson:1},
        {pali:"kassaka",english:"farmer",lesson:1},
        {pali:"brāhmaṇa",english:"brahmin",lesson:1},
        {pali:"mātula",english:"uncle",lesson:1},
        {pali:"kumāra",english:"boy",lesson:1},
        {pali:"vāṇija",english:"merchant",lesson:1},
        {pali:"bhūpāla",english:"king",lesson:1},
        {pali:"mitta",english:"friend",lesson:1},
        {pali:"Buddha",english:"the Buddha",lesson:1},
        {pali:"putta",english:"son",lesson:1},
        // Lesson 1 — Verbs
        {pali:"gacchati",english:"goes",lesson:1},
        {pali:"āgacchati",english:"comes",lesson:1},
        {pali:"passati",english:"sees",lesson:1},
        {pali:"nisīdati",english:"sits",lesson:1},
        {pali:"bhāsati",english:"speaks",lesson:1},
        {pali:"vasati",english:"lives, dwells",lesson:1},
        {pali:"pacati",english:"cooks",lesson:1},
        {pali:"kasati",english:"ploughs",lesson:1},
        // Lesson 2 — Verbs
        {pali:"rakkhati",english:"protects",lesson:2},
        {pali:"vandati",english:"salutes, worships",lesson:2},
        {pali:"harati",english:"carries, takes away",lesson:2},
        {pali:"āharati",english:"brings",lesson:2},
        {pali:"paharati",english:"hits, strikes",lesson:2},
        {pali:"āruhati",english:"climbs, ascends",lesson:2},
        {pali:"khanati",english:"digs",lesson:2},
        // Lesson 2 — Nouns
        {pali:"dhamma",english:"the doctrine, truth",lesson:2},
        {pali:"gāma",english:"village",lesson:2},
        {pali:"rukkha",english:"tree",lesson:2},
        {pali:"pabbata",english:"mountain",lesson:2},
        {pali:"vihāra",english:"monastery",lesson:2},
        {pali:"patta",english:"bowl",lesson:2},
        {pali:"odana",english:"rice, cooked rice",lesson:2},
        {pali:"kukkura",english:"dog",lesson:2},
        {pali:"sigāla",english:"jackal",lesson:2},
        {pali:"yācaka",english:"beggar",lesson:2},
        // Lesson 3
        {pali:"ratha",english:"chariot, vehicle",lesson:3},
        {pali:"sakaṭa",english:"cart",lesson:3},
        {pali:"hattha",english:"hand",lesson:3},
        {pali:"pāda",english:"foot",lesson:3},
        {pali:"magga",english:"path, road",lesson:3},
        {pali:"dīpa",english:"island, lamp",lesson:3},
        {pali:"sāvaka",english:"disciple",lesson:3},
        {pali:"samaṇa",english:"monk, recluse",lesson:3},
        {pali:"sagga",english:"heaven",lesson:3},
        {pali:"assa",english:"horse",lesson:3},
        {pali:"miga",english:"deer",lesson:3},
        {pali:"pāsāṇa",english:"rock, stone",lesson:3},
        // Lesson 4
        {pali:"pāsāda",english:"palace",lesson:4},
        {pali:"maccha",english:"fish",lesson:4},
        {pali:"piṭaka",english:"basket",lesson:4},
        {pali:"amacca",english:"minister",lesson:4},
        {pali:"dāraka",english:"child, boy",lesson:4},
        {pali:"sopāna",english:"stairway",lesson:4},
        {pali:"sappa",english:"serpent",lesson:4},
        {pali:"suka",english:"parrot",lesson:4},
        {pali:"patati",english:"falls",lesson:4},
        {pali:"icchati",english:"wishes, desires",lesson:4},
        {pali:"pucchati",english:"asks, questions",lesson:4},
        {pali:"nikkhamati",english:"leaves, sets out",lesson:4},
        {pali:"otarati",english:"descends",lesson:4},
        // Lesson 5
        {pali:"tāpasa",english:"hermit",lesson:5},
        {pali:"ācariya",english:"teacher",lesson:5},
        {pali:"vejja",english:"doctor",lesson:5},
        {pali:"sīha",english:"lion",lesson:5},
        {pali:"luddaka",english:"hunter",lesson:5},
        {pali:"aja",english:"goat",lesson:5},
        {pali:"vānara",english:"monkey",lesson:5},
        {pali:"lābha",english:"profit, gain",lesson:5},
        {pali:"mañca",english:"bed",lesson:5},
        {pali:"kuddāla",english:"hoe",lesson:5},
        {pali:"rodati",english:"cries",lesson:5},
        {pali:"hasati",english:"laughs, smiles",lesson:5},
        {pali:"labhati",english:"gets, receives",lesson:5},
        // Lesson 6
        {pali:"narassa",english:"of the man (gen. sg.)",lesson:6},
        {pali:"narānaṃ",english:"of men (gen. pl.)",lesson:6},
        // Lesson 7
        {pali:"narasmiṃ",english:"in/at the man (loc. sg.)",lesson:7},
        {pali:"naresu",english:"in/among men (loc. pl.)",lesson:7},
        // Lesson 8 — Neuter nouns
        {pali:"phala",english:"fruit (neuter)",lesson:8},
        {pali:"nayana",english:"eye (neuter)",lesson:8},
        {pali:"nagara",english:"city (neuter)",lesson:8},
        {pali:"udaka",english:"water (neuter)",lesson:8},
        {pali:"citta",english:"mind (neuter)",lesson:8},
    ],

    async init() {
        console.log("GlossaryEngine: Initializing...");
        // Use embedded database directly
        this.allWords = [...this.vocabDB];
        this.allWords.sort((a, b) => a.pali.localeCompare(b.pali));
        
        // Try to harvest examples from lesson files (works on server, gracefully fails on file://)
        await this.harvestExamples();
        
        this.render();
        this.loadAlphabet();
        console.log(`GlossaryEngine: Loaded ${this.allWords.length} words and ${this.allExamples.length} examples.`);
    },

    async harvestExamples() {
        const fetchPromises = this.sources.map(async (url, index) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return [];
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const exRows = doc.querySelectorAll('.example-row');
                return [...exRows].map(row => {
                    const paliEl = row.querySelector('.ex-pali');
                    const engEl = row.querySelector('.ex-english');
                    if (!paliEl || !engEl) return null;
                    return { pali: paliEl.textContent.trim(), english: engEl.textContent.trim(), lesson: index + 1 };
                }).filter(e => e !== null);
            } catch (e) {
                // Silently fail — file:// or network error
                return [];
            }
        });

        try {
            const results = await Promise.all(fetchPromises);
            this.allExamples = results.flat();
        } catch (e) {
            this.allExamples = [];
        }
    },

    normalizePali(text) {
        return text.toLowerCase()
            .replace(/[āā]/g, 'a')
            .replace(/[īī]/g, 'i')
            .replace(/[ūū]/g, 'u')
            .replace(/[ṅñṇ]/g, 'n')
            .replace(/[ṭḍḷ]/g, 'l')
            .replace(/[ṃ]/g, 'm')
            .trim();
    },

    findExample(word, lesson) {
        const normWord = this.normalizePali(word);
        
        // Create a stem for generous matching:
        // 'gacchati' -> 'gacch'
        // 'putta' -> 'putt'
        let stem = normWord;
        if (stem.endsWith('ati')) {
            stem = stem.slice(0, -3); 
        } else if (stem.endsWith('a') || stem.endsWith('i') || stem.endsWith('u')) {
            stem = stem.slice(0, -1);
        }
        if (stem.length < 2) stem = normWord; // To avoid matching everything for very short roots

        const checkMatch = (ex) => {
            const exWords = this.normalizePali(ex.pali)
                .replace(/[.,!?]/g, '')
                .split(/\s+/);
            
            // Check exact first
            if (exWords.includes(normWord)) return true;
            // Check stem
            return exWords.some(w => w.startsWith(stem) && Math.abs(w.length - normWord.length) <= 4);
        };

        // Preference 1: Same lesson
        let match = this.allExamples.find(ex => ex.lesson === lesson && checkMatch(ex));
        
        return match;
    },

    toggleCard(cardEl, word, lesson) {
        const isActive = cardEl.classList.contains('active');
        
        // Close others
        document.querySelectorAll('.v-card.active').forEach(c => c.classList.remove('active'));
        
        if (!isActive) {
            cardEl.classList.add('active');
            const drawer = cardEl.querySelector('.v-example-drawer');
            
            // Only populate if empty
            if (drawer.innerHTML === '') {
                const ex = this.findExample(word, lesson);
                if (ex) {
                    drawer.innerHTML = `
                        <div class="v-ex-label">Example from Lesson ${ex.lesson}</div>
                        <div class="v-ex-pali">${ex.pali}</div>
                        <div class="v-ex-eng">${ex.english}</div>
                    `;
                } else {
                    drawer.innerHTML = `<div class="v-ex-eng" style="opacity:0.6">No simple example found for this word yet.</div>`;
                }
            }
        }
    },

    render(filterQuery = '') {
        const grid = document.getElementById('grid-chapter-1');
        if (!grid) return;

        const query = filterQuery.toLowerCase().trim();
        const normQuery = this.normalizePali(query);
        
        const filtered = this.allWords.filter(w => {
            const normPali = this.normalizePali(w.pali);
            return w.pali.toLowerCase().includes(query) || 
                   normPali.includes(normQuery) ||
                   w.english.toLowerCase().includes(query);
        });

        if (filtered.length === 0 && this.allWords.length > 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--ink-muted);">No words found matching "${filterQuery}"</div>`;
            return;
        }

        grid.innerHTML = filtered.map(w => `
            <div class="v-card" onclick="GlossaryEngine.toggleCard(this, '${w.pali.replace(/'/g, "\\'")}', ${w.lesson})">
                <div class="v-lesson-tag">Less. ${w.lesson}</div>
                <div class="v-pali">${w.pali}</div>
                <div class="v-eng">${w.english}</div>
                <div class="v-example-drawer"></div>
            </div>
        `).join('');
    },

    filter() {
        const input = document.getElementById('master-search');
        if (input) this.render(input.value);
    },

    async loadAlphabet() {
        try {
            const response = await fetch('index.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const alphaContent = doc.querySelector('.alphabet-row');
            if (alphaContent) {
                const target = document.getElementById('alphabet-target');
                if (target) target.innerHTML = alphaContent.innerHTML;
            }
        } catch (e) {
            console.error("Failed to load alphabet reference", e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => GlossaryEngine.init());
