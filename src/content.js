// Function hanala Niqqud ho an'ny fikarohana
function normalizeHebrew(str) { 
    return str ? str.replace(/[\u0591-\u05C7]/g, "").normalize("NFC").toLowerCase() : ""; 
}

// Global UI Translation helper
function getT(key, fallback) {
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    if (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS.ui && window.APP_TRANSLATIONS.ui[key]) {
        return window.APP_TRANSLATIONS.ui[key][lang] || fallback;
    }
    return fallback;
}

// Function to translate Pronounce button label dynamically
function getPronounceLabel() {
    return getT('reader_listen_btn', 'Henoy');
}

window.currentSpeakingText = null;

// New safe global event handlers to completely prevent HTML string quote breaking syntax errors
window.handleToggleFavoriteLesson = function(btn, event) {
    if (event) event.stopPropagation();
    const title = decodeURIComponent(btn.getAttribute('data-title') || '');
    const niveau = decodeURIComponent(btn.getAttribute('data-niveau') || '');
    const lessonNum = decodeURIComponent(btn.getAttribute('data-lesson-num') || '');
    const frenchTitle = decodeURIComponent(btn.getAttribute('data-french-title') || '');
    const malagasyTitle = decodeURIComponent(btn.getAttribute('data-malagasy-title') || '');
    window.toggleFavoriteLesson(title, niveau, lessonNum, frenchTitle, malagasyTitle, btn);
};

window.handleRenderFullLesson = function(btn, event) {
    if (event) event.stopPropagation();
    const title = decodeURIComponent(btn.getAttribute('data-title') || '');
    const niveau = decodeURIComponent(btn.getAttribute('data-niveau') || '');
    window.renderFullLesson(window.allData, title, niveau);
};

window.handleRemoveSingleDifficultWord = function(btn) {
    const hebrew = decodeURIComponent(btn.getAttribute('data-hebrew') || '');
    window.removeSingleDifficultWord(hebrew);
};

// Speech synthesis function using the native Web Speech API (offline compatible)
window.speakHebrew = function(text, btnElement) {
    if (!text) return;
    if (!window.speechSynthesis) {
        if (window.showToast) window.showToast("Tsy zakan'ity browser ity ny famakiana feo.", "error");
        else console.warn("Tsy zakan'ity browser ity ny famakiana feo.");
        return;
    }

    // Support calling as: window.speakHebrew(this, event)
    let actualText = text;
    let actualBtn = btnElement;
    if (typeof text !== 'string' && text && text.getAttribute) {
        actualBtn = text;
        actualText = decodeURIComponent(actualBtn.getAttribute('data-text') || '');
    }

    if (!actualText) return;

    // If currently speaking, toggle or stop
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (window.currentSpeakingText === actualText) {
            window.currentSpeakingText = null;
            window.updateSpeechButtons();
            return;
        }
    }

    window.currentSpeakingText = actualText;

    // Helper to pre-process Biblical/literary Hebrew text for standard Modern Hebrew TTS engine.
    // This preserves correct phonetics for classical literary/Biblical words like "אַתְּ", "שָׁמัעְתְּ", etc.
    let ttsText = actualText;
    if (ttsText) {
        // 1. Translate the Tetragrammaton (יְהוָה / יהוה) to "אֲדֹנָי" (Adonai) for pronunciation,
        // which is the traditional and grammatically correct way to read it in literary/Biblical Hebrew.
        ttsText = ttsText.replace(/יְהוָה/g, "אֲדֹנָי");
        ttsText = ttsText.replace(/יהוה/g, "אֲדֹנָי");

        // 2. Remove cantillation marks (accents / tropes: \u0591 to \u05AF)
        // These are musical notation signs used in Biblical texts, but they interfere with
        // modern browser TTS engines and cause them to stutter, mispronounce, or ignore words.
        ttsText = ttsText.replace(/[\u0591-\u05AF]/g, "");

        // 3. Fix the specific word "אַתְּ" (feminine singular "you", pronounced /at/).
        // TTS engines often misread the combination of Tav + Dagesh + final Sheva as "ATE" or "AT-e".
        // Removing the final Sheva from "אַתְּ" leaves "אַתּ", which forces the engine to pronounce "AT" perfectly.
        // Let's do this for occurrences of "אַתְּ" (with/without dagesh).
        // "אַתְּ" characters are: \u05D0\u05B7\u05EA\u05BC\u05B0 (Alef + Patah + Tav + Dagesh + Sheva)
        ttsText = ttsText.replace(/\u05D0\u05B7\u05EA\u05BC\u05B0/g, "\u05D0\u05B7\u05EA");
        ttsText = ttsText.replace(/\u05D0\u05B7\u05EA\u05B0/g, "\u05D0\u05B7\u05EA");

        // 4. General rule for "sheva quiescens / sheva farateny" (silent sheva) at the end of words.
        // In Biblical Hebrew, sheva is always silent when it occurs at the end of a word (e.g. "קָטַלְתְּ" -> "qatalt", "בֵּיתֵךְ" -> "beitekh").
        // If we strip the sheva (\u05B0) from the last Hebrew letter of any word, the engine reads it correctly as silent.
        // A sheva is at the end of a word if it is not followed by a Hebrew character (range \u0590-\u05FF).
        ttsText = ttsText.replace(/\u05B0(?=[^\u0590-\u05FF]|$)/g, "");

        // 5. Remove Dagesh / Mapiq (\u05BC) from all letters.
        // Modern Hebrew TTS engines often mispronounce letters with a Dagesh (gemination dot),
        // treating them as separate syllables or spelling/pronouncing them awkwardly (e.g. "דַּקָּה" pronounced as "deaqah" instead of "daqah").
        // Since consonant gemination is not phonetically active in Modern Hebrew, and the TTS engine's
        // lookup dictionary is optimized for unpointed text or text without gemination marks,
        // removing the dagesh solves these phonetic glitches completely while preserving standard vowels (Patah, Qamats, etc.).
        ttsText = ttsText.replace(/\u05BC/g, "");

        // 6. Remove Shin and Sin Dots (\u05C1 and \u05C2) and Meteg (\u05BD).
        // These dots are also combining diacritics that can confuse speech synthesis word-lookup engines.
        ttsText = ttsText.replace(/[\u05C1\u05C2\u05BD]/g, "");

        // 7. Replace Biblical Hebrew Maqaf (hyphen-like connector, \u05BE) with a regular space
        // to help the browser speech synthesis engine treat them as separate words and pace them naturally.
        ttsText = ttsText.replace(/\u05BE/g, " ");
    }

    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.lang = 'he-IL';

    // Find first Hebrew voice if loaded
    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find(v => v.lang.startsWith('he'));
    if (heVoice) {
        utterance.voice = heVoice;
    }
    
    // Set natural slower speed for pronunciation learning
    utterance.rate = 0.8;

    utterance.onstart = () => {
        window.updateSpeechButtons();
    };

    utterance.onend = () => {
        if (window.currentSpeakingText === actualText) {
            window.currentSpeakingText = null;
        }
        window.updateSpeechButtons();
    };

    utterance.onerror = () => {
        if (window.currentSpeakingText === actualText) {
            window.currentSpeakingText = null;
        }
        window.updateSpeechButtons();
    };

    window.speechSynthesis.speak(utterance);
};

// Update play/stop icons across all rendered cards dynamically
window.updateSpeechButtons = function() {
    const current = window.currentSpeakingText;
    document.querySelectorAll('.speech-btn').forEach(btn => {
        const text = decodeURIComponent(btn.getAttribute('data-text') || '');
        const iconContainer = btn.querySelector('.speech-icon-container');
        const textContainer = btn.querySelector('.speech-text-container');
        if (iconContainer) {
            if (current && current === text) {
                // Showing stop square
                iconContainer.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" class="text-red-500 animate-pulse">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                `;
                if (textContainer) {
                    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
                    textContainer.innerText = lang === 'mg' ? 'Hajanona' : (lang === 'fr' ? 'Arrêter' : 'עצור');
                }
            } else {
                // Showing play speaker
                iconContainer.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                `;
                if (textContainer) {
                    textContainer.innerText = getPronounceLabel();
                }
            }
        }
    });
};

// Continuous sequence reader states
window.isPlayingFullLesson = false;
window.currentPlayIndex = -1;
window.lessonPlaylist = [];
window.lessonSpeechTimeout = null;

window.playNextPlaylistItem = function() {
    if (!window.isPlayingFullLesson) return;
    
    // Clear all previous active highlighting
    document.querySelectorAll('.reader-card-highlight').forEach(el => {
        el.classList.remove('reader-card-highlight', 'ring-2', 'ring-textPrimary', 'scale-[1.01]', 'bg-bgSecondary/20', 'shadow-md');
    });

    if (window.currentPlayIndex < 0 || window.currentPlayIndex >= window.lessonPlaylist.length) {
        window.stopSpeakingFullLesson();
        return;
    }

    const item = window.lessonPlaylist[window.currentPlayIndex];
    
    // Highlight the active word card
    const cardEl = document.getElementById(item.id);
    if (cardEl) {
        cardEl.classList.add('reader-card-highlight', 'ring-2', 'ring-textPrimary', 'scale-[1.01]', 'bg-bgSecondary/20', 'shadow-md');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    let ttsText = item.text;
    if (ttsText) {
        ttsText = ttsText.replace(/יְהוָה/g, "אֲדֹנָי").replace(/יהוה/g, "אֲדֹנָי");
        ttsText = ttsText.replace(/[\u0591-\u05AF]/g, "");
        ttsText = ttsText.replace(/\u05D0\u05B7\u05EA\u05BC\u05B0/g, "\u05D0\u05B7\u05EA");
        ttsText = ttsText.replace(/\u05D0\u05B7\u05EA\u05B0/g, "\u05D0\u05B7\u05EA");
        ttsText = ttsText.replace(/\u05B0(?=[^\u0590-\u05FF]|$)/g, "");
        ttsText = ttsText.replace(/\u05BC/g, "");
        ttsText = ttsText.replace(/[\u05C1\u05C2\u05BD]/g, "");
        ttsText = ttsText.replace(/\u05BE/g, " ");
    }

    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.lang = 'he-IL';
    
    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find(v => v.lang.startsWith('he'));
    if (heVoice) {
        utterance.voice = heVoice;
    }
    
    utterance.rate = 0.75; // Slower speed to help pronunciation comprehension

    utterance.onend = () => {
        if (window.isPlayingFullLesson) {
            window.currentPlayIndex++;
            window.lessonSpeechTimeout = setTimeout(() => {
                window.playNextPlaylistItem();
            }, 1000); // 1s pause between words
        }
    };

    utterance.onerror = () => {
        if (window.isPlayingFullLesson) {
            window.currentPlayIndex++;
            window.playNextPlaylistItem();
        }
    };

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
};

window.stopSpeakingFullLesson = function() {
    window.isPlayingFullLesson = false;
    window.currentPlayIndex = -1;
    window.lessonPlaylist = [];
    if (window.lessonSpeechTimeout) clearTimeout(window.lessonSpeechTimeout);
    
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    // Clean up highlights
    document.querySelectorAll('.reader-card-highlight').forEach(el => {
        el.classList.remove('reader-card-highlight', 'ring-2', 'ring-textPrimary', 'scale-[1.01]', 'bg-bgSecondary/20', 'shadow-md');
    });

    // Reset Play Button UI
    const btn = document.getElementById('lesson-play-all-btn');
    if (btn) {
        const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
        let label = 'Henoy ny lesona feno';
        if (lang === 'fr') label = 'Écouter toute la leçon';
        if (lang === 'he') label = 'האזן לכל השיעור';

        const iconContainer = btn.querySelector('.play-all-icon');
        if (iconContainer) {
            iconContainer.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
        }
        const textContainer = btn.querySelector('.play-all-text-container');
        if (textContainer) {
            textContainer.innerText = label;
        }
        btn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');
        btn.classList.add('bg-textPrimary', 'text-bgCard', 'hover:bg-textSecondary', 'hover:text-textPrimary');
    }
};

window.togglePlayEntireLesson = function(encodedTitle) {
    if (!window.speechSynthesis) {
        if (window.showToast) window.showToast("Tsy zakan'ity browser ity ny famakiana feo.", "error");
        return;
    }

    if (window.isPlayingFullLesson) {
        window.stopSpeakingFullLesson();
        return;
    }

    const title = decodeURIComponent(encodedTitle);
    const data = window.allData || [];
    const info = data.find(i => i.PhoneticTitle === title);
    if (!info) return;

    const filteredData = data.filter(i => i.PhoneticTitle === title);
    const cats = [...new Set(filteredData.map(i => i.Category).filter(i => i))];
    
    window.lessonPlaylist = [];
    if (info.HebrewTitle) {
        window.lessonPlaylist.push({
            text: info.HebrewTitle,
            id: 'lesson-header-hebrew-card'
        });
    }

    let plIdx = 0;
    cats.forEach(cat => {
        filteredData.filter(i => i.Category === cat).forEach(row => {
            if (row.Hebrew) {
                window.lessonPlaylist.push({
                    text: row.Hebrew,
                    id: `reader-card-${plIdx}`
                });
            }
            plIdx++;
        });
    });

    if (window.lessonPlaylist.length === 0) return;

    // Terminate any standard individual word playback
    window.currentSpeakingText = null;
    window.updateSpeechButtons();

    window.isPlayingFullLesson = true;
    window.currentPlayIndex = 0;

    // Update Play Button UI to active/Stop mode
    const btn = document.getElementById('lesson-play-all-btn');
    if (btn) {
        const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
        let label = 'Hajanona';
        if (lang === 'fr') label = 'Arrêter';
        if (lang === 'he') label = 'עצור';

        const iconContainer = btn.querySelector('.play-all-icon');
        if (iconContainer) {
            iconContainer.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="animate-pulse">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
            `;
        }
        const textContainer = btn.querySelector('.play-all-text-container');
        if (textContainer) {
            textContainer.innerText = label;
        }
        btn.classList.remove('bg-textPrimary', 'text-bgCard', 'hover:bg-textSecondary', 'hover:text-textPrimary');
        btn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');
    }

    window.playNextPlaylistItem();
};

// Warm up SpeechSynthesis voices array
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
            window.updateSpeechButtons();
        };
    }
}

// Generate the pronunciation button HTML template cleanly
function renderSpeechBtn(text, useStopPropagation = false) {
    if (!text) return '';
    const stopProp = useStopPropagation ? 'event.stopPropagation();' : '';
    return `
        <div class="my-2.5 flex justify-center">
            <button onclick="${stopProp} window.speakHebrew(this)" class="speech-btn inline-flex items-center gap-1.5 px-3 py-1 bg-bgSecondary/60 hover:bg-bgSecondary text-textPrimary rounded-full text-[11px] font-mono border border-borderColor/60 cursor-pointer transition-all hover:scale-105 active:scale-95" data-text="${encodeURIComponent(text)}">
                <span class="speech-icon-container flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                </span>
                <span class="speech-text-container">${getPronounceLabel()}</span>
            </button>
        </div>
    `;
}

// Variables hitahiry ny toerana misy ny mpampiasa
window.currentView = 'levels'; 
window.currentNiveau = null;
window.currentTitle = null;

function initNavigation(data) {
    window.allData = data;
    window.renderLevels = renderLevels;
    window.renderLessons = renderLessons;
    window.renderFullLesson = renderFullLesson;

    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.oninput = (e) => {
            const query = normalizeHebrew(e.target.value);
            const container = document.getElementById('lesson-container');
            
            if (query.length < 2) { 
                if (window.currentView === 'levels') renderLevels(window.allData);
                else if (window.currentView === 'lessons') renderLessons(window.allData, window.currentNiveau);
                else if (window.currentView === 'fullLesson') renderFullLesson(window.allData, window.currentTitle, window.currentNiveau);
                return; 
            }

            let results = window.allData;
            if (window.currentView === 'lessons') results = window.allData.filter(i => i.Niveau === window.currentNiveau);
            else if (window.currentView === 'fullLesson') results = window.allData.filter(i => i.PhoneticTitle === window.currentTitle);

            const filtered = results.filter(i => 
                normalizeHebrew(i.Hebrew || "").includes(query) || 
                normalizeHebrew(i.Phonetic || "").includes(query) ||
                (i.French || "").toLowerCase().includes(query) || 
                (i.Malagasy || "").toLowerCase().includes(query)
            );

            let html = '';
            if (filtered.length === 0) {
                html = `
                <div style="text-align:center; margin-top: 40px; padding: 20px;">
                    <p style="font-size: 1.125rem; font-style: italic; color: var(--text-secondary);">${getT('no_results', "Tsy misy ato ny voambolana nokarohinao.")}</p>
                </div>`;
            } else {
                html = `<h2 style="text-align:center; margin-top: 20px; margin-bottom: 20px;">${getT('search_results', "Valin'ny fikarohana")}</h2>`;
                filtered.forEach(row => {
                    const isStarred = window.isWordDifficult && window.isWordDifficult(row.Hebrew);
                    html += `
                    <div class="card relative" style="text-align:center;">
                        <button onclick="window.toggleDifficultWord('${encodeURIComponent(JSON.stringify(row))}', this)" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-yellow-500 transition-colors cursor-pointer z-10" title="Teny sarotra">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isStarred ? 'fill-yellow-500 text-yellow-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </button>
                        <p class="hebrew-text">${row.Hebrew || ''}</p>
                        ${row.Hebrew ? renderSpeechBtn(row.Hebrew) : ''}
                        <p class="phonetic-text text-textSecondary/80 tracking-wide mt-1">${row.Phonetic || ''}</p>
                        <p class="french-text text-textPrimary mt-1">${row.French || ''}</p>
                        <p class="malagasy-text text-textPrimary mt-1">${row.Malagasy || ''}</p>
                    </div>`;
                });
            }
            container.innerHTML = html;
            window.updateSpeechButtons();
        };
    }
}

function renderLevels(data) {
    window.currentView = 'levels';
    const container = document.getElementById('lesson-container');
    let html = `<h2 style='text-align:center; margin-top: 20px;'>${getT('choose_level_label', 'Fidio ny Sokajy hianarana')}</h2>`;
    
    const niveaux = data.reduce((acc, curr) => {
        if (curr.Niveau && !acc.includes(curr.Niveau)) acc.push(curr.Niveau);
        return acc;
    }, []);

    niveaux.forEach(n => {
        html += `
        <div class="card" style="text-align:center; cursor:pointer;" onclick="renderLessons(window.allData, '${n}')">
            <h3>${getT('level_label', 'Sokajy')} ${n}</h3>
        </div>`;
    });
    container.innerHTML = html;
}

function renderLessons(data, niveau) {
    window.currentView = 'lessons';
    window.currentNiveau = niveau;
    const container = document.getElementById('lesson-container');
    let html = `
        <h2 style="text-align:center; cursor:pointer; color:#4caf50; margin-top: 20px; padding-bottom: 10px;" 
            onclick="renderLevels(window.allData)">${getT('level_label', 'Sokajy')} ${niveau}
        </h2>`;
    
    // Sivana, alahatra (sort) araka ny laharan'ny lesona, dia alaina ny unique
    const titles = data
        .filter(i => i.Niveau === niveau)
        .sort((a, b) => (parseInt(a.Lesson) || 0) - (parseInt(b.Lesson) || 0))
        .reduce((acc, curr) => {
            if (curr.PhoneticTitle && !acc.find(item => item.PhoneticTitle === curr.PhoneticTitle)) {
                acc.push(curr);
            }
            return acc;
        }, []);

    titles.forEach(info => {
        html += `
        <div class="card" style="text-align:center; cursor:pointer;" onclick="window.handleRenderFullLesson(this, event)" data-title="${encodeURIComponent(info.PhoneticTitle)}" data-niveau="${encodeURIComponent(niveau)}">
            <p>${getT('lesson_label', 'Lesona')} ${info.Lesson||''}</p>
            <p class="hebrew-text">${info.HebrewTitle||''}</p>
            ${info.HebrewTitle ? renderSpeechBtn(info.HebrewTitle, true) : ''}
            <p style="color: #666;">${info.PhoneticTitle||''}</p>
        </div>`;
    });
    container.innerHTML = html;
    window.updateSpeechButtons();
}

function translateCategory(cat) {
    if (!cat) return '';
    const cleanCat = cat.trim().toLowerCase();
    if (cleanCat.includes('fehezanteny') || cleanCat.includes('phrase') || cleanCat.includes('sentence')) {
        return getT('cat_fehezanteny', cat);
    }
    if (cleanCat.includes('rakiteny') || cleanCat.includes('vocabulaire') || cleanCat.includes('vocabulary') || cleanCat.includes('word')) {
        return getT('cat_rakiteny', cat);
    }
    return cat;
}

function renderFullLesson(data, title, niveau) {
    window.currentView = 'fullLesson';
    window.currentTitle = title;
    window.currentNiveau = niveau;
    const container = document.getElementById('lesson-container');
    const info = data.find(i => i.PhoneticTitle === title);
    
    // Stop any currently running full lesson playback before re-rendering
    if (window.stopSpeakingFullLesson) {
        window.stopSpeakingFullLesson();
    }

    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    let playAllLabel = 'Henoy ny lesona feno';
    if (lang === 'fr') playAllLabel = 'Écouter toute la leçon';
    if (lang === 'he') playAllLabel = 'האזן לכל השיעור';

    const isLessonFav = window.isLessonFavorite && window.isLessonFavorite(title, niveau);

    let html = `
        <div class="lesson-title col-span-1 md:col-span-2 lg:col-span-3 mb-4">
            <div id="lesson-header-hebrew-card" class="card relative p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-bgCard border border-borderColor rounded-sm shadow-md transition-all duration-300">
                 <!-- Favorite Lesson Button -->
                 <button onclick="window.handleToggleFavoriteLesson(this, event)" data-title="${encodeURIComponent(title)}" data-niveau="${encodeURIComponent(niveau)}" data-lesson-num="${encodeURIComponent(info.Lesson||"")}" data-french-title="${encodeURIComponent(info.FrenchTitle||"")}" data-malagasy-title="${encodeURIComponent(info.MalagasyTitle||"")}" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-red-500 transition-colors cursor-pointer z-10" title="${lang === 'mg' ? 'Tehirizo ho ankafizina' : (lang === 'fr' ? 'Ajouter aux favoris' : 'הוסף למועדפים')}">
                     <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isLessonFav ? 'fill-red-500 text-red-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                     </svg>
                 </button>
                 <!-- Left side: lesson info -->
                 <div class="text-center md:text-left space-y-2">
                     <button onclick="renderLessons(window.allData, '${niveau}')" class="inline-flex items-center gap-1.5 px-3 py-1 bg-bgSecondary/40 hover:bg-bgSecondary/80 text-textSecondary hover:text-textPrimary text-[10px] font-mono uppercase tracking-widest border border-borderColor/50 rounded-sm transition-all cursor-pointer">
                         &larr; ${getT('level_label', 'Sokajy')} ${niveau} / ${getT('lesson_label', 'Lesona')} ${info.Lesson||''}
                     </button>
                     <h2 class="font-serif font-bold text-2xl text-textPrimary leading-tight tracking-tight mt-1">${info.PhoneticTitle||''}</h2>
                     <p class="text-xs text-textSecondary italic">${info.FrenchTitle||''} &mdash; ${info.MalagasyTitle||''}</p>
                 </div>
                 
                 <!-- Center/Right: Hebrew text + Play Controls -->
                 <div class="flex flex-col items-center gap-3 bg-bgSecondary/20 border border-borderColor/50 p-4 rounded-sm min-w-[280px]">
                     <span class="text-[9px] font-mono tracking-widest text-textSecondary uppercase">Hebreo (Lecture continue)</span>
                     <p class="hebrew-text font-serif text-3xl font-medium tracking-wide text-textPrimary" style="margin-bottom: 0px !important;">${info.HebrewTitle||''}</p>
                     
                     <div class="flex items-center gap-2 mt-1">
                         <!-- Individual Hebrew title play button -->
                         <button onclick="window.speakHebrew(this)" class="speech-btn flex items-center justify-center gap-1.5 px-3 py-1 bg-bgCard hover:bg-bgSecondary text-textPrimary rounded-full text-[11px] font-mono border border-borderColor/60 cursor-pointer transition-all" data-text="${encodeURIComponent(info.HebrewTitle)}">
                             <span class="speech-icon-container flex items-center justify-center">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                     <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                     <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                 </svg>
                             </span>
                             <span class="speech-text-container">${getPronounceLabel()}</span>
                         </button>
                         
                         <!-- PLAY ALL LESSON BUTTON -->
                         <button id="lesson-play-all-btn" onclick="window.togglePlayEntireLesson('${encodeURIComponent(title)}')" class="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-textPrimary text-bgCard hover:bg-textSecondary hover:text-textPrimary rounded-full text-xs font-mono font-bold border border-borderColor cursor-pointer transition-all shadow-sm">
                             <span class="play-all-icon flex items-center justify-center">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                     <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                 </svg>
                             </span>
                             <span class="play-all-text-container">${playAllLabel}</span>
                         </button>
                     </div>
                 </div>
            </div>
        </div>`;
    
    const filteredData = data.filter(i => i.PhoneticTitle === title);
    const cats = [...new Set(filteredData.map(i => i.Category).filter(i => i))];

    let rowIdx = 0;
    cats.forEach(cat => {
        const translatedCat = translateCategory(cat);
        html += `<h3 class="col-span-1 md:col-span-2 lg:col-span-3 text-center text-accent font-serif text-lg font-bold italic mt-8 mb-4 border-b border-borderColor/40 pb-2">${translatedCat}</h3>`;
        filteredData.filter(i => i.Category === cat).forEach(row => {
            const isStarred = window.isWordDifficult && window.isWordDifficult(row.Hebrew);
            const isVerseFav = window.isVerseFavorite && window.isVerseFavorite(row.Hebrew);
            const cardId = `reader-card-${rowIdx}`;
            html += `
                <div id="${cardId}" class="card relative reader-card transition-all duration-300 border-borderColor hover:border-textPrimary/40" style="text-align:center;">
                    <!-- Favorite Verse Button -->
                    <button onclick="window.toggleFavoriteVerse('${encodeURIComponent(JSON.stringify(row))}', this)" class="absolute top-3 left-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-red-500 transition-colors cursor-pointer z-10" title="${lang === 'mg' ? 'Tehirizo ho ankafizina' : (lang === 'fr' ? 'Ajouter aux favoris' : 'הוסף למועדפים')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isVerseFav ? 'fill-red-500 text-red-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                    </button>

                    <!-- Star / Difficult Word Button -->
                    <button onclick="window.toggleDifficultWord('${encodeURIComponent(JSON.stringify(row))}', this)" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-yellow-500 transition-colors cursor-pointer z-10" title="Teny sarotra">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isStarred ? 'fill-yellow-500 text-yellow-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                    <p class="hebrew-text">${row.Hebrew||''}</p>
                    ${row.Hebrew ? renderSpeechBtn(row.Hebrew, false) : ''}
                    <p class="phonetic-text text-textSecondary/80 tracking-wide mt-1">${row.Phonetic||''}</p>
                    <p class="french-text text-textPrimary mt-1">${row.French||''}</p>
                    <p class="malagasy-text text-textPrimary mt-1">${row.Malagasy||''}</p>
                </div>`;
            rowIdx++;
        });
    });
    container.innerHTML = html;
    window.updateSpeechButtons();
}

// Automatically re-render currently active dynamic views on language toggle
window.refreshLessonView = function() {
    if (window.allData) {
        if (window.currentView === 'levels') {
            renderLevels(window.allData);
        } else if (window.currentView === 'lessons') {
            renderLessons(window.allData, window.currentNiveau);
        } else if (window.currentView === 'fullLesson') {
            renderFullLesson(window.allData, window.currentTitle, window.currentNiveau);
        }
    }
    // Refresh search placeholders or outputs
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
        searchBar.placeholder = lang === 'mg' 
            ? "Hikaroka (Hebreo, dikanteny, phonetic...)" 
            : (lang === 'fr' ? "Rechercher (Hébreu, traduction, phonétique...)" : "חפש (עברית, תרגום, פונטי...)");
    }
    // Update active Quiz elements too
    if (window.refreshQuizUIOnLangChange) {
        window.refreshQuizUIOnLangChange();
    }
};

window.initNavigation = initNavigation;
window.renderLevels = renderLevels;
window.renderLessons = renderLessons;
window.renderFullLesson = renderFullLesson;


// ==================================================================
// ==================== QUIZ CONTROLLER ENGINE ====================
// ==================================================================

const fallbackVocab = [
    { Hebrew: "שָׁלוֹם", Phonetic: "shalom", Malagasy: "Fiadanana", French: "Paix" },
    { Hebrew: "אֱלֹהִים", Phonetic: "Elohim", Malagasy: "Elohim", French: "Elohim" },
    { Hebrew: "בְּרֵאשִׁית", Phonetic: "bereshit", Malagasy: "Tamin'ny voalohany", French: "Au commencement" },
    { Hebrew: "שָׁמัיִם", Phonetic: "shamayim", Malagasy: "Lanitra", French: "Cieux" },
    { Hebrew: "אֶרֶץ", Phonetic: "eretz", Malagasy: "Tany", French: "Terre" },
    { Hebrew: "אוֹר", Phonetic: "or", Malagasy: "Mazava / Fahazavana", French: "Lumière" },
    { Hebrew: "יוֹם", Phonetic: "yom", Malagasy: "Andro", French: "Jour" },
    { Hebrew: "לַיְלָה", Phonetic: "laylah", Malagasy: "Alina", French: "Nuit" },
    { Hebrew: "רֹעִי", Phonetic: "ro'i", Malagasy: "Mpiandry ahy", French: "Mon berger" },
    { Hebrew: "נัפְשִׁי", Phonetic: "nafshi", Malagasy: "Fanahiko", French: "Mon âme" },
    { Hebrew: "לֵבָב", Phonetic: "levav", Malagasy: "Fo", French: "Cœur" },
    { Hebrew: "מัיִם", Phonetic: "mayim", Malagasy: "Rano", French: "Eaux" },
    { Hebrew: "חֹשֶׁךְ", Phonetic: "choshek", Malagasy: "Aizina", French: "Ténèbres" },
    { Hebrew: "בָּרָא", Phonetic: "bara", Malagasy: "Nahary", French: "Créa" },
    { Hebrew: "אֶחָד", Phonetic: "echad", Malagasy: "Tokana", French: "Un / Seul" }
];

let quizState = {
    mode: 'vocabulary',
    questions: [],
    currentIndex: 0,
    score: 0,
    userAnswered: false
};

// Shuffle utility
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

window.startQuiz = function(mode) {
    quizState.mode = mode;
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.userAnswered = false;

    // Build question bank from synced lessons (Firestore)
    let questionBank = [];

    if (window.allData && window.allData.length > 0) {
        window.allData.forEach(row => {
            if (row.Hebrew && (row.Malagasy || row.French)) {
                if (!questionBank.find(q => q.Hebrew === row.Hebrew)) {
                    questionBank.push({
                        Hebrew: row.Hebrew,
                        Phonetic: row.Phonetic || '',
                        Malagasy: row.Malagasy || row.French,
                        French: row.French || row.Malagasy || ''
                    });
                }
            }
        });
    }

    // Use fallback vocab only if there are no synced lessons in database
    if (questionBank.length === 0) {
        fallbackVocab.forEach(item => {
            if (!questionBank.find(q => q.Hebrew === item.Hebrew)) {
                questionBank.push(item);
            }
        });
    }

    // Pick 10 random questions
    const shuffledBank = shuffleArray(questionBank);
    quizState.questions = shuffledBank.slice(0, Math.min(10, shuffledBank.length));

    // Toggle views
    document.getElementById('quiz-start-screen').classList.add('hidden');
    document.getElementById('quiz-play-screen').classList.remove('hidden');
    document.getElementById('quiz-finish-screen').classList.add('hidden');

    window.quizRenderQuestion();
};

window.quizRenderQuestion = function() {
    quizState.userAnswered = false;
    
    const currentQ = quizState.questions[quizState.currentIndex];
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';

    // Update progress numbers
    document.getElementById('quiz-current-question-num').innerText = `${quizState.currentIndex + 1}/${quizState.questions.length}`;
    document.getElementById('quiz-current-score').innerText = quizState.score;

    // Update Badge
    const badge = document.getElementById('quiz-question-type-badge');
    if (badge) {
        badge.innerText = getT('cat_rakiteny', 'Rakiteny');
    }

    // Render Hebrew text or translations
    const wordEl = document.getElementById('quiz-hebrew-word');
    
    // Apply active Hebrew font style to question
    wordEl.classList.remove('font-david', 'font-times', 'font-sileot');

    if (lang === 'he') {
        // Hebrew Interface: Show Malagasy & French translations together below the badge
        wordEl.classList.remove('hebrew-text');
        wordEl.style.direction = 'ltr';
        wordEl.innerHTML = `
            <div class="text-lg md:text-xl font-serif font-bold text-textPrimary leading-normal">${currentQ.Malagasy || ''}</div>
            <div class="text-sm md:text-base font-sans text-textSecondary mt-2 italic leading-normal">${currentQ.French || ''}</div>
        `;
    } else {
        wordEl.classList.add('hebrew-text');
        wordEl.style.direction = 'rtl';
        wordEl.innerText = currentQ.Hebrew;
    }

    // Sound speak button binding
    const speakBtn = document.getElementById('quiz-speak-btn');
    speakBtn.onclick = () => {
        window.speakHebrew(currentQ.Hebrew, speakBtn);
    };

    // Get correct answer translation/Hebrew
    const correctAnswer = (lang === 'he') ? currentQ.Hebrew : ((lang === 'fr') ? currentQ.French : currentQ.Malagasy);

    // Generate option list (1 correct, 3 incorrect distractors)
    let options = [correctAnswer];
    
    // Pick distractors from Firestore lessons or fallback
    let distractorsPool = [];
    if (lang === 'he') {
        // Hebrew Interface: Pick Hebrew distractors
        const pool = (window.allData && window.allData.length > 5) ? window.allData : fallbackVocab;
        pool.forEach(row => {
            if (row.Hebrew && row.Hebrew !== correctAnswer && !distractorsPool.includes(row.Hebrew)) {
                distractorsPool.push(row.Hebrew);
            }
        });
        if (distractorsPool.length < 3) {
            distractorsPool = ["שָׁלוֹם", "אֱלֹהִים", "שָׁמัיִם", "אֶרֶץ", "אוֹר"];
        }
    } else {
        // Malagasy/French Interface: Pick Malagasy/French distractors
        const pool = (window.allData && window.allData.length > 5) ? window.allData : fallbackVocab;
        pool.forEach(row => {
            const trans = (lang === 'fr') ? (row.French || row.Malagasy) : (row.Malagasy || row.French);
            if (trans && trans !== correctAnswer && !distractorsPool.includes(trans)) {
                distractorsPool.push(trans);
            }
        });
        if (distractorsPool.length < 3) {
            distractorsPool = ["Bonjour / Fiadanana", "Elohim / Elohim", "Ciel / Lanitra", "Terre / Tany", "Lumière / Mazava"];
        }
    }

    const shuffledDistractors = shuffleArray(distractorsPool);
    const distractors = shuffledDistractors.slice(0, 3);
    options = shuffleArray([...options, ...distractors]);

    // Render multiple choice options
    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';

    options.forEach(opt => {
        const btn = document.createElement('button');
        if (lang === 'he') {
            btn.className = "quiz-opt-btn w-full text-right p-4 bg-bgCard hover:bg-bgSecondary/40 text-textPrimary border border-borderColor rounded-sm transition-all active:scale-[0.98] hover:scale-[1.01] cursor-pointer flex flex-row-reverse items-center justify-between group";
            btn.innerHTML = `
                <span class="pl-3 leading-relaxed text-base md:text-lg" style="font-family: var(--hebrew-font-family, 'SILEOTLocal', serif); direction: rtl;">${opt}</span>
                <div class="w-4 h-4 rounded-full border border-borderColor flex items-center justify-center text-[8px] font-bold group-hover:border-textPrimary transition-colors shrink-0"></div>
            `;
        } else {
            btn.className = "quiz-opt-btn w-full text-left p-4 bg-bgCard hover:bg-bgSecondary/40 text-textPrimary border border-borderColor rounded-sm text-xs font-sans transition-all active:scale-[0.98] hover:scale-[1.01] cursor-pointer flex items-center justify-between group";
            btn.innerHTML = `
                <span class="pr-3 leading-relaxed">${opt}</span>
                <div class="w-4 h-4 rounded-full border border-borderColor flex items-center justify-center text-[8px] font-bold group-hover:border-textPrimary transition-colors shrink-0"></div>
            `;
        }
        btn.onclick = () => window.quizSelectOption(btn, opt);
        optionsContainer.appendChild(btn);
    });

    // Hide Next and explanation
    document.getElementById('quiz-explanation-panel').classList.add('hidden');
    document.getElementById('quiz-next-btn').classList.add('hidden');
};

window.quizSelectOption = function(btnElement, selectedAnswer) {
    if (quizState.userAnswered) return;
    quizState.userAnswered = true;

    const currentQ = quizState.questions[quizState.currentIndex];
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    const correctAnswer = (lang === 'he') ? currentQ.Hebrew : ((lang === 'fr') ? currentQ.French : currentQ.Malagasy);

    const isCorrect = (selectedAnswer === correctAnswer);

    // Disable all option buttons
    document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        btn.onclick = null; // Unbind clicks
        
        // If this button is the correct answer, show a subtle green outline
        const spanText = btn.querySelector('span').innerText;
        if (spanText === correctAnswer) {
            btn.classList.add('border-green-500', 'bg-green-500/5');
            btn.querySelector('div').className = "w-4 h-4 rounded-full border-green-500 bg-green-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0";
            btn.querySelector('div').innerHTML = "✓";
        }
    });

    if (isCorrect) {
        quizState.score++;
        document.getElementById('quiz-current-score').innerText = quizState.score;
        
        // Highlight active correct option with solid elegant theme-accent
        btnElement.classList.remove('bg-green-500/5', 'opacity-75');
        btnElement.classList.add('bg-green-600', 'text-white', 'border-green-600', 'opacity-100');
        
        // Set up Correct Explanations panel
        const statusIcon = document.getElementById('quiz-status-icon');
        statusIcon.className = "w-8 h-8 rounded-sm bg-green-600 flex items-center justify-center text-white mt-0.5 shadow-sm shrink-0";
        statusIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
        document.getElementById('quiz-status-title').innerText = getT('quiz_correct', 'Tsara be! Marina ny valiny.');
        document.getElementById('quiz-status-title').className = "font-serif font-bold text-sm text-green-600 dark:text-green-400";
    } else {
        // Highlight incorrect choice with elegant soft red
        btnElement.classList.remove('opacity-75');
        btnElement.classList.add('bg-red-500', 'text-white', 'border-red-500', 'opacity-100');
        btnElement.querySelector('div').className = "w-4 h-4 rounded-full border-red-500 bg-red-600 text-white flex items-center justify-center text-[8px] font-bold shrink-0";
        btnElement.querySelector('div').innerHTML = "✕";

        // Automated pull: add the missed word to difficult words list
        if (window.getDifficultWords && window.saveDifficultWords) {
            let words = window.getDifficultWords();
            if (!words.some(w => w.Hebrew === currentQ.Hebrew)) {
                words.push({
                    Hebrew: currentQ.Hebrew,
                    Phonetic: currentQ.Phonetic || '',
                    French: currentQ.French || '',
                    Malagasy: currentQ.Malagasy || '',
                    addedAt: new Date().toISOString()
                });
                window.saveDifficultWords(words);
            }
        }

        // Set up Incorrect Explanations panel
        const statusIcon = document.getElementById('quiz-status-icon');
        statusIcon.className = "w-8 h-8 rounded-sm bg-red-500 flex items-center justify-center text-white mt-0.5 shadow-sm shrink-0";
        statusIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" x2="6" y1="6" y2="18"/>
                <line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
        `;
        document.getElementById('quiz-status-title').innerText = getT('quiz_incorrect', 'Diso! Ity no valiny marina:');
        document.getElementById('quiz-status-title').className = "font-serif font-bold text-sm text-red-500 dark:text-red-400";
    }

    // Populate explanations details
    document.getElementById('quiz-explain-phonetic').innerText = currentQ.Phonetic || 'n/a';
    document.getElementById('quiz-explain-mg').innerText = currentQ.Malagasy || 'n/a';
    document.getElementById('quiz-explain-fr').innerText = currentQ.French || 'n/a';

    // Show panel and next button
    document.getElementById('quiz-explanation-panel').classList.remove('hidden');
    document.getElementById('quiz-next-btn').classList.remove('hidden');
};

window.quizNextQuestion = function() {
    quizState.currentIndex++;
    if (quizState.currentIndex < quizState.questions.length) {
        window.quizRenderQuestion();
    } else {
        window.quizFinish();
    }
};

window.quizFinish = function() {
    document.getElementById('quiz-play-screen').classList.add('hidden');
    document.getElementById('quiz-finish-screen').classList.remove('hidden');

    document.getElementById('quiz-final-score').innerText = quizState.score;
    document.getElementById('quiz-final-total').innerText = quizState.questions.length;

    // Feedback message logic
    const pct = (quizState.score / quizState.questions.length) * 100;
    let feedback = '';
    if (pct === 100) {
        feedback = getT('quiz_finish_msg_perfect', 'Tonga lafatra! Nahay daholo ianao.');
    } else if (pct >= 60) {
        feedback = getT('quiz_finish_msg_good', 'Tsara be! Efa tena mahay ianao.');
    } else {
        feedback = getT('quiz_finish_msg_fail', 'Mbola mila mamerina sy mianatra ianao. Andramo indray!');
    }
    document.getElementById('quiz-finish-feedback').innerText = feedback;
};

window.restartQuizCurrentMode = function() {
    window.startQuiz(quizState.mode);
};

window.backToQuizMenu = function() {
    document.getElementById('quiz-start-screen').classList.remove('hidden');
    document.getElementById('quiz-play-screen').classList.add('hidden');
    document.getElementById('quiz-finish-screen').classList.add('hidden');
};

window.refreshQuizUIOnLangChange = function() {
    const playScreen = document.getElementById('quiz-play-screen');
    const finishScreen = document.getElementById('quiz-finish-screen');

    // Update main text
    document.getElementById('quiz-main-title').innerText = getT('quiz_title', 'Quiz momba ny Hebreo');
    document.getElementById('quiz-main-subtitle').innerText = getT('quiz_subtitle', 'Hamarino sy amafiso ny fahalalanao ny teny Hebreo');

    if (playScreen && !playScreen.classList.contains('hidden') && quizState.questions && quizState.questions.length > 0) {
        // If they are in the middle of a quiz, re-render the current question to show correct language
        window.quizRenderQuestion();
    } else if (finishScreen && !finishScreen.classList.contains('hidden')) {
        // If they are on the finish screen, update feedback in correct language
        const pct = (quizState.score / quizState.questions.length) * 100;
        let feedback = '';
        if (pct === 100) {
            feedback = getT('quiz_finish_msg_perfect', 'Tonga lafatra! Nahay daholo ianao.');
        } else if (pct >= 60) {
            feedback = getT('quiz_finish_msg_good', 'Tsara be! Efa tena mahay ianao.');
        } else {
            feedback = getT('quiz_finish_msg_fail', 'Mbola mila mamerina sy mianatra ianao. Andramo indray!');
        }
        document.getElementById('quiz-finish-feedback').innerText = feedback;
    }
};

window.getT = getT;

// ==================================================================
// =================== DIFFICULT WORDS ENGINE =======================
// ==================================================================

// Get current user ID or fallback to anonymous
function getActiveUserId() {
    return (window.APP_STATE && window.APP_STATE.currentUserId) || 'anonymous';
}

// Get the key for safeStorage
function getDifficultWordsStorageKey() {
    return 'diff_words_' + getActiveUserId();
}

// Load difficult words
window.getDifficultWords = function() {
    try {
        const value = window.localStorage.getItem(getDifficultWordsStorageKey());
        return value ? JSON.parse(value) : [];
    } catch (e) {
        console.warn("Storage access failed for getDifficultWords, using mock memory storage");
        if (!window._mockDifficultWords) window._mockDifficultWords = {};
        const key = getDifficultWordsStorageKey();
        return window._mockDifficultWords[key] || [];
    }
};

// Save difficult words
window.saveDifficultWords = function(words) {
    try {
        window.localStorage.setItem(getDifficultWordsStorageKey(), JSON.stringify(words));
    } catch (e) {
        console.warn("Storage access failed for saveDifficultWords, using mock memory storage");
        if (!window._mockDifficultWords) window._mockDifficultWords = {};
        const key = getDifficultWordsStorageKey();
        window._mockDifficultWords[key] = words;
    }
    window.updateRevisionBadgeCount();
};

// Check if a word is marked as difficult
window.isWordDifficult = function(hebrewText) {
    if (!hebrewText) return false;
    const words = window.getDifficultWords();
    return words.some(w => w.Hebrew === hebrewText);
};

// Toggle difficult word
window.toggleDifficultWord = function(rowString, btnElement) {
    let row;
    try {
        row = JSON.parse(decodeURIComponent(rowString));
    } catch (e) {
        console.error("Failed to parse row for toggleDifficultWord:", e);
        return;
    }

    if (!row || !row.Hebrew) return;

    let words = window.getDifficultWords();
    const index = words.findIndex(w => w.Hebrew === row.Hebrew);
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';

    const starSvg = btnElement.querySelector('svg');

    if (index > -1) {
        // Remove it
        words.splice(index, 1);
        if (starSvg) {
            starSvg.classList.remove('fill-yellow-500', 'text-yellow-500');
            starSvg.classList.add('text-textSecondary/50');
        }
        const msg = lang === 'mg' ? "Voafafa tamin'ny famerenana" : (lang === 'fr' ? "Retiré des révisions" : "הוסר מהחזרות");
        if (window.showToast) window.showToast(msg, 'success');
    } else {
        // Add it
        words.push({
            Hebrew: row.Hebrew,
            Phonetic: row.Phonetic || '',
            French: row.French || '',
            Malagasy: row.Malagasy || '',
            addedAt: new Date().toISOString()
        });
        if (starSvg) {
            starSvg.classList.remove('text-textSecondary/50');
            starSvg.classList.add('fill-yellow-500', 'text-yellow-500');
        }
        const msg = lang === 'mg' ? "Voatahiry amin'ny famerenana" : (lang === 'fr' ? "Ajouté aux révisions" : "נוסף לחזרות");
        if (window.showToast) window.showToast(msg, 'success');
    }

    window.saveDifficultWords(words);
};

// Update Badge Count
window.updateRevisionBadgeCount = function() {
    const count = window.getDifficultWords().length;
    const badge = document.getElementById('revision-count-badge');
    if (badge) {
        badge.innerText = count;
    }
    const badgeBottom = document.getElementById('revision-count-badge-bottom');
    if (badgeBottom) {
        badgeBottom.innerText = count;
    }
};

// Clear All Difficult Words
window.clearAllDifficultWords = function() {
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    const confirmMsg = lang === 'mg' 
        ? "Tena te hamafa ny teny sarotra rehetra ve ianao?" 
        : (lang === 'fr' ? "Voulez-vous vraiment effacer tous les mots difficiles ?" : "האם אתה בטוח שברצונך למחוק את כל המילים?");
    
    if (confirm(confirmMsg)) {
        window.saveDifficultWords([]);
        window.renderRevisionView();
        const successMsg = lang === 'mg' ? "Voafafa daholo!" : (lang === 'fr' ? "Tout a été effacé !" : "הכל נמחק!");
        if (window.showToast) window.showToast(successMsg, 'success');
    }
};

// Render Revision View
window.renderRevisionView = function() {
    window.currentView = 'revision';
    window.updateRevisionBadgeCount();

    const words = window.getDifficultWords();
    const emptyState = document.getElementById('revision-empty-state');
    const contentState = document.getElementById('revision-content-state');
    const grid = document.getElementById('revision-list-grid');

    if (words.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (contentState) contentState.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (contentState) contentState.classList.remove('hidden');

    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';

    if (grid) {
        let html = '';
        words.forEach((row, idx) => {
            const rowStr = encodeURIComponent(JSON.stringify(row));
            const isVerseFav = window.isVerseFavorite && window.isVerseFavorite(row.Hebrew);
            html += `
                <div class="card relative p-6 flex flex-col items-center justify-center text-center space-y-4" style="min-height: 200px;">
                    <!-- Favorite/Heart button -->
                    <button onclick="window.toggleFavoriteVerse('${rowStr}', this)" class="absolute top-3 left-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-red-500 transition-colors cursor-pointer z-10" title="${lang === 'mg' ? 'Tehirizo ho ankafizina' : (lang === 'fr' ? 'Ajouter aux favoris' : 'הוסף למועדפים')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isVerseFav ? 'fill-red-500 text-red-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                    </button>

                    <!-- Delete button -->
                    <button onclick="window.removeSingleDifficultWord('${row.Hebrew}')" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-red-500/10 text-textSecondary hover:text-red-500 transition-colors cursor-pointer" title="Hamafa">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <!-- Hebrew Word -->
                    <p class="hebrew-text" style="font-size: var(--hebrew-font-size, 32px); font-family: var(--hebrew-font-family, 'SILEOTLocal', serif);">${row.Hebrew}</p>
                    
                    <!-- Pronounce button -->
                    ${row.Hebrew ? renderSpeechBtn(row.Hebrew, false) : ''}

                    <!-- Inline click-to-reveal translation container -->
                    <div class="w-full">
                        <button onclick="window.toggleCardTranslation(${idx})" id="rev-reveal-btn-${idx}" class="text-xs font-mono uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors cursor-pointer border border-borderColor/60 hover:border-borderColor px-3 py-1.5 rounded-sm bg-bgSecondary/10 hover:bg-bgSecondary/30">
                            ${getT('flashcard_reveal', 'Hampiseho ny dikany')}
                        </button>
                        <div id="rev-translation-${idx}" class="hidden space-y-1 text-xs pt-2 animate-fadeIn">
                            <p class="phonetic-text text-textPrimary">${row.Phonetic || ''}</p>
                            <p class="malagasy-text text-textSecondary">${row.Malagasy || ''}</p>
                            <p class="french-text text-textSecondary/80 italic">${row.French || ''}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
        window.updateSpeechButtons();
    }
};

window.toggleCardTranslation = function(idx) {
    const btn = document.getElementById(`rev-reveal-btn-${idx}`);
    const details = document.getElementById(`rev-translation-${idx}`);
    if (btn && details) {
        if (details.classList.contains('hidden')) {
            details.classList.remove('hidden');
            btn.classList.add('hidden');
        } else {
            details.classList.add('hidden');
            btn.classList.remove('hidden');
        }
    }
};

window.removeSingleDifficultWord = function(hebrewText) {
    let words = window.getDifficultWords();
    words = words.filter(w => w.Hebrew !== hebrewText);
    window.saveDifficultWords(words);
    window.renderRevisionView();
};

// ==================================================================
// ==================== FLASHCARD SESSION PLAYER ====================
// ==================================================================

let flashcardSession = {
    words: [],
    currentIndex: 0
};

let originalFlashcardOverlayHTML = null;

window.startFlashcardSession = function() {
    const words = window.getDifficultWords();
    if (words.length === 0) return;

    // Shuffle words for a true revision experience
    flashcardSession.words = shuffleArray(words);
    flashcardSession.currentIndex = 0;

    // Show overlay
    const overlay = document.getElementById('revision-flashcard-overlay');
    if (overlay) {
        if (!originalFlashcardOverlayHTML) {
            originalFlashcardOverlayHTML = overlay.innerHTML;
        } else {
            overlay.innerHTML = originalFlashcardOverlayHTML;
        }
        overlay.classList.remove('hidden');
    }

    window.renderFlashcardCurrent();
};

window.closeFlashcardSession = function() {
    const overlay = document.getElementById('revision-flashcard-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    // Stop speaking if active
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    window.renderRevisionView();
};

window.renderFlashcardCurrent = function() {
    const currentWord = flashcardSession.words[flashcardSession.currentIndex];
    const total = flashcardSession.words.length;
    const progressText = document.getElementById('flashcard-progress-text');

    if (progressText) {
        const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
        progressText.innerText = lang === 'mg' 
            ? `Karatra ${flashcardSession.currentIndex + 1} amin'ny ${total}` 
            : (lang === 'fr' ? `Carte ${flashcardSession.currentIndex + 1} sur ${total}` : `כרטיסיה ${flashcardSession.currentIndex + 1} מתוך ${total}`);
    }

    // Bind speak button
    const speakBtn = document.getElementById('flashcard-speak-btn');
    if (speakBtn) {
        speakBtn.onclick = () => {
            window.speakHebrew(currentWord.Hebrew, speakBtn);
        };
        // Update pronunciation text
        const textSpan = speakBtn.querySelector('span:last-child');
        if (textSpan) textSpan.innerText = getPronounceLabel();
    }

    // Set word
    const hebrewEl = document.getElementById('flashcard-hebrew-word');
    if (hebrewEl) {
        hebrewEl.innerText = currentWord.Hebrew;
        // Apply chosen font and size
        hebrewEl.style.fontSize = `var(--hebrew-font-size, ${window.APP_STATE?.hebrewFontSize || 32}px)`;
        hebrewEl.className = "hebrew-text leading-none select-none my-2 text-textPrimary";
        if (window.APP_STATE?.hebrewFont) {
            hebrewEl.classList.add('font-' + window.APP_STATE.hebrewFont);
        }
    }

    // Setup reveal state
    const revealBtn = document.getElementById('flashcard-reveal-btn');
    const details = document.getElementById('flashcard-reveal-details');
    if (revealBtn) revealBtn.classList.remove('hidden');
    if (details) details.classList.add('hidden');

    // Populate details
    const phoneticText = document.getElementById('flashcard-phonetic-text');
    const mgText = document.getElementById('flashcard-mg-text');
    const frText = document.getElementById('flashcard-fr-text');

    if (phoneticText) {
        phoneticText.innerText = currentWord.Phonetic || '';
        phoneticText.className = "phonetic-text text-textSecondary/80";
    }
    if (mgText) {
        mgText.innerText = currentWord.Malagasy || '';
        mgText.className = "malagasy-text text-textPrimary";
    }
    if (frText) {
        frText.innerText = currentWord.French || '';
        frText.className = "french-text text-textPrimary";
    }
};

window.revealFlashcardTranslation = function() {
    const revealBtn = document.getElementById('flashcard-reveal-btn');
    const details = document.getElementById('flashcard-reveal-details');
    if (revealBtn) revealBtn.classList.add('hidden');
    if (details) details.classList.remove('hidden');
};

window.feedbackFlashcard = function(mastered) {
    const currentWord = flashcardSession.words[flashcardSession.currentIndex];
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';

    if (mastered) {
        // Remove from the general difficult words database list
        let words = window.getDifficultWords();
        words = words.filter(w => w.Hebrew !== currentWord.Hebrew);
        window.saveDifficultWords(words);
        
        const toastMsg = lang === 'mg' ? "Mahay tsara!" : (lang === 'fr' ? "Maîtrisé !" : "כל הכבוד!");
        if (window.showToast) window.showToast(toastMsg, 'success');
    }

    // Go to next card
    flashcardSession.currentIndex++;
    if (flashcardSession.currentIndex < flashcardSession.words.length) {
        window.renderFlashcardCurrent();
    } else {
        // Finished session
        const overlay = document.getElementById('revision-flashcard-overlay');
        const overlayContent = overlay.querySelector('div');
        
        const finishedTitle = getT('flashcard_finished', 'Vita ny famerenana!');
        const closeLabel = getT('flashcard_close', 'Hiala');

        overlayContent.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12 animate-fadeIn">
                <div class="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                <div class="space-y-2">
                    <h3 class="font-serif font-bold text-xl text-textPrimary">${finishedTitle}</h3>
                    <p class="text-xs text-textSecondary">${lang === 'mg' ? 'Tsara be! Nahavita ny famerenana rehetra ianao androany.' : 'Félicitations ! Vous avez révisé tous vos mots difficiles.'}</p>
                </div>
                <button onclick="window.closeFlashcardSession();" class="px-6 py-2.5 rounded-sm bg-textPrimary hover:bg-textSecondary text-bgCard hover:text-textPrimary border border-borderColor text-xs font-mono uppercase tracking-wider transition-all active:scale-95 cursor-pointer">
                    ${closeLabel}
                </button>
            </div>
        `;
    }
};


// ==================================================================
// ===================== FAVORITES SYSTEM ===========================
// ==================================================================

let activeFavoritesTab = 'lessons';

window.getFavoriteLessons = function() {
    try {
        const t = window.localStorage.getItem('fav_lessons_' + getActiveUserId());
        return t ? JSON.parse(t) : [];
    } catch (e) {
        console.warn("Storage access failed for getFavoriteLessons", e);
        return [];
    }
};

window.saveFavoriteLessons = function(lessons) {
    try {
        window.localStorage.setItem('fav_lessons_' + getActiveUserId(), JSON.stringify(lessons));
    } catch (e) {
        console.warn("Storage access failed for saveFavoriteLessons", e);
    }
};

window.isLessonFavorite = function(title, niveau) {
    return window.getFavoriteLessons().some(l => l.title === title && l.niveau === niveau);
};

window.toggleFavoriteLesson = function(title, niveau, lessonNum, frenchTitle, malagasyTitle, btn) {
    let lessons = window.getFavoriteLessons();
    const idx = lessons.findIndex(l => l.title === title && l.niveau === niveau);
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    const svg = btn.querySelector('svg');
    
    if (idx > -1) {
        lessons.splice(idx, 1);
        if (svg) {
            svg.classList.remove('fill-red-500', 'text-red-500');
            svg.classList.add('text-textSecondary/50');
        }
        const msg = lang === 'mg' ? "Lesona nesorina tamin'ny ankafizina" : (lang === 'fr' ? "Leçon retirée des favoris" : "השיעור הוסר מהמועדפים");
        if (window.showToast) window.showToast(msg, 'success');
    } else {
        lessons.push({
            title: title,
            niveau: niveau,
            lessonNum: lessonNum,
            frenchTitle: frenchTitle,
            malagasyTitle: malagasyTitle,
            addedAt: new Date().toISOString()
        });
        if (svg) {
            svg.classList.remove('text-textSecondary/50');
            svg.classList.add('fill-red-500', 'text-red-500');
        }
        const msg = lang === 'mg' ? "Lesona nampidirina tamin'ny ankafizina" : (lang === 'fr' ? "Leçon ajoutée aux favoris" : "השיעור נוסף למועדפים");
        if (window.showToast) window.showToast(msg, 'success');
    }
    window.saveFavoriteLessons(lessons);
};

window.getFavoriteVerses = function() {
    try {
        const t = window.localStorage.getItem('fav_verses_' + getActiveUserId());
        return t ? JSON.parse(t) : [];
    } catch (e) {
        console.warn("Storage access failed for getFavoriteVerses", e);
        return [];
    }
};

window.saveFavoriteVerses = function(verses) {
    try {
        window.localStorage.setItem('fav_verses_' + getActiveUserId(), JSON.stringify(verses));
    } catch (e) {
        console.warn("Storage access failed for saveFavoriteVerses", e);
    }
};

window.isVerseFavorite = function(hebrew) {
    if (!hebrew) return false;
    return window.getFavoriteVerses().some(v => v.Hebrew === hebrew);
};

window.toggleFavoriteVerse = function(rowEncoded, btn) {
    let row;
    try {
        row = JSON.parse(decodeURIComponent(rowEncoded));
    } catch (e) {
        console.error("Failed to parse row for toggleFavoriteVerse:", e);
        return;
    }
    
    if (!row || !row.Hebrew) return;
    
    let verses = window.getFavoriteVerses();
    const idx = verses.findIndex(v => v.Hebrew === row.Hebrew);
    const lang = (window.APP_STATE && window.APP_STATE.lang) || 'mg';
    const svg = btn.querySelector('svg');
    
    if (idx > -1) {
        verses.splice(idx, 1);
        if (svg) {
            svg.classList.remove('fill-red-500', 'text-red-500');
            svg.classList.add('text-textSecondary/50');
        }
        const msg = lang === 'mg' ? "Andinin-teny nesorina tamin'ny ankafizina" : (lang === 'fr' ? "Verset retiré des favoris" : "הפסוק הוסר מהמועדפים");
        if (window.showToast) window.showToast(msg, 'success');
    } else {
        verses.push({
            Hebrew: row.Hebrew,
            Phonetic: row.Phonetic || '',
            French: row.French || '',
            Malagasy: row.Malagasy || '',
            PhoneticTitle: row.PhoneticTitle || window.currentTitle || '',
            Lesson: row.Lesson || '',
            Level: row.Level || window.currentNiveau || '',
            addedAt: new Date().toISOString()
        });
        if (svg) {
            svg.classList.remove('text-textSecondary/50');
            svg.classList.add('fill-red-500', 'text-red-500');
        }
        const msg = lang === 'mg' ? "Andinin-teny nampidirina tamin'ny ankafizina" : (lang === 'fr' ? "Verset ajouté aux favoris" : "הפסוק נוסף למועדפים");
        if (window.showToast) window.showToast(msg, 'success');
    }
    window.saveFavoriteVerses(verses);
};

window.setFavoritesTab = function(tabName) {
    activeFavoritesTab = tabName;
    window.renderFavoritesView();
};

window.renderFavoritesView = function() {
    window.currentView = 'favorites';
    
    const lessons = window.getFavoriteLessons();
    const verses = window.getFavoriteVerses();
    
    // Update active tab buttons visuals
    const lessonsTab = document.getElementById('fav-lessons-tab');
    const versesTab = document.getElementById('fav-verses-tab');
    if (lessonsTab && versesTab) {
        if (activeFavoritesTab === 'lessons') {
            lessonsTab.className = "px-5 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 border-textPrimary text-textPrimary font-semibold transition-all cursor-pointer";
            versesTab.className = "px-5 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 border-transparent text-textSecondary hover:text-textPrimary transition-all cursor-pointer";
        } else {
            lessonsTab.className = "px-5 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 border-transparent text-textSecondary hover:text-textPrimary transition-all cursor-pointer";
            versesTab.className = "px-5 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 border-textPrimary text-textPrimary font-semibold transition-all cursor-pointer";
        }
    }
    
    // Render Favorite Lessons
    const lessonsEmpty = document.getElementById('fav-lessons-empty');
    const lessonsGrid = document.getElementById('fav-lessons-grid');
    if (lessonsEmpty && lessonsGrid) {
        if (lessons.length === 0) {
            lessonsEmpty.classList.remove('hidden');
            lessonsGrid.classList.add('hidden');
        } else {
            lessonsEmpty.classList.add('hidden');
            lessonsGrid.classList.remove('hidden');
            
            let html = '';
            lessons.forEach(info => {
                html += `
                <div class="card relative p-6 bg-bgCard border border-borderColor rounded-sm shadow-md transition-all duration-300 hover:scale-[1.02] hover:border-textPrimary/40 flex flex-col justify-between" style="text-align:center;">
                    <button onclick="window.handleToggleFavoriteLesson(this, event); window.renderFavoritesView();" data-title="${encodeURIComponent(info.title)}" data-niveau="${encodeURIComponent(info.niveau)}" data-lesson-num="${encodeURIComponent(info.lessonNum||"")}" data-french-title="${encodeURIComponent(info.frenchTitle||"")}" data-malagasy-title="${encodeURIComponent(info.malagasyTitle||"")}" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-red-500 hover:text-red-600 transition-colors cursor-pointer z-10" title="Retirer des favoris">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                    </button>
                    <div onclick="window.handleRenderFullLesson(this, event)" data-title="${encodeURIComponent(info.title)}" data-niveau="${encodeURIComponent(info.niveau)}" class="cursor-pointer space-y-3 flex-1 flex flex-col justify-between">
                        <div class="space-y-1">
                            <span class="inline-block px-2 py-0.5 bg-bgSecondary border border-borderColor text-textSecondary font-mono text-[9px] rounded-sm uppercase tracking-wider mb-1">${getT('level_label', 'Ambaratonga')} ${info.niveau}</span>
                            <p class="text-xs font-mono text-textSecondary uppercase tracking-widest">${getT('lesson_label', 'Lesona')} ${info.lessonNum||''}</p>
                            <h3 class="font-serif font-bold text-lg text-textPrimary tracking-tight mt-1 leading-tight">${info.title}</h3>
                        </div>
                        <p class="text-[11px] text-textSecondary italic mt-1 leading-relaxed">
                            ${info.frenchTitle || ''} <br>
                            <span class="opacity-80">${info.malagasyTitle || ''}</span>
                        </p>
                    </div>
                </div>`;
            });
            lessonsGrid.innerHTML = html;
        }
    }
    
    // Render Favorite Verses
    const versesEmpty = document.getElementById('fav-verses-empty');
    const versesGrid = document.getElementById('fav-verses-grid');
    if (versesEmpty && versesGrid) {
        if (verses.length === 0) {
            versesEmpty.classList.remove('hidden');
            versesGrid.classList.add('hidden');
        } else {
            versesEmpty.classList.add('hidden');
            versesGrid.classList.remove('hidden');
            
            let html = '';
            verses.forEach((row, idx) => {
                const rowStr = encodeURIComponent(JSON.stringify(row));
                const cardId = `fav-verse-card-${idx}`;
                html += `
                <div id="${cardId}" class="card relative reader-card transition-all duration-300 border-borderColor hover:border-textPrimary/40 flex flex-col justify-between p-6 bg-bgCard border rounded-sm shadow-md" style="text-align:center;">
                    <!-- Top Heart/Favorite Button -->
                    <button onclick="window.toggleFavoriteVerse('${rowStr}', this); event.stopPropagation(); window.renderFavoritesView();" class="absolute top-3 left-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-red-500 hover:text-red-600 transition-colors cursor-pointer z-10" title="Retirer des favoris">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                    </button>

                    <!-- Star / Difficult Word Button -->
                    <button onclick="window.toggleDifficultWord('${rowStr}', this)" class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-bgSecondary/80 text-textSecondary hover:text-yellow-500 transition-colors cursor-pointer z-10" title="Teny sarotra">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${window.isWordDifficult && window.isWordDifficult(row.Hebrew) ? 'fill-yellow-500 text-yellow-500' : 'text-textSecondary/50'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                    
                    <!-- Lesson Reference Tag -->
                    <div class="mb-2">
                        <span onclick="window.handleRenderFullLesson(this, event)" data-title="${encodeURIComponent(row.PhoneticTitle)}" data-niveau="${encodeURIComponent(row.Level)}" class="inline-block px-2 py-0.5 bg-bgSecondary border border-borderColor hover:border-textPrimary/40 text-textSecondary hover:text-textPrimary font-mono text-[8px] rounded-sm uppercase tracking-wider cursor-pointer">
                            ${row.PhoneticTitle} (N.${row.Level})
                        </span>
                    </div>

                    <!-- Hebrew text -->
                    <p class="hebrew-text font-serif text-3xl text-textPrimary leading-loose" style="direction: rtl;">${row.Hebrew || ''}</p>
                    
                    <!-- Listen Button -->
                    ${row.Hebrew ? `
                    <div class="flex justify-center my-2">
                        <button onclick="window.speakHebrew(this)" class="speech-btn flex items-center justify-center gap-1.5 px-3 py-1 bg-bgSecondary/40 hover:bg-bgSecondary text-textPrimary rounded-full text-[11px] font-mono border border-borderColor/60 cursor-pointer transition-all" data-text="${encodeURIComponent(row.Hebrew)}">
                            <span class="speech-icon-container flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                            </span>
                            <span class="speech-text-container">${getPronounceLabel()}</span>
                        </button>
                    </div>` : ''}
                    
                    <!-- Translation fields -->
                    <p class="phonetic-text text-textSecondary/80 tracking-wide mt-1 text-sm font-sans">${row.Phonetic || ''}</p>
                    <p class="french-text text-textPrimary mt-1 text-xs font-sans leading-relaxed">${row.French || ''}</p>
                    <p class="malagasy-text text-textPrimary mt-1 text-xs font-sans leading-relaxed">${row.Malagasy || ''}</p>
                </div>`;
            });
            versesGrid.innerHTML = html;
            window.updateSpeechButtons();
        }
    }
};

