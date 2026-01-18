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

// --- Constants & State ---
let sessionId = localStorage.getItem('sessionId') || generateUUID();
let turboModeEnabled = localStorage.getItem('turboModeEnabled') === 'true';
let attachedImages = []; // Stores base64 strings

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("AuditPartnership Bot: Initializing...");

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
    const statusDiv = document.getElementById('connection-status');
    const errorDiv = document.getElementById('error-display');

    // Persistence
    localStorage.setItem('sessionId', sessionId);
    updateTurboUI();
    updateSidebar();

    // --- Event Listeners ---

    if (turboToggle) {
        turboToggle.addEventListener('click', () => {
            turboModeEnabled = !turboModeEnabled;
            localStorage.setItem('turboModeEnabled', turboModeEnabled);
            updateTurboUI();
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }

    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (newChatBtn) newChatBtn.addEventListener('click', resetSession);
    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            localStorage.setItem('selectedModel', modelSelect.value);
            // Re-enable send button if we switch to a valid model
            if (modelSelect.value && sendBtn) sendBtn.disabled = false;
        });
    }

    // --- Core Functions ---

    async function loadModels() {
        console.log("AuditPartnership Bot: Fetching models...");
        if (!modelSelect) return;

        const savedModel = localStorage.getItem('selectedModel');
        modelSelect.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            // Using a controller to handle timeouts
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch('/api/models', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
            const data = await res.json();

            if (data.models && data.models.length > 0) {
                modelSelect.innerHTML = data.models.map(m => {
                    let isSelected = (savedModel && m === savedModel) || (!savedModel && m.includes('llama3.1:8b'));
                    return `<option value="${m}" ${isSelected ? 'selected' : ''}>${m}</option>`;
                }).join('');
                console.log(`AuditPartnership Bot: Loaded ${data.models.length} models.`);
            } else {
                modelSelect.innerHTML = '<option value="">No models available</option>';
            }
        } catch (err) {
            console.error("AuditPartnership Bot: loadModels Error:", err);
            showError("Failed to load models. Check if server is reachable.");
            modelSelect.innerHTML = '<option value="">Fetch Failed</option>';
        } finally {
            modelSelect.disabled = false;
            // Enable send button if we have a valid selected model
            if (modelSelect.value && modelSelect.value !== "") {
                if (sendBtn) sendBtn.disabled = false;
            }
        }
    }

    async function checkHealth() {
        if (!statusDiv) return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch('/health', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();

            if (data.ollama_connected) {
                updateStatus("Online", "success");
            } else {
                updateStatus("Ollama Offline", "error");
            }
        } catch (e) {
            console.warn("AuditPartnership Bot: health check failed", e);
            updateStatus("Connection Lost", "error");
        }
    }

    // Initialize after defining functions
    try {
        await checkHealth();
        await loadModels();
        setInterval(checkHealth, 30000);
    } catch (err) {
        console.error("AuditPartnership Bot: Initialization failed", err);
    }

    // --- Chat Logic ---

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text && attachedImages.length === 0) return;

        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;

        const currentImages = [...attachedImages];
        clearPreviews();

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

            if (!response.ok) throw new Error(`Server returned ${response.status}`);

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
    }

    // --- UI Helpers ---

    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                attachedImages.push(base64);
                renderPreview(e.target.result, attachedImages.length - 1);
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPreview(src, index) {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${src}">
            <button class="remove-preview" data-index="${index}"><i class="ri-close-line"></i></button>
        `;
        div.querySelector('.remove-preview').onclick = function () {
            const idx = parseInt(this.dataset.index);
            attachedImages.splice(idx, 1);
            this.parentElement.remove();
        };
        filePreviews.appendChild(div);
    }

    function clearPreviews() {
        attachedImages = [];
        filePreviews.innerHTML = '';
        fileInput.value = '';
    }

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
            const codeBlock = pre.querySelector('code');
            if (!codeBlock) return;
            let lang = 'code';
            const langClass = Array.from(codeBlock.classList).find(c => c.startsWith('language-'));
            if (langClass) lang = langClass.replace('language-', '');
            const header = document.createElement('div');
            header.className = 'code-header';
            header.innerHTML = `<span class="lang-label">${lang.toUpperCase()}</span><button class="copy-btn-new"><i class="ri-clipboard-line"></i> Copy</button>`;
            const btn = header.querySelector('.copy-btn-new');
            btn.onclick = () => copyCode(codeBlock.textContent, btn);
            pre.parentNode.insertBefore(header, pre);
            hljs.highlightElement(codeBlock);
        });
    }

    async function copyCode(code, btn) {
        let success = false;
        if (navigator.clipboard) try { await navigator.clipboard.writeText(code); success = true; } catch (e) { }
        if (!success) {
            const ta = document.createElement('textarea');
            ta.value = code; document.body.appendChild(ta);
            ta.select(); success = document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (success) {
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

    function updateTurboUI() {
        if (!turboToggle) return;
        turboToggle.classList.toggle('active', turboModeEnabled);
        turboToggle.style.color = turboModeEnabled ? 'var(--primary-color)' : '';
    }

    function updateSidebar() {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        if (history.length === 0) {
            sidebarChats.innerHTML = '<div class="sidebar-empty">No conversations yet</div>';
            return;
        }
        sidebarChats.innerHTML = [...history].reverse().map(h => `<div class="sidebar-item" title="${h.title}">${h.title}</div>`).join('');
    }

    function saveToSidebar() {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const firstUserMsg = chatHistory.querySelector('.message.user .message-text')?.innerText || "New Conversation";
        if (!history.find(h => h.id === sessionId)) {
            history.push({ id: sessionId, title: firstUserMsg.substring(0, 30) + (firstUserMsg.length > 30 ? "..." : "") });
            localStorage.setItem('chatHistory', JSON.stringify(history));
        }
        updateSidebar();
    }

    function resetSession() {
        if (!confirm("Start new conversation?")) return;
        sessionId = generateUUID();
        localStorage.setItem('sessionId', sessionId);
        chatHistory.innerHTML = `<div class="message assistant"><div class="avatar"><i class="ri-shield-user-fill"></i></div><div class="content"><p>Hello! I am the AuditPartnership Bot running locally on the DGX server. How can I assist you today?</p></div></div>`;
        clearPreviews();
    }
    window.resetSession = resetSession;
    window.refreshModels = loadModels;

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function showError(m) {
        if (errorDiv) {
            errorDiv.style.display = 'block'; errorDiv.textContent = m;
            setTimeout(() => { errorDiv.style.display = 'none'; }, 8000);
        }
    }

    function updateStatus(msg, type = 'info') {
        if (!statusDiv) return;
        statusDiv.textContent = msg;
        statusDiv.className = `status-tag status-${type}`;
        if (type === 'error') statusDiv.style.background = '#ef4444';
        else if (type === 'success') statusDiv.style.background = '#10b981';
        else statusDiv.style.background = 'rgba(240, 223, 24, 0.1)';
    }

    checkAndShowPrivacyModal();
});

// Privacy Modal Logic
async function checkAndShowPrivacyModal() {
    const privacyModal = document.getElementById('privacy-modal');
    if (!privacyModal || localStorage.getItem('privacyAccepted')) return;
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        if (config.is_cloud) privacyModal.style.display = 'flex';
    } catch (e) { }
    document.getElementById('privacy-accept')?.addEventListener('click', () => {
        localStorage.setItem('privacyAccepted', 'true');
        privacyModal.style.display = 'none';
    });
}
