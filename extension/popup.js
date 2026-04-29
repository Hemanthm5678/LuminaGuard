document.getElementById('scan-btn').addEventListener('click', async () => {
    const statusBox = document.getElementById('status-box');
    
    // Show loading state
    statusBox.classList.remove('hidden');
    statusBox.textContent = "Initializing AI Scan...";
    statusBox.className = "bg-slate-800 p-3 rounded-lg border border-amber-500 text-amber-400 text-center text-sm mb-4";

    // We will wire this up to the content script in the next step
    setTimeout(() => {
        statusBox.textContent = "Connecting to page DOM...";
    }, 800);
});