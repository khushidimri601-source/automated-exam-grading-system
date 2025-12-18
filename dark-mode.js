// Dark Mode Toggle

function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        enableDarkMode();
    }
}

function toggleDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
    updateDarkModeButton(true);
}

function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
    updateDarkModeButton(false);
}

function updateDarkModeButton(enabled) {
    const buttons = document.querySelectorAll('.dark-mode-toggle');
    buttons.forEach(btn => {
        btn.textContent = enabled ? '☀️ Light Mode' : '🌙 Dark Mode';
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
    initDarkMode();
}

