// --- Configuration ---
marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// --- Constants & Global Scope ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

let sessionId = localStorage.getItem('sessionId') || generateUUID();
let turboModeEnabled = localStorage.getItem('turboModeEnabled') === 'true';
let attachedImages = [];

// --- Page Initialization ---
function initApp() {
    console.log("AuditPartnership Bot: Initializing...");
    localStorage.setItem('sessionId', sessionId);

    // DOM Elements
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const roleSelect = document.getElementById('role-select');
    const turboToggle = document.getElementById('turbo-toggle');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const filePreviews = document.getElementById('file-previews');
    const sidebarChats = document.getElementById('sidebar-chats');
    const newChatBtn = document.getElementById('new-chat-sidebar-btn');
    const statusTag = document.getElementById('connection-status');
    const errorDiv = document.getElementById('error-display');

    // --- Core Functions (Defined before use) ---

    const updateStatus = (msg, type = 'info') => {
        if (!statusTag) return;
        statusTag.textContent = msg;
        statusTag.style.background = (type === 'success') ? '#10b981' : (type === 'error' ? '#ef4444' : 'rgba(240, 223, 24, 0.2)');
        statusTag.style.color = (type === 'info') ? '#facc15' : 'white';
    };

    const updateTurboUI = () => {
        if (!turboToggle) return;
        turboToggle.classList.toggle('active', turboModeEnabled);
        turboToggle.style.color = turboModeEnabled ? 'var(--primary-color)' : '';
    };

    const updateSidebar = () => {
        try {
            const raw = localStorage.getItem('chatHistory');
            const history = (raw && raw !== "undefined") ? JSON.parse(raw) : [];
            if (!Array.isArray(history) || history.length === 0) {
                if (sidebarChats) sidebarChats.innerHTML = '<div class="sidebar-empty">No conversations yet</div>';
                return;
            }
            if (sidebarChats) {
                sidebarChats.innerHTML = [...history].reverse().map(h => `<div class="sidebar-item" title="${h.title || ''}">${h.title || 'Untitled'}</div>`).join('');
            }
        } catch (e) {
            console.error("Sidebar update failed", e);
        }
    };

    const loadModels = async () => {
        console.log("AuditPartnership Bot: Fetching models...");
        if (!modelSelect) return;
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                const saved = localStorage.getItem('selectedModel');
                modelSelect.innerHTML = data.models.map(m => {
                    const sel = (saved && m === saved) || (!saved && m.includes('llama3.1:8b'));
                    return `<option value="${m}" ${sel ? 'selected' : ''}>${m}</option>`;
                }).join('');
                if (sendBtn) sendBtn.disabled = false;
                console.log("AuditPartnership Bot: Models loaded.");
            } else {
                modelSelect.innerHTML = '<option value="">No models available</option>';
            }
        } catch (e) {
            console.error("Model fetch failed", e);
            modelSelect.innerHTML = '<option value="">Fetch Failed</option>';
        }
    };

    const checkHealth = async () => {
        try {
            const res = await fetch('/health');
            const data = await res.json();
            if (data.ollama_connected) {
                updateStatus("Online", "success");
            } else {
                updateStatus("Ollama Offline", "error");
            }
        } catch (e) {
            updateStatus("Connection Lost", "error");
        }
    };

    const resetSession = () => {
        if (!confirm("Start new conversation?")) return;
        sessionId = generateUUID();
        localStorage.setItem('sessionId', sessionId);
        if (chatHistory) chatHistory.innerHTML = `<div class="message assistant"><div class="avatar"><i class="ri-shield-user-fill"></i></div><div class="content"><p>Hello! I am the AuditPartnership Bot. How can I assist you today?</p></div></div>`;
        attachedImages = [];
        if (filePreviews) filePreviews.innerHTML = '';
        if (fileInput) fileInput.value = '';
    };

    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text && attachedImages.length === 0) return;

        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;

        const currentImages = [...attachedImages];
        attachedImages = [];
        if (filePreviews) filePreviews.innerHTML = '';
        if (fileInput) fileInput.value = '';

        appendMessage('user', text, currentImages);
        const assistantContentDiv = appendMessage('assistant', '');
        let fullResponse = "";

        try {
            const payload = {
                message: text,
                model: modelSelect.value,
                role_mode: roleSelect ? roleSelect.value : "general",
                session_id: sessionId,
                images: currentImages.length > 0 ? currentImages : null
            };

            if (turboModeEnabled) {
                payload.options = { num_gpu: -1, num_thread: 16, num_ctx: 4096 };
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let metrics = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                if (chunk.includes("__METADATA__")) {
                    const parts = chunk.split("__METADATA__");
                    fullResponse += parts[0];
                    try { metrics = JSON.parse(parts[1]); } catch (e) { }
                } else {
                    fullResponse += chunk;
                }

                assistantContentDiv.innerHTML = marked.parse(fullResponse);
                renderCodeBlocks(assistantContentDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

            if (metrics) renderMetrics(assistantContentDiv, metrics);
            saveToSidebar();

        } catch (err) {
            assistantContentDiv.innerHTML = `<div class="error-box"><strong>Error:</strong> ${err.message}</div>`;
        } finally {
            sendBtn.disabled = false;
            userInput.focus();
        }
    };

    // --- Message Helpers ---

    function appendMessage(role, text, images = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = role === 'user' ? '<i class="ri-user-smile-line"></i>' : '<i class="ri-shield-user-fill"></i>';
        const content = document.createElement('div');
        content.className = 'content';

        if (images.length > 0) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'message-images';
            images.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = `data:image/jpeg;base64,${img}`;
                imgEl.className = 'msg-image';
                imgContainer.appendChild(imgEl);
            });
            content.appendChild(imgContainer);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        if (role === 'assistant') {
            textDiv.innerHTML = text ? marked.parse(text) : '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        } else {
            textDiv.innerText = text;
        }
        content.appendChild(textDiv);
        msgDiv.appendChild(avatar);
        msgDiv.appendChild(content);
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return textDiv;
    }

    function renderCodeBlocks(container) {
        container.querySelectorAll('pre').forEach((pre) => {
            if (pre.dataset.processed) return;
            pre.dataset.processed = 'true';
            const code = pre.querySelector('code');
            if (!code) return;
            let lang = 'code';
            const cls = Array.from(code.classList).find(c => c.startsWith('language-'));
            if (cls) lang = cls.replace('language-', '');
            const header = document.createElement('div');
            header.className = 'code-header';
            header.innerHTML = `<span class="lang-label">${lang.toUpperCase()}</span><button class="copy-btn-new"><i class="ri-clipboard-line"></i> Copy</button>`;
            header.querySelector('.copy-btn-new').onclick = function () { copyCode(code.textContent, this); };
            pre.parentNode.insertBefore(header, pre);
            hljs.highlightElement(code);
        });
    }

    async function copyCode(code, btn) {
        let ok = false;
        if (navigator.clipboard) try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { }
        if (!ok) {
            const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta);
            ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta);
        }
        if (ok) {
            btn.innerHTML = '<i class="ri-check-line"></i> Copied!';
            setTimeout(() => btn.innerHTML = '<i class="ri-clipboard-line"></i> Copy', 2000);
        }
    }

    function renderMetrics(container, m) {
        const div = document.createElement('div');
        div.className = 'metrics';
        div.innerHTML = `${m.tps} tps | ${m.tokens} tokens | ${m.duration_s}s`;
        container.appendChild(div);
    }

    function saveToSidebar() {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const first = chatHistory.querySelector('.message.user .message-text')?.innerText || "New Conversation";
        if (!history.find(h => h.id === sessionId)) {
            history.push({ id: sessionId, title: first.substring(0, 30) + (first.length > 30 ? "..." : "") });
            localStorage.setItem('chatHistory', JSON.stringify(history));
        }
        updateSidebar();
    }

    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                attachedImages.push(base64);
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `<img src="${e.target.result}"><button class="remove-preview"><i class="ri-close-line"></i></button>`;
                div.querySelector('.remove-preview').onclick = function () {
                    const idx = attachedImages.indexOf(base64);
                    if (idx > -1) attachedImages.splice(idx, 1);
                    this.parentElement.remove();
                };
                filePreviews.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Initialization Execution ---
    updateTurboUI();
    updateSidebar();

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (turboToggle) turboToggle.addEventListener('click', () => { turboModeEnabled = !turboModeEnabled; localStorage.setItem('turboModeEnabled', turboModeEnabled); updateTurboUI(); });
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (newChatBtn) newChatBtn.addEventListener('click', resetSession);
    if (userInput) {
        userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        userInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; });
    }

    // Export globals
    window.refreshModels = loadModels;
    window.resetSession = resetSession;

    // Async startup
    checkHealth();
    loadModels();
    setInterval(checkHealth, 30000);
    checkAndShowPrivacyModal();
}

// --- Privacy Modal (Global Scope) ---
async function checkAndShowPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (!modal || localStorage.getItem('privacyAccepted')) return;
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        if (config.is_cloud) modal.style.display = 'flex';
    } catch (e) { }
    const accept = document.getElementById('privacy-accept');
    if (accept) {
        accept.onclick = () => { localStorage.setItem('privacyAccepted', 'true'); modal.style.display = 'none'; };
    }
}

// --- Entry Point ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
