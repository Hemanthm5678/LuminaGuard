document.getElementById('scan-btn').addEventListener('click', async () => {
    const btn = document.getElementById('scan-btn');
    const scoreText = document.getElementById('score-text');
    
    // 1. Disable button and start visual feedback
    btn.disabled = true;
    btn.innerText = "AUDITING...";
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    // 2. RESCUE TIMEOUT: If it takes more than 8 seconds, force-reset the button
    setTimeout(() => {
        if (btn.disabled) {
            btn.disabled = false;
            btn.innerText = "RE-TRY AUDIT";
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            console.log("Rescue Timeout Triggered: Resetting button.");
        }
    }, 8000); 
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "run_audit" });
    } else {
        btn.disabled = false;
        btn.innerText = "REFRESH TAB & TRY";
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "audit_done") {
        const btn = document.getElementById('scan-btn');
        const data = msg.payload;

        // 3. Re-enable the button immediately upon success
        btn.disabled = false;
        btn.innerText = "RE-RUN AUDIT";
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        
        document.getElementById('score-text').innerText = `${data.integrity_score}%`;
        document.getElementById('score-bar').style.width = `${data.integrity_score}%`;
        document.getElementById('verdict-label').innerText = data.verdict;

        const alertBox = document.getElementById('clone-alert');
        const link = document.getElementById('secure-link');

        if (data.is_fake) {
            alertBox.style.display = "block";
            link.href = data.original_url;
            link.innerText = `GO TO SECURE ${data.original_url.toUpperCase()} →`;
            document.getElementById('score-text').classList.add('text-red-500');
        } else {
            alertBox.style.display = "none";
            document.getElementById('score-text').classList.remove('text-red-500');
        }
    }
});