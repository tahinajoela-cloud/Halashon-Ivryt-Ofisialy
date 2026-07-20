// Application controller for the Hebrew Reader application.
// Handles state management, dynamic UI updates, custom themes, and translations.

// Safe storage wrapper to prevent security exceptions in sandboxed iframes
const safeStorage = {
  _mockStorage: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access denied for getItem:", key, e);
      return this._mockStorage[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage access denied for setItem:", key, e);
      this._mockStorage[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage access denied for removeItem:", key, e);
      delete this._mockStorage[key];
    }
  }
};

// App State with defaults
const state = {
  lang: 'mg',           // 'mg', 'fr', 'he'
  darkMode: false,      // Default to false for clear, simple light theme requested by the user
  theme: 1,             // 1, 2, 3
  hebrewFont: 'sileot', // 'sileot', 'david', 'times'
  hebrewFontSize: 32,   // 24 to 48 px
  lineHeight: 1.6,       // 1.2 to 2.6
  paragraphSpacing: 8,   // 4 to 24 px
  phoneticFont: 'inter', // 'inter', 'roboto', 'sileot', 'david', 'times'
  phoneticFontSize: 13,  // 10 to 24 px
  frenchFont: 'inter',   // 'inter', 'roboto', 'sileot', 'david', 'times'
  frenchFontSize: 14,    // 10 to 24 px
  malagasyFont: 'inter', // 'inter', 'roboto', 'sileot', 'david', 'times'
  malagasyFontSize: 14,  // 10 to 24 px
  activeView: 'home',   // 'home', 'about', 'dev', 'settings'
  sidebarOpen: false,   // Menu bar state
};

// Initialize Firebase Configuration (Defaults to user's halashon-ivryt-shaliach project)
// In production (GitHub Pages), this connects to the (default) database.
let firebaseConfig = {
  apiKey: "AIzaSyC2RWM8RfT5D1HytYuawfwYjNXOBch63ic",
  authDomain: "halashon-ivryt-shaliach.firebaseapp.com",
  projectId: "halashon-ivryt-shaliach",
  storageBucket: "halashon-ivryt-shaliach.firebasestorage.app",
  messagingSenderId: "1032741613734",
  appId: "1:1032741613734:web:b440a3bab2e43a2d198467"
};

let db = null;
let auth = null;
let currentUserId = null;
let eventListenersSet = false;

// Initialize Firebase dynamically (using window compat library for maximum speed and offline resilience)
async function initializeFirebase() {
  try {
    // Try to load real config dynamically if provisioned by set_up_firebase
    const response = await fetch('firebase-applet-config.json');
    if (response.ok) {
      const realConfig = await response.json();
      if (realConfig && realConfig.apiKey) {
        firebaseConfig = realConfig;
        console.log("Loaded actual Firebase configuration:", firebaseConfig.projectId);
      }
    }
  } catch (e) {
    console.warn("firebase-applet-config.json not found or blocked by CORS. Using default fallback configuration.");
  }

  try {
    if (window.firebase) {
      window.firebase.initializeApp(firebaseConfig);
      
      const dbId = firebaseConfig.databaseId;
      db = dbId ? window.firebase.app().firestore(dbId) : window.firebase.app().firestore();
      auth = window.firebase.auth();
      
      // Enable Firestore offline persistence for instant loading and full offline capability
      db.enablePersistence()
        .catch((err) => {
          console.warn("Firestore offline persistence failed or already enabled:", err.code);
        });

      console.log("Firebase initialized successfully with project:", firebaseConfig.projectId, "and database:", dbId || "(default)");

      // Listen to Firebase Auth state
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          console.log("Auth State Changed: User is signed in:", user.email);
          currentUserId = user.uid;
          state.currentUserId = user.uid;

          const proceedToApp = (userObj) => {
            // Hide Login UI, Show Main App UI
            document.getElementById('login-section')?.classList.add('hidden');
            document.getElementById('contact-admin-section')?.classList.add('hidden');
            document.getElementById('user-unauthorized-status')?.classList.add('hidden');
            document.getElementById('main-header')?.classList.remove('hidden');
            document.getElementById('app-main')?.classList.remove('hidden');
            document.getElementById('app-footer')?.classList.remove('hidden');
            document.getElementById('bottom-nav-bar')?.classList.remove('hidden');

            // Trigger lesson synchronization in background
            startLessonsSynchronization(currentUserId, true);
          };

          // Proceed directly to app
          proceedToApp(user);
        } else {
          console.log("Auth State Changed: User is signed out.");
          currentUserId = null;
          state.currentUserId = null;

          // Show Login UI, Hide Main App UI
          document.getElementById('login-section')?.classList.remove('hidden');
          document.getElementById('contact-admin-section')?.classList.add('hidden');
          document.getElementById('main-header')?.classList.add('hidden');
          document.getElementById('app-main')?.classList.add('hidden');
          document.getElementById('app-footer')?.classList.add('hidden');
          document.getElementById('bottom-nav-bar')?.classList.add('hidden');
          
          const lessonContainer = document.getElementById('lesson-container');
          if (lessonContainer) lessonContainer.innerHTML = '';
          
          const progressContainer = document.getElementById('progress-container');
          if (progressContainer) progressContainer.style.display = 'none';

          updateAuthUI();
        }
      });
    } else {
      console.warn("Firebase SDK not found on window object. Offline fallback mode active.");
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// Generate unique device ID to bind accounts
function generateDeviceId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Show Unauthorized Account details in Contact Admin section
function showUnauthorizedUI(userUid) {
  document.getElementById('login-section')?.classList.add('hidden');
  document.getElementById('main-header')?.classList.add('hidden');
  document.getElementById('app-main')?.classList.add('hidden');
  document.getElementById('app-footer')?.classList.add('hidden');
  document.getElementById('bottom-nav-bar')?.classList.add('hidden');

  const contactAdminSection = document.getElementById('contact-admin-section');
  if (contactAdminSection) {
    contactAdminSection.classList.remove('hidden');
  }

  const statusCard = document.getElementById('user-unauthorized-status');
  if (statusCard) {
    statusCard.classList.remove('hidden');
    const uidSpan = document.getElementById('user-unauthorized-uid');
    if (uidSpan) {
      uidSpan.textContent = userUid;
    }
  }
}

// Lessons Synchronization Engine - Stale-While-Revalidate (SWR) for instant loading
async function startLessonsSynchronization(userUid, isBackground = false) {
  const cachedData = safeStorage.getItem('lessons_data');
  const hasCache = !!cachedData;

  const progContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  
  // Only show progress bar if we have no local cache OR if this is an explicit manual sync
  const showLoader = !hasCache && !isBackground;

  if (showLoader && progContainer && progressBar) {
    progContainer.classList.remove('hidden');
    progressBar.style.width = '20%';
  }

  const userDocRef = db.collection("users").doc(userUid);

  try {
    let userData = null;
    let isUserFromCache = false;

    // 1. Get User Data (Try cache first, fallback to server)
    try {
      const userSnap = await userDocRef.get({ source: 'cache' });
      if (userSnap.exists) {
        userData = userSnap.data();
        isUserFromCache = true;
        console.log("Loaded user document from cache instantly.");
      }
    } catch (e) {
      // Ignore cache error, will fetch from server below
    }

    if (!userData) {
      if (showLoader && progressBar) progressBar.style.width = '45%';
      // Fetch from server with a short timeout
      const userPromise = userDocRef.get({ source: 'server' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tsy afaka nampifandray tamin'ny Firestore ny mombamomba ny mpampiasa.")), 5000)
      );
      const userSnap = await Promise.race([userPromise, timeoutPromise]);
      if (!userSnap.exists) {
        showUnauthorizedUI(userUid);
        throw new Error("Tsy mbola manana fahazoan-dalana ity kaonty ity. Mifandraisa amin'ny Mpiandraikitra.");
      }
      userData = userSnap.data();
      isUserFromCache = false;
    }

    // 2. Strict Device ID Verification (One account per device rule)
    let localDeviceId = safeStorage.getItem('device_id');
    if (!localDeviceId) {
      localDeviceId = generateDeviceId();
      safeStorage.setItem('device_id', localDeviceId);
    }

    const firestoreDeviceId = userData.deviceId;
    if (!firestoreDeviceId) {
      // If empty/missing in Firestore, bind this device ID and write to Firestore
      console.log("Empty device ID in Firestore. Binding device:", localDeviceId);
      try {
        await userDocRef.update({ deviceId: localDeviceId });
        userData.deviceId = localDeviceId;
      } catch (err) {
        console.error("Error writing deviceId to Firestore:", err);
        await userDocRef.set({ deviceId: localDeviceId }, { merge: true });
        userData.deviceId = localDeviceId;
      }
    } else if (firestoreDeviceId !== localDeviceId) {
      console.warn("Device ID mismatch! Firestore has:", firestoreDeviceId, "Local device is:", localDeviceId);
      throw new Error("Ity kaonty ity dia efa miasa amin'ny fitaovana hafa. Fitaovana iray ihany no mahazo mampiasa ity kaonty ity.");
    }

    const allowedLevels = userData.allowedLevels || [];
    if (allowedLevels.length === 0) {
      showUnauthorizedUI(userUid);
      throw new Error("Tsy mbola nahazo alalana amin'ny Sokajy hianarana na iray aza ity kaonty ity.");
    }

    // 3. Get Lessons Data (Try cache first, fallback to server)
    let lessonsData = null;
    let isLessonsFromCache = false;

    try {
      const lessonsQuery = db.collection("lessons").where("Niveau", "in", allowedLevels);
      const cachedLessonsSnap = await lessonsQuery.get({ source: 'cache' });
      if (!cachedLessonsSnap.empty) {
        lessonsData = [];
        cachedLessonsSnap.forEach(doc => {
          lessonsData.push(doc.data());
        });
        isLessonsFromCache = true;
        console.log("Loaded lessons from cache instantly. Count:", lessonsData.length);
      }
    } catch (e) {
      // Ignore cache error
    }

    // If we have cached lessons, render them immediately for 0-second loading!
    if (lessonsData) {
      const oldDataStr = safeStorage.getItem('lessons_data');
      const newDataStr = JSON.stringify(lessonsData);
      
      // Update local storage and UI instantly if empty or changed
      const lessonContainer = document.getElementById('lesson-container');
      const isUiEmpty = !lessonContainer || !lessonContainer.children.length;

      if (oldDataStr !== newDataStr || isUiEmpty) {
        safeStorage.setItem('lessons_data', newDataStr);
        initNavigation(lessonsData);
        renderLevels(lessonsData);
      }

      if (showLoader && progContainer) {
        progContainer.classList.add('hidden');
      }
    }

    // 4. Background Server Revalidation / Fresh Fetch
    // If we loaded from cache (either user or lessons), or we need a fresh check, run server sync
    if (isUserFromCache || isLessonsFromCache || !lessonsData) {
      // Run background sync
      setTimeout(async () => {
        try {
          console.log("Starting background Firestore server revalidation...");
          
          // Get fresh user document from server
          const freshUserSnap = await userDocRef.get({ source: 'server' });
          if (!freshUserSnap.exists) return;
          const freshUserData = freshUserSnap.data();

          // Verify device ID in background revalidation
          let localDeviceId = safeStorage.getItem('device_id');
          if (!localDeviceId) {
            localDeviceId = generateDeviceId();
            safeStorage.setItem('device_id', localDeviceId);
          }
          const freshFirestoreDeviceId = freshUserData.deviceId;
          if (!freshFirestoreDeviceId) {
            await userDocRef.update({ deviceId: localDeviceId });
          } else if (freshFirestoreDeviceId !== localDeviceId) {
            console.warn("Background revalidation: Device ID mismatch! Logging out.");
            safeStorage.removeItem('lessons_data');
            if (auth) {
              await auth.signOut().catch(e => console.error(e));
            }
            showToast("Ity kaonty ity dia efa miasa amin'ny fitaovana hafa. Fitaovana iray ihany no mahazo mampiasa ity kaonty ity.", "error");
            return;
          }
          
          const freshAllowedLevels = freshUserData.allowedLevels || [];
          
          if (freshAllowedLevels.length === 0) return;

          // Get fresh lessons from server with a tight timeout to prevent hanging
          const lessonsQuery = db.collection("lessons").where("Niveau", "in", freshAllowedLevels);
          const serverPromise = lessonsQuery.get({ source: 'server' });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Server timeout")), 6000)
          );

          const freshLessonsSnap = await Promise.race([serverPromise, timeoutPromise]);
          const freshLessons = [];
          freshLessonsSnap.forEach(doc => {
            freshLessons.push(doc.data());
          });

          const oldDataStr = safeStorage.getItem('lessons_data');
          const newDataStr = JSON.stringify(freshLessons);

          if (oldDataStr !== newDataStr) {
            console.log("Detected new or changed lessons on server. Updating UI.");
            safeStorage.setItem('lessons_data', newDataStr);
            initNavigation(freshLessons);
            renderLevels(freshLessons);
            
            showToast("Nisintona lesona vaovao tamin'ny fomba mandeha ho azy!", "success");
          } else {
            console.log("No changes detected on server. Cache is up to date.");
          }
        } catch (serverErr) {
          console.warn("Background revalidation failed or timed out (offline mode active):", serverErr.message);
        }
      }, 100);
    } else {
      // If we didn't have cache, the server fetch succeeded directly, so save and render it
      if (showLoader && progressBar) progressBar.style.width = '100%';
      
      const oldDataStr = safeStorage.getItem('lessons_data');
      const newDataStr = JSON.stringify(lessonsData);

      if (oldDataStr !== newDataStr) {
        safeStorage.setItem('lessons_data', newDataStr);
        initNavigation(lessonsData);
        renderLevels(lessonsData);
        if (!isBackground) {
          showToast("Vita ny fisintomana ireo angon-drakitra ilaina! Tafiditra ny lesona vaovao rehetra.", "success");
        }
      }

      if (showLoader && progContainer) {
        setTimeout(() => {
          progContainer.classList.add('hidden');
        }, 500);
      }
    }

    if (window.updateRevisionBadgeCount) {
      window.updateRevisionBadgeCount();
    }

  } catch (err) {
    console.error("Sync error:", err);
    if (!isBackground || !hasCache) {
      showToast(err.message, "error");
    }
    if (progContainer) progContainer.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';

    // Clear cache and log out immediately on device mismatch error
    if (err.message && err.message.includes("fitaovana hafa")) {
      safeStorage.removeItem('lessons_data');
      if (auth) {
        auth.signOut().catch(e => console.error(e));
      }
      return;
    }

    // Fallback to render local storage cache if completely failed
    if (hasCache) {
      const lessonContainer = document.getElementById('lesson-container');
      if (lessonContainer && !lessonContainer.children.length) {
        try {
          const cached = JSON.parse(cachedData);
          initNavigation(cached);
          renderLevels(cached);
        } catch (e) {}
      }
    }
  }
}

// Load state from safeStorage
function loadStateFromStorage() {
  const saved = safeStorage.getItem('hebrew_reader_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(key => {
        if (key in state) {
          state[key] = parsed[key];
        }
      });
      // Force valid local hebrewFont fallback
      if (!['sileot', 'david', 'times'].includes(state.hebrewFont)) {
        state.hebrewFont = 'sileot';
      }
    } catch (e) {
      console.error("Error parsing settings from safeStorage", e);
    }
  }
}

// Save state to safeStorage
function saveStateToStorage() {
  safeStorage.setItem('hebrew_reader_settings', JSON.stringify({
    lang: state.lang,
    darkMode: state.darkMode,
    theme: state.theme,
    hebrewFont: state.hebrewFont,
    hebrewFontSize: state.hebrewFontSize,
    lineHeight: state.lineHeight,
    paragraphSpacing: state.paragraphSpacing,
    phoneticFont: state.phoneticFont,
    phoneticFontSize: state.phoneticFontSize,
    frenchFont: state.frenchFont,
    frenchFontSize: state.frenchFontSize,
    malagasyFont: state.malagasyFont,
    malagasyFontSize: state.malagasyFontSize,
  }));
}

// Apply CSS variables for themes and Dark/Light modes
function applyTheme() {
  const isDark = state.darkMode;
  const themeNum = state.theme;
  const root = document.documentElement;

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  if (!isDark) {
    // Light Mode - Customized based on user request:
    // Header background is colorful (var(--bg-header)), body background is grey,
    // panel background is white (var(--bg-card) = #ffffff), panel text is black (var(--text-primary) = #0f172a).
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#475569');
    root.style.setProperty('--bg-secondary', '#f1f5f9');
    root.style.setProperty('--border-color', '#cbd5e1');

    if (themeNum == 1) {
      // 1. Tropical Tech (Light / Blue Theme)
      root.style.setProperty('--bg-primary', '#f3f4f6'); // Body Grey
      root.style.setProperty('--bg-header', '#3b82f6');  // Colored Header (Blue)
      root.style.setProperty('--accent', '#3b82f6');
      root.style.setProperty('--accent-hover', '#2563eb');
    } else if (themeNum == 2) {
      // 2. Vibrant Nature (Light / Forest Green Theme)
      root.style.setProperty('--bg-primary', '#f0fdf4'); // Soft Green-Grey Body
      root.style.setProperty('--bg-header', '#10b981');  // Colored Header (Emerald Green)
      root.style.setProperty('--accent', '#10b981');
      root.style.setProperty('--accent-hover', '#059669');
    } else if (themeNum == 3) {
      // 3. Neon Twilight (Light / Deep Purple Theme)
      root.style.setProperty('--bg-primary', '#f5f3ff'); // Soft Purple-Grey Body
      root.style.setProperty('--bg-header', '#8b5cf6');  // Colored Header (Purple)
      root.style.setProperty('--accent', '#8b5cf6');
      root.style.setProperty('--accent-hover', '#7c3aed');
    } else if (themeNum == 4) {
      // 4. Warm Joy (Light / Warm Crimson Theme)
      root.style.setProperty('--bg-primary', '#fff1f2'); // Soft Red-Grey Body
      root.style.setProperty('--bg-header', '#ec4899');  // Colored Header (Pink/Crimson)
      root.style.setProperty('--accent', '#ec4899');
      root.style.setProperty('--accent-hover', '#db2777');
    } else {
      // 5. Cyber Electric (Light / Cyan Theme)
      root.style.setProperty('--bg-primary', '#ecfeff'); // Soft Cyan-Grey Body
      root.style.setProperty('--bg-header', '#06b6d4');  // Colored Header (Cyan)
      root.style.setProperty('--accent', '#06b6d4');
      root.style.setProperty('--accent-hover', '#0891b2');
    }
  } else {
    // Dark Mode - Elegant, dark cohesive themes
    root.style.setProperty('--text-primary', '#f8fafc');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--border-color', '#334155');

    if (themeNum == 1) {
      // 1. Tropical Tech (Dark)
      root.style.setProperty('--bg-primary', '#0f172a');
      root.style.setProperty('--bg-secondary', '#1e293b');
      root.style.setProperty('--bg-card', '#1e293b');
      root.style.setProperty('--bg-header', '#1e293b');
      root.style.setProperty('--accent', '#ff6b4a');
      root.style.setProperty('--accent-hover', '#ff5630');
    } else if (themeNum == 2) {
      // 2. Vibrant Nature (Dark)
      root.style.setProperty('--bg-primary', '#0a1110');
      root.style.setProperty('--bg-secondary', '#121c1a');
      root.style.setProperty('--bg-card', '#121c1a');
      root.style.setProperty('--bg-header', '#121c1a');
      root.style.setProperty('--accent', '#36b37e');
      root.style.setProperty('--accent-hover', '#1d9a5f');
    } else if (themeNum == 3) {
      // 3. Neon Twilight (Dark)
      root.style.setProperty('--bg-primary', '#0b0516');
      root.style.setProperty('--bg-secondary', '#18122b');
      root.style.setProperty('--bg-card', '#18122b');
      root.style.setProperty('--bg-header', '#18122b');
      root.style.setProperty('--accent', '#ffab00');
      root.style.setProperty('--accent-hover', '#e69500');
    } else if (themeNum == 4) {
      // 4. Warm Joy (Dark)
      root.style.setProperty('--bg-primary', '#15050e');
      root.style.setProperty('--bg-secondary', '#240e1b');
      root.style.setProperty('--bg-card', '#240e1b');
      root.style.setProperty('--bg-header', '#240e1b');
      root.style.setProperty('--accent', '#e52f6e');
      root.style.setProperty('--accent-hover', '#70129b');
    } else {
      // 5. Cyber Electric (Dark)
      root.style.setProperty('--bg-primary', '#0b0f19');
      root.style.setProperty('--bg-secondary', '#121b2a');
      root.style.setProperty('--bg-card', '#121b2a');
      root.style.setProperty('--bg-header', '#121b2a');
      root.style.setProperty('--accent', '#00e5a3');
      root.style.setProperty('--accent-hover', '#00c289');
    }
  }

  const switchEl = document.getElementById('theme-toggle-checkbox');
  if (switchEl) {
    switchEl.checked = isDark;
  }

  // Apply Hebrew Font and Size CSS custom variables
  applyHebrewSettings();
}

// Helper to map font options to exact CSS values
function getFontFamilyString(fontKey) {
  if (fontKey === 'david') return "DavidLocal, serif";
  if (fontKey === 'times') return "TimesLocal, serif";
  if (fontKey === 'sileot') return "SILEOTLocal, serif";
  if (fontKey === 'roboto') return "\"Roboto Condensed\", sans-serif";
  return "\"Inter\", sans-serif";
}

// Apply Hebrew and translation Font and Font Size dynamically
function applyHebrewSettings() {
  const root = document.documentElement;
  
  // 1. Hebrew settings
  const font = state.hebrewFont || 'sileot';
  const size = state.hebrewFontSize || 32;
  const fontFamily = getFontFamilyString(font);
  root.style.setProperty('--hebrew-font-family', fontFamily);
  root.style.setProperty('--hebrew-font-size', `${size / 16}rem`);

  // 1b. Line Height and Spacing
  const lh = state.lineHeight || 1.6;
  const ps = state.paragraphSpacing || 8;
  root.style.setProperty('--panel-line-height', lh);
  root.style.setProperty('--panel-paragraph-spacing', `${ps}px`);

  // Sync Hebrew UI
  const selector = document.getElementById('setting-font-selector');
  if (selector) selector.value = font;
  const slider = document.getElementById('setting-size-slider');
  if (slider) slider.value = size;
  const valDisplay = document.getElementById('setting-size-val');
  if (valDisplay) valDisplay.innerText = `${size}px`;

  // Sync Line Height UI
  const lhSlider = document.getElementById('setting-lineheight-slider');
  if (lhSlider) lhSlider.value = lh;
  const lhVal = document.getElementById('setting-lineheight-val');
  if (lhVal) lhVal.innerText = lh;

  // Sync Paragraph Spacing UI
  const psSlider = document.getElementById('setting-spacing-slider');
  if (psSlider) psSlider.value = ps;
  const psVal = document.getElementById('setting-spacing-val');
  if (psVal) psVal.innerText = `${ps}px`;

  // 2. Phonetic settings
  const pFont = state.phoneticFont || 'inter';
  const pSize = state.phoneticFontSize || 13;
  root.style.setProperty('--phonetic-font-family', getFontFamilyString(pFont));
  root.style.setProperty('--phonetic-font-size', `${pSize / 16}rem`);

  // Sync Phonetic UI
  const pSelector = document.getElementById('setting-phonetic-font-selector');
  if (pSelector) pSelector.value = pFont;
  const pSlider = document.getElementById('setting-phonetic-size-slider');
  if (pSlider) pSlider.value = pSize;
  const pValDisplay = document.getElementById('setting-phonetic-size-val');
  if (pValDisplay) pValDisplay.innerText = `${pSize}px`;

  // 3. French settings
  const frFont = state.frenchFont || 'inter';
  const frSize = state.frenchFontSize || 14;
  root.style.setProperty('--french-font-family', getFontFamilyString(frFont));
  root.style.setProperty('--french-font-size', `${frSize / 16}rem`);

  // Sync French UI
  const frSelector = document.getElementById('setting-french-font-selector');
  if (frSelector) frSelector.value = frFont;
  const frSlider = document.getElementById('setting-french-size-slider');
  if (frSlider) frSlider.value = frSize;
  const frValDisplay = document.getElementById('setting-french-size-val');
  if (frValDisplay) frValDisplay.innerText = `${frSize}px`;

  // 4. Malagasy settings
  const mgFont = state.malagasyFont || 'inter';
  const mgSize = state.malagasyFontSize || 14;
  root.style.setProperty('--malagasy-font-family', getFontFamilyString(mgFont));
  root.style.setProperty('--malagasy-font-size', `${mgSize / 16}rem`);

  // Sync Malagasy UI
  const mgSelector = document.getElementById('setting-malagasy-font-selector');
  if (mgSelector) mgSelector.value = mgFont;
  const mgSlider = document.getElementById('setting-malagasy-size-slider');
  if (mgSlider) mgSlider.value = mgSize;
  const mgValDisplay = document.getElementById('setting-malagasy-size-val');
  if (mgValDisplay) mgValDisplay.innerText = `${mgSize}px`;

  // 5. Update live preview details if elements exist
  const previewDetails = document.getElementById('font-preview-details');
  if (previewDetails) {
    const fontDisplay = font.charAt(0).toUpperCase() + font.slice(1);
    const pFontDisplay = pFont.charAt(0).toUpperCase() + pFont.slice(1);
    const frFontDisplay = frFont.charAt(0).toUpperCase() + frFont.slice(1);
    const mgFontDisplay = mgFont.charAt(0).toUpperCase() + mgFont.slice(1);

    previewDetails.innerText = `HEBREW: ${fontDisplay} (${size}px) / PHONETIC: ${pFontDisplay} (${pSize}px) / FRENCH: ${frFontDisplay} (${frSize}px) / MALAGASY: ${mgFontDisplay} (${mgSize}px)`;
  }
}

// Render static strings or translations
function renderTranslations() {
  const lang = state.lang;
  const translations = window.APP_TRANSLATIONS;
  if (!translations) return;

  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    if (translations.ui[key] && translations.ui[key][lang]) {
      el.innerHTML = translations.ui[key][lang];
    }
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const btnLang = btn.getAttribute('data-lang');
    if (btnLang === lang) {
      btn.classList.add('border-accent', 'bg-accent/10', 'text-accent');
      btn.classList.remove('border-borderColor', 'text-textSecondary');
    } else {
      btn.classList.remove('border-accent', 'bg-accent/10', 'text-accent');
      btn.classList.add('border-borderColor', 'text-textSecondary');
    }
  });

  // Automatically refresh dynamic view content (like "Sokajy", "Lesona" labels, search placeholders, or active quiz)
  if (window.refreshLessonView) {
    window.refreshLessonView();
  }
  if (window.refreshQuizUIOnLangChange) {
    window.refreshQuizUIOnLangChange();
  }
  if (state.activeView === 'favorites' && window.renderFavoritesView) {
    window.renderFavoritesView();
  }
  if (state.activeView === 'revision' && window.renderRevisionView) {
    window.renderRevisionView();
  }
}

// Update login screen language UI
function updateAuthUI() {
  const translations = window.APP_TRANSLATIONS;
  if (!translations) return;
  const lang = state.lang;

  const submitText = document.getElementById('login-submit-text');
  const toggleText = document.getElementById('toggle-auth-mode-text');
  const loginTitle = document.querySelector('#login-section h1');
  const loginSubtitle = document.querySelector('#login-section p');

  if (submitText) {
    submitText.innerText = (translations.ui.login_btn_submit && translations.ui.login_btn_submit[lang])
      ? translations.ui.login_btn_submit[lang]
      : "Hiditra";
  }
  if (toggleText) {
    toggleText.innerText = (translations.ui.login_contact_admin && translations.ui.login_contact_admin[lang])
      ? translations.ui.login_contact_admin[lang]
      : "Hifandray amin'ny mpiandraikitra raha mila kaonty";
  }
  if (loginTitle) {
    loginTitle.innerText = (translations.ui.login_title && translations.ui.login_title[lang])
      ? translations.ui.login_title[lang]
      : "Fidirana amin'ny Fampiharana";
  }
  if (loginSubtitle) {
    loginSubtitle.innerText = (translations.ui.login_subtitle && translations.ui.login_subtitle[lang])
      ? translations.ui.login_subtitle[lang]
      : "Ampidiro ny mailaka sy ny tenimiafinao";
  }

  // Dynamic email & password input labels on login page
  const emailLabel = document.querySelector('label[for="email"]');
  if (emailLabel) {
    emailLabel.innerText = (translations.ui.login_email_label && translations.ui.login_email_label[lang])
      ? translations.ui.login_email_label[lang]
      : "Adiresy Mailaka:";
  }

  const passwordLabel = document.querySelector('label[for="password"]');
  if (passwordLabel) {
    passwordLabel.innerText = (translations.ui.login_password_label && translations.ui.login_password_label[lang])
      ? translations.ui.login_password_label[lang]
      : "Tenimiafina:";
  }
}

// Show a specific View in the single page app (SPA)
function setView(viewName) {
  state.activeView = viewName;
  
  // Stop continuous lesson audio reading when changing views
  if (window.stopSpeakingFullLesson) {
    window.stopSpeakingFullLesson();
  }

  const views = ['home', 'about', 'dev', 'quiz', 'settings', 'favorites', 'revision'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
        el.classList.add('animate-fadeIn');
      } else {
        el.classList.add('hidden');
        el.classList.remove('animate-fadeIn');
      }
    }
  });

  if (viewName === 'favorites') {
    if (window.renderFavoritesView) {
      window.renderFavoritesView();
    }
  }

  if (viewName === 'revision') {
    if (window.renderRevisionView) {
      window.renderRevisionView();
    }
  }

  updateActiveMenuHighlight();
  closeSidebar();
  saveStateToStorage();
}

// Highlights active page link in side menu drawer
function updateActiveMenuHighlight() {
  const viewName = state.activeView;
  document.querySelectorAll('[data-view-link]').forEach(link => {
    const linkView = link.getAttribute('data-view-link');
    const isBottomNav = link.closest('#bottom-nav-bar') !== null;
    
    if (isBottomNav) {
      const activeDot = link.querySelector('.nav-active-dot');
      if (linkView === viewName) {
        link.classList.remove('text-textSecondary');
        link.classList.add('text-accent', 'font-bold');
        if (activeDot) {
          activeDot.classList.remove('opacity-0');
          activeDot.classList.add('opacity-100');
        }
      } else {
        link.classList.remove('text-accent', 'font-bold');
        link.classList.add('text-textSecondary');
        if (activeDot) {
          activeDot.classList.remove('opacity-100');
          activeDot.classList.add('opacity-0');
        }
      }
    } else {
      if (linkView === viewName) {
        link.classList.add('bg-bgSecondary/80', 'text-textPrimary', 'border-l-2', 'border-textPrimary', 'font-semibold');
        link.classList.remove('text-textSecondary', 'hover:bg-bgSecondary/30');
      } else {
        link.classList.remove('bg-bgSecondary/80', 'text-textPrimary', 'border-l-2', 'border-textPrimary', 'font-semibold');
        link.classList.add('text-textSecondary', 'hover:bg-bgSecondary/30');
      }
    }
  });
}

// Toggle right sidebar menu drawer
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const sidebar = document.getElementById('side-drawer');
  const overlay = document.getElementById('drawer-overlay');
  
  if (state.sidebarOpen) {
    if (sidebar) sidebar.classList.remove('translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  } else {
    if (sidebar) sidebar.classList.add('translate-x-full');
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

function closeSidebar() {
  state.sidebarOpen = false;
  const sidebar = document.getElementById('side-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (sidebar) sidebar.classList.add('translate-x-full');
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

// Toast notification trigger
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-md animate-slideInUp ${
    type === 'success' 
      ? 'bg-bgCard border-accent text-accent' 
      : 'bg-bgCard border-red-500 text-red-500'
  }`;

  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
    <span class="font-medium">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 4000);
}

// Setup Event Listeners
function setupEventListeners() {
  if (eventListenersSet) return;
  eventListenersSet = true;

  // Hamburger menu toggle
  const menuBtn = document.getElementById('menu-toggle-btn');
  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);

  // Close sidebar overlay
  const overlay = document.getElementById('drawer-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Sidebar Links
  document.querySelectorAll('[data-view-link]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view-link');
      setView(view);
    });
  });

  // Floating dark/light toggle
  const switchEl = document.getElementById('theme-toggle-checkbox');
  if (switchEl) {
    switchEl.addEventListener('change', (e) => {
      state.darkMode = e.target.checked;
      applyTheme();
      saveStateToStorage();
    });
  }

  // Language selectors in general app
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lang = btn.getAttribute('data-lang');
      renderTranslations();
      updateAuthUI();
      saveStateToStorage();
    });
  });

  // Themes list selection swatches inside settings tab
  document.querySelectorAll('[data-theme-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeNum = parseInt(btn.getAttribute('data-theme-select'), 10);
      const isDarkType = btn.getAttribute('data-theme-type') === 'dark';
      state.theme = themeNum;
      state.darkMode = isDarkType;
      applyTheme();
      saveStateToStorage();
    });
  });

  // Hebrew Font selector listener
  const fontSelector = document.getElementById('setting-font-selector');
  if (fontSelector) {
    fontSelector.addEventListener('change', (e) => {
      state.hebrewFont = e.target.value;
      applyHebrewSettings();
      saveStateToStorage();
      
      // Refresh views if any are active
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // Hebrew Font Size Slider listener
  const sizeSlider = document.getElementById('setting-size-slider');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      state.hebrewFontSize = parseInt(e.target.value, 10);
      applyHebrewSettings();
      saveStateToStorage();
    });
  }

  // Line Height Slider listener
  const lineheightSlider = document.getElementById('setting-lineheight-slider');
  if (lineheightSlider) {
    lineheightSlider.addEventListener('input', (e) => {
      state.lineHeight = parseFloat(e.target.value);
      applyHebrewSettings();
      saveStateToStorage();
    });
  }

  // Paragraph Spacing Slider listener
  const spacingSlider = document.getElementById('setting-spacing-slider');
  if (spacingSlider) {
    spacingSlider.addEventListener('input', (e) => {
      state.paragraphSpacing = parseInt(e.target.value, 10);
      applyHebrewSettings();
      saveStateToStorage();
    });
  }

  // Phonetic Font selector listener
  const phoneticFontSelector = document.getElementById('setting-phonetic-font-selector');
  if (phoneticFontSelector) {
    phoneticFontSelector.addEventListener('change', (e) => {
      state.phoneticFont = e.target.value;
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // Phonetic Font Size Slider listener
  const phoneticSizeSlider = document.getElementById('setting-phonetic-size-slider');
  if (phoneticSizeSlider) {
    phoneticSizeSlider.addEventListener('input', (e) => {
      state.phoneticFontSize = parseInt(e.target.value, 10);
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // French Font selector listener
  const frenchFontSelector = document.getElementById('setting-french-font-selector');
  if (frenchFontSelector) {
    frenchFontSelector.addEventListener('change', (e) => {
      state.frenchFont = e.target.value;
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // French Font Size Slider listener
  const frenchSizeSlider = document.getElementById('setting-french-size-slider');
  if (frenchSizeSlider) {
    frenchSizeSlider.addEventListener('input', (e) => {
      state.frenchFontSize = parseInt(e.target.value, 10);
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // Malagasy Font selector listener
  const malagasyFontSelector = document.getElementById('setting-malagasy-font-selector');
  if (malagasyFontSelector) {
    malagasyFontSelector.addEventListener('change', (e) => {
      state.malagasyFont = e.target.value;
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // Malagasy Font Size Slider listener
  const malagasySizeSlider = document.getElementById('setting-malagasy-size-slider');
  if (malagasySizeSlider) {
    malagasySizeSlider.addEventListener('input', (e) => {
      state.malagasyFontSize = parseInt(e.target.value, 10);
      applyHebrewSettings();
      saveStateToStorage();
      if (window.refreshLessonView) window.refreshLessonView();
    });
  }

  // Contact Admin page navigation listeners
  const toggleAuthBtn = document.getElementById('toggle-auth-mode-btn');
  const contactAdminSection = document.getElementById('contact-admin-section');
  const loginSection = document.getElementById('login-section');

  if (toggleAuthBtn && contactAdminSection && loginSection) {
    toggleAuthBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginSection.classList.add('hidden');
      document.getElementById('user-unauthorized-status')?.classList.add('hidden');
      contactAdminSection.classList.remove('hidden');
    });
  }

  // Back to Login from Contact Admin screen
  const backToLoginBtn = document.getElementById('back-to-login-btn');
  if (backToLoginBtn && contactAdminSection && loginSection) {
    backToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      contactAdminSection.classList.add('hidden');
      document.getElementById('user-unauthorized-status')?.classList.add('hidden');
      loginSection.classList.remove('hidden');
    });
  }

  // Copy UID button handler
  const copyUidBtn = document.getElementById('copy-uid-btn');
  if (copyUidBtn) {
    copyUidBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const uidSpan = document.getElementById('user-unauthorized-uid');
      if (uidSpan && uidSpan.textContent) {
        navigator.clipboard.writeText(uidSpan.textContent)
          .then(() => {
            showToast("Voadika soa aman-tsara ny ID-nao!", "success");
          })
          .catch((err) => {
            console.error("Failed to copy UID:", err);
            showToast("Tsy nahomby ny fandikana ny ID.", "error");
          });
      }
    });
  }

  // Login click handler
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showToast("Fenoy aloha ny mailaka sy ny tenimiafina!", "error");
        return;
      }

      if (!auth) {
        showToast("Mbola mampifandray amin'ny Mpamatsy... Andramo indray afaka segondra vitsy.", "error");
        return;
      }

      let loginEmail = email;
      if (!loginEmail.includes('@')) {
        loginEmail = loginEmail + '@gmail.com';
      }

      auth.signInWithEmailAndPassword(loginEmail, password)
        .then((userCredential) => {
          currentUserId = userCredential.user.uid;
          state.currentUserId = userCredential.user.uid;
          showToast("Tafiditra soa aman-tsara ianao!", "success");
          startLessonsSynchronization(currentUserId);
        })
        .catch(err => {
          console.error("Diso fidirana:", err);
          let errorMsg = "Diso ny mailaka na ny tenimiafina naiditrao!";
          if (err.code === 'auth/invalid-credential') {
            errorMsg = "Diso ny fidirana na tsy mety ny tenimiafina naiditrao. Hamarino tsara na mifandraisa amin'ny Mpandrindra (Admin) raha mbola tsy manana kaonty ianao.";
          } else if (err.code === 'auth/user-not-found') {
            errorMsg = "Mbola tsy voasoratra ao amin'ny rafitra ity kaonty ity. Mifandraisa amin'ny Mpandrindra (Admin).";
          } else if (err.code === 'auth/wrong-password') {
            errorMsg = "Diso ny tenimiafina (Password) nampidirinao!";
          } else if (err.code === 'auth/too-many-requests') {
            errorMsg = "Be loatra ny andrana tsy nahomby. Voasakana vonjimaika ny fidirana amin'ny kaontinao, andramo indray afaka kelikely.";
          } else if (err.message) {
            errorMsg = `Tsy nahomby ny fidirana: ${err.message}`;
          }
          showToast(errorMsg, "error");
        });
    });
  }

  // Update button listener
  const updateBtn = document.getElementById('update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      if (!currentUserId) {
        showToast("Mbola mampifandray amin'ny Mpamatsy... Andramo indray afaka segondra vitsy.", "error");
        return;
      }
      startLessonsSynchronization(currentUserId);
    });
  }

  // Logout modal triggers
  const logoutBtn = document.getElementById('logout-btn');
  const logoutModal = document.getElementById('logout-modal');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  if (logoutBtn && logoutModal) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      logoutModal.classList.remove('hidden');
      logoutModal.classList.add('flex');
    });
  }

  if (cancelBtn && logoutModal) {
    cancelBtn.addEventListener('click', () => {
      logoutModal.classList.add('hidden');
      logoutModal.classList.remove('flex');
    });
  }

  if (confirmBtn && logoutModal) {
    confirmBtn.addEventListener('click', () => {
      logoutModal.classList.add('hidden');
      logoutModal.classList.remove('flex');
      
      const performLocalSignout = () => {
        const emailInput = document.getElementById('email');
        const passInput = document.getElementById('password');
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        
        // Clear local cached lessons data on sign out
        safeStorage.removeItem('lessons_data');
        
        // Force routing to login screen manually if auth state listener didn't fire
        document.getElementById('login-section')?.classList.remove('hidden');
        document.getElementById('main-header')?.classList.add('hidden');
        document.getElementById('app-main')?.classList.add('hidden');
        document.getElementById('app-footer')?.classList.add('hidden');
        document.getElementById('bottom-nav-bar')?.classList.add('hidden');
        
        const translations = window.APP_TRANSLATIONS;
        const lang = state.lang || 'mg';
        const logoutMsg = (translations && translations.ui && translations.ui.logout_toast && translations.ui.logout_toast[lang])
          || "Tafavoaka soa aman-tsara!";
        showToast(logoutMsg, "success");
      };

      if (auth) {
        auth.signOut()
          .then(() => {
            performLocalSignout();
          })
          .catch(err => {
            console.error("Firebase signOut error:", err);
            // Even if online signOut fails, clear local data to log the user out of the UI
            performLocalSignout();
          });
      } else {
        performLocalSignout();
      }
    });
  }

  // Save Settings button handler
  const saveSettingsBtn = document.getElementById('settings-save-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveStateToStorage();
      
      const translations = window.APP_TRANSLATIONS;
      const lang = state.lang || 'mg';
      const successMsg = (translations && translations.ui && translations.ui.settings_save_success && translations.ui.settings_save_success[lang]) 
        || "Voatahiry soa aman-tsara ny fikirakirana vaovao nataonao!";
      
      showToast(successMsg, 'success');
      
      // Navigate to Home view after a small delay so the user sees the confirmation
      setTimeout(() => {
        setView('home');
      }, 800);
    });
  }
}

// Monitor navigator.onLine for synchronization status
function setupNetworkStatusMonitoring() {
  function updateStatus() {
    const isOnline = navigator.onLine;
    const dot = document.getElementById('sync-status-dot');
    const ping = document.getElementById('sync-status-ping');
    const text = document.getElementById('sync-status-text');

    if (dot && text) {
      if (isOnline) {
        dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
        if (ping) ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
        text.textContent = 'Connected';
      } else {
        dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-red-500';
        if (ping) ping.className = 'hidden';
        text.textContent = 'Offline';
      }
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus(); // Initial call
}

// Initializer
async function init() {
  loadStateFromStorage();
  applyTheme();
  renderTranslations();
  setupEventListeners();
  setupNetworkStatusMonitoring();

  // Run offline mode check right away
  const cachedData = safeStorage.getItem('lessons_data');
  if (cachedData) {
    try {
      const data = JSON.parse(cachedData);
      if (data && Array.isArray(data)) {
        document.getElementById('login-section')?.classList.add('hidden');
        document.getElementById('contact-admin-section')?.classList.add('hidden');
        document.getElementById('main-header')?.classList.remove('hidden');
        document.getElementById('app-main')?.classList.remove('hidden');
        document.getElementById('app-footer')?.classList.remove('hidden');
        document.getElementById('bottom-nav-bar')?.classList.remove('hidden');
        
        // Set view to home to render cached levels
        setView('home');
        
        initNavigation(data);
        renderLevels(data);
      }
    } catch (e) {
      console.warn("Failed to parse cached lessons_data:", e);
    }
  }

  // Initialize Firebase and Auth listeners
  await initializeFirebase();

  if (window.updateRevisionBadgeCount) {
    window.updateRevisionBadgeCount();
  }
}

// Expose navigation functions and state to the window for inline onClick handlers
window.APP_STATE = state;
window.setView = setView;
window.closeSidebar = closeSidebar;
window.toggleSidebar = toggleSidebar;

// Run init on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
