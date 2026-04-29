/**
 * LUMINA PRO - UNIVERSAL INJECTION ENGINE (UNIFIED VERSION)
 * Features: Leaf-Node Filtering, CSS Armor, Mutation Recovery, & Port-8000 Lock
 */

// 1. LISTEN FOR THE AUDIT SIGNAL
chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "run_audit") startAudit();
});

// 2. THE CORE AUDIT LOGIC (UPDATED)
async function startAudit() {
    console.log("Lumina Pro: Initiating Anti-Collision Scan...");

    // A. CLEAR OLD MARKERS: Prevents the model from scanning its own UI badges
    document.querySelectorAll('[data-lumina-marked]').forEach(el => {
        el.removeAttribute('data-lumina-marked');
        el.style.outline = "none";
        const oldBadge = el.querySelector('.lumina-badge');
        if (oldBadge) oldBadge.remove();
    });

    // B. PRECISION FILTERING: Grab candidate elements
    const allCandidateElements = Array.from(document.querySelectorAll('button, a, span, p, h1, h2, h3, li, b, i, strong, div, section'))
        .filter(el => {
            const text = el.innerText?.trim();
            return text && text.length > 2 && text.length < 160;
        });

    // C. LEAF-NODE FILTER (ANTI-OVERLAP): Only scan the deepest element containing the text
    const elements = allCandidateElements.filter(el => {
        const children = Array.from(el.querySelectorAll('*'));
        const hasCandidateChild = children.some(child => allCandidateElements.includes(child));
        return !hasCandidateChild;
    }).slice(0, 35); 

    const toScan = elements.map((el, i) => ({ id: i, text_content: el.innerText.trim() }));

    if (toScan.length === 0) {
        chrome.runtime.sendMessage({ action: "audit_done", payload: { integrity_score: 100, verdict: "SECURE" }});
        return;
    }

    try {
        // D. PERMANENT PORT 8000 LOCK
        const resp = await fetch("http://127.0.0.1:8000/analyze_site", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: window.location.href, elements: toScan })
        });
        
        const data = await resp.json();
        
        // E. PRECISION MARKING
        if (data.findings && data.findings.length > 0) {
            data.findings.forEach(f => {
                if (elements[f.id]) injectHighEndUI(elements[f.id], f);
            });
        }
        
        // F. UPDATE POPUP/DASHBOARD (With Score Fallback)
        chrome.runtime.sendMessage({ 
            action: "audit_done", 
            payload: { 
                integrity_score: data.integrity_score ?? 100, 
                verdict: data.verdict || "SECURE",
                findings: data.findings 
            } 
        });

    } catch (e) {
        console.error("Lumina Pro Connection Error:", e);
        chrome.runtime.sendMessage({ action: "audit_done", payload: { integrity_score: 0, verdict: "OFFLINE" }});
    }
}

// 3. THE "CSS-ARMORED" UI INJECTOR
function injectHighEndUI(el, data) {
    if (el.getAttribute('data-lumina-marked')) return;
    el.setAttribute('data-lumina-marked', 'true');

    const style = window.getComputedStyle(el);

    // Ensure the badge is never hidden
    if (style.overflow === 'hidden' || style.overflow === 'clip') {
        el.style.setProperty('overflow', 'visible', 'important');
    }

    if (style.position === 'static') {
        el.style.position = "relative";
    }

    el.style.outline = "2px solid #ef4444";
    el.style.outlineOffset = "1px";

    const badge = document.createElement('div');
    badge.className = 'lumina-badge'; // Added class for easy cleanup
    Object.assign(badge.style, {
        position: 'absolute',
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '2px 5px',
        borderRadius: '3px',
        fontSize: '9px',
        fontWeight: '900',
        zIndex: '2147483647',
        top: '0px',
        left: '0px',
        transform: 'translateY(-105%)',
        pointerEvents: 'auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        fontFamily: 'sans-serif',
        cursor: 'help'
    });

    badge.innerHTML = `⚠️ ${data.type.toUpperCase()}`;
    badge.title = `Lumina Detection: ${data.explanation || 'Deceptive Pattern'}`;
    
    el.appendChild(badge);
}

// 4. THE MUTATION OBSERVER (For Infinite Scrolling)
let scanTimeout;
const observer = new MutationObserver((mutations) => {
    let nodesAdded = false;
    mutations.forEach(m => { if (m.addedNodes.length > 0) nodesAdded = true; });

    if (nodesAdded) {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            console.log("Lumina Pro: New content detected. Re-auditing...");
            startAudit();
        }, 4000); // 4-second delay to avoid over-taxing the ML backend
    }
});

observer.observe(document.body, { childList: true, subtree: true });