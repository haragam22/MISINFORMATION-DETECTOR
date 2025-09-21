// script.js (patched)
// Global state
let currentTab = 'text';
let isLoading = false;
let showStickyButton = false;
let _lastResponse = null; // store last backend response for debug/raw view

// DOM Elements (grab safely after DOM ready)
let tabButtons, tabContents, verifyButton, buttonText, loadingSpinner, resultsSection, floatingButton, checkerSection;

document.addEventListener('DOMContentLoaded', function() {
    // query DOM elements now (safe)
    tabButtons = Array.from(document.querySelectorAll('.tab-button'));
    tabContents = Array.from(document.querySelectorAll('.tab-content'));
    verifyButton = document.getElementById('verify-btn');
    buttonText = verifyButton ? verifyButton.querySelector('.button-text') : null;
    loadingSpinner = verifyButton ? verifyButton.querySelector('.loading-spinner') : null;
    resultsSection = document.getElementById('results');
    floatingButton = document.getElementById('floating-button');
    checkerSection = document.querySelector('.checker-section');

    initializeTabs();
    initializeScrollHandling();
    updateButtonText();
    updateButtonState();
    attachRawJsonButton();
});

// Tab functionality
function initializeTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    tabContents.forEach(content => {
        content.classList.toggle('active', content.getAttribute('data-content') === tabName);
    });
    updateButtonText();
    hideResults();
    setTimeout(manageFocus, 80);
}

function updateButtonText() {
    if (!buttonText) return;
    if (!isLoading) {
        buttonText.textContent = currentTab === 'text' ? 'Check Claim' : 'Verify Website';
    }
}

// Scroll handling for sticky button
function initializeScrollHandling() {
    window.addEventListener('scroll', debouncedScroll, { passive: true });
}

function handleScroll() {
    const heroSection = document.getElementById('hero');
    if (heroSection) {
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
        const shouldShow = window.scrollY > heroBottom;
        if (shouldShow !== showStickyButton) {
            showStickyButton = shouldShow;
            toggleStickyButton();
        }
    }
}

function toggleStickyButton() {
    if (!floatingButton) return;
    floatingButton.classList.toggle('hidden', !showStickyButton);
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Form validation
function isFormValid() {
    if (currentTab === 'text') {
        const claimInput = document.getElementById('claim-input');
        return claimInput && claimInput.value.trim().length > 0;
    } else {
        const urlInput = document.getElementById('url-input');
        return urlInput && urlInput.value.trim().length > 0;
    }
}

function getCurrentInput() {
    if (currentTab === 'text') {
        return (document.getElementById('claim-input') || { value: '' }).value.trim();
    } else {
        return (document.getElementById('url-input') || { value: '' }).value.trim();
    }
}

// Main submit function
async function handleSubmit() {
    if (!isFormValid() || isLoading) return;

    setLoadingState(true);
    hideResults();

    const inputValue = getCurrentInput();
    try {
        // IMPORTANT: use the /verify route like your extension does
        const requestBody = currentTab === 'text' ? { claim: inputValue } : { url: inputValue };
        const BACKEND_URL = 'https://misinformation-detector-f3wm.onrender.com/verify';

        console.log('Sending request to backend:', requestBody, '->', BACKEND_URL);

        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            // Try to parse JSON error if available
            let errText = await response.text().catch(() => '');
            console.error('Backend returned non-OK:', response.status, errText);
            displayResults(getMockResult('Backend error: ' + response.status + ' — showing demo result.'));
            setLoadingState(false);
            return;
        }

        const data = await response.json();
        console.log('Backend response:', data);
        _lastResponse = data;

        // Normalize backend fields (tolerant to varying keys)
        const verdict = (data.verdict || data.verification || '').toString().toLowerCase();
        const confidence = typeof data.confidence === 'number' ? data.confidence : (parseFloat(data.confidence) || 0);
        const evidence = Array.isArray(data.evidence) ? data.evidence : (Array.isArray(data.evidence_list) ? data.evidence_list : []);
        const signals = data.signals || data.signal || {};
        const educationTip = data.education_tip || data.educationTip || data.educationTipText || getDefaultEducationTip();

        const normalizedVerdict = verdict.includes('likely') ? verdict : verdict === 'true' ? 'likely true' : verdict === 'false' ? 'likely false' : 'uncertain';
        console.log('🔍 Raw verdict from backend:', verdict);
        const formatted = {
            verdict: normalizedVerdict,
            confidence: Math.min(1, Math.max(0, confidence || 0.65)),
            evidence: evidence.length ? evidence : [{
                source: 'TruthLens System',
                text: data.explanation || data.excerpt || 'No evidence returned by backend.',
                link: data.source_url || data.url || '#'
            }],
            signals,
            educationTip
        };


        displayResults(formatted);
    } catch (err) {
        console.error('Network or parsing error:', err);
        displayResults(getMockResult('Network error — showing demo result. Check CORS or backend availability.'));
    } finally {
        setLoadingState(false);
    }
}

// Loading state management
function setLoadingState(loading) {
    isLoading = loading;
    if (verifyButton) verifyButton.disabled = loading;

    if (loading) {
        if (buttonText) buttonText.style.opacity = '0';
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');
        if (loadingSpinner) {
            const span = loadingSpinner.querySelector('span');
            if (span) span.textContent = currentTab === 'text' ? 'Analyzing Claim...' : 'Analyzing Website...';
        }
    } else {
        if (buttonText) buttonText.style.opacity = '1';
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        updateButtonText();
    }
}

// Results display
function displayResults(result) {
    updateBackgroundColor(result.verdict);
    updateResultsContent(result);
    showResults();

    // Scroll to results
    setTimeout(() => {
        if (resultsSection) {
            resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, 250);
}

function updateBackgroundColor(verdict) {
    if (!checkerSection) return;
    checkerSection.classList.remove('true-bg', 'false-bg', 'uncertain-bg');

    if (verdict === 'likely true' || verdict === 'true') {
        checkerSection.classList.add('true-bg');
    } else if (verdict === 'likely false' || verdict === 'false') {
        checkerSection.classList.add('false-bg');
    } else {
        checkerSection.classList.add('uncertain-bg');
    }
}


function updateResultsContent(result) {
    // verdict badge
    const verdictBadge = document.querySelector('.verdict-badge');
    if (!verdictBadge) return;
    const verdictIcon = verdictBadge.querySelector('.verdict-icon');
    const verdictText = verdictBadge.querySelector('.verdict-text');

    verdictBadge.classList.remove('true', 'false', 'uncertain');
    verdictBadge.classList.add(result.verdict);

    if (verdictIcon) verdictIcon.innerHTML = getVerdictIcon(result.verdict);
    if (verdictText) verdictText.textContent = getVerdictText(result.verdict);

    const scoreElement = document.querySelector('.score');
    if (scoreElement) scoreElement.textContent = Math.round((result.confidence || 0) * 100) + '%';

    updateEvidence(result.evidence || []);
    updateEducationTip(result);
    updateSignals(result.signals || {});
    // store last response for raw view
    window._lastResponse = _lastResponse || result;
}

function getVerdictIcon(verdict) {
    switch (verdict) {
        case 'true':
            return '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>';
        case 'false':
            return '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
        default:
            return '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
    }
}

function getVerdictText(verdict) {
    switch (verdict) {
        case 'likely true': return 'Likely True';
        case 'likely false': return 'Likely False';
        case 'true': return 'True';
        case 'false': return 'False';
        default: return 'Uncertain';
    }
}

function updateEvidence(evidence) {
    const evidenceList = document.getElementById('evidence-list');
    if (!evidenceList) return;
    evidenceList.innerHTML = '';

    // evidence item format tolerance:
    // prefer { text, link, source, stance } but accept { snippet, url, source } as fallback
    evidence.forEach(item => {
        const text = item.text || item.snippet || item.excerpt || '';
        const src = item.source || item.publisher || item.site || '';
        const link = item.link || item.url || item.source_url || '#';
        const stance = item.stance ? ` (${item.stance})` : '';

        const container = document.createElement('div');
        container.className = 'evidence-item';

        const srcDiv = document.createElement('div');
        srcDiv.className = 'evidence-source';
        srcDiv.textContent = src || 'Source';

        const snipDiv = document.createElement('div');
        snipDiv.className = 'evidence-snippet';
        // allow clickable link
        if (link && link !== '#') {
            snipDiv.innerHTML = `<div>${escapeHtml(text)} <a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">source</a>${escapeHtml(stance)}</div>`;
        } else {
            snipDiv.textContent = text + stance;
        }

        container.appendChild(srcDiv);
        container.appendChild(snipDiv);
        evidenceList.appendChild(container);
    });
}

function updateEducationTip(result) {
    const educationTip = document.querySelector('.education-tip');
    const tipContent = document.getElementById('tip-content');
    if (!educationTip || !tipContent) return;
    educationTip.classList.remove('true', 'false', 'uncertain');
    educationTip.classList.add(result.verdict);
    tipContent.textContent = result.educationTip || getDefaultEducationTip();
}

function updateSignals(signals) {
    // Ensure UI element exists (we add it to HTML)
    const signalsPre = document.getElementById('signals-pre');
    if (!signalsPre) return;
    signalsPre.textContent = JSON.stringify(signals, null, 2);
}

function showResults() {
    if (!resultsSection) return;
    resultsSection.classList.remove('hidden');
}

function hideResults() {
    if (!resultsSection) return;
    resultsSection.classList.add('hidden');
    if (checkerSection) checkerSection.classList.remove('true-bg', 'false-bg', 'uncertain-bg');
}

// Utility functions
function getMockResult(message) {
    const verdicts = ['true', 'false', 'uncertain'];
    const randomVerdict = verdicts[Math.floor(Math.random() * verdicts.length)];
    return {
        verdict: randomVerdict,
        confidence: 0.65 + Math.random() * 0.3,
        evidence: [
            { source: 'TruthLens Demo', text: message, link: '#' }
        ],
        signals: {},
        educationTip: getDefaultEducationTip()
    };
}

function getDefaultEducationTip() {
    if (currentTab === 'text') {
        return 'Always verify claims from multiple reliable sources before sharing.';
    } else {
        return 'When evaluating websites, check for author credentials, publication date, and cross-reference with trusted sources.';
    }
}

// Input validation & real-time updates
document.addEventListener('input', function(e) {
    if (e.target && (e.target.id === 'claim-input' || e.target.id === 'url-input')) {
        updateButtonState();
    }
});

function updateButtonState() {
    const isValid = isFormValid();
    if (verifyButton) verifyButton.disabled = !isValid || isLoading;
    if (verifyButton) verifyButton.style.opacity = (isValid && !isLoading) ? '1' : '0.6';
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        const isTextarea = activeElement && activeElement.tagName === 'TEXTAREA';
        if (!isTextarea || (isTextarea && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            if (isFormValid() && !isLoading) handleSubmit();
        }
    }
    if (e.key === 'Escape') {
        hideResults();
    }
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Preload animations - lighten the animation to reduce perceived lag
window.addEventListener('load', function() {
    document.body.style.opacity = '1';
});

// Debounced scroll
let scrollTimeout;
function debouncedScroll() {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(handleScroll, 50);
}

// Ripple effect (touch-friendly guard)
function addRippleEffect(element, e) {
    try {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const clientX = (e.touches && e.touches[0] && e.touches[0].clientX) || e.clientX || rect.left + rect.width/2;
        const clientY = (e.touches && e.touches[0] && e.touches[0].clientY) || e.clientY || rect.top + rect.height/2;
        const x = clientX - rect.left - size / 2;
        const y = clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    } catch (err) {
        // no-op
    }
}

document.addEventListener('click', function(e){
    if (e.target && e.target.tagName === 'BUTTON') {
        addRippleEffect(e.target, e);
    }
});

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', function(){
    const textarea = document.getElementById('claim-input');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.max(120, this.scrollHeight) + 'px';
        });
    }
});

function manageFocus() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const input = activeTab.querySelector('input, textarea');
    if (input) input.focus();
}

// Raw JSON debug button (attach if element exists)
function attachRawJsonButton() {
    const rawBtn = document.getElementById('raw-json-btn');
    if (!rawBtn) return;
    rawBtn.addEventListener('click', () => {
        const payload = window._lastResponse || _lastResponse || {};
        alert(JSON.stringify(payload, null, 2));
    });
}

// small helper to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

console.log('TruthLens web client initialized 🚀');