// Markdown configuration
marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// Markdown configuration
marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const roleSelect = document.getElementById('role-select');
    const resetBtn = document.querySelector('button[title="New Chat"]'); // Access by attribute

    // --- Event Listeners ---

    // Send Button
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Input Keydown (Enter to send)
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSession);
    }

    // --- Functions ---

    // Add copy buttons to code blocks
    function addCopyButtonsToCodeBlocks(container) {
        container.querySelectorAll('pre').forEach((pre) => {
            // Avoid adding multiple copy buttons
            if (pre.querySelector('.copy-btn')) return;

            const codeBlock = pre.querySelector('code');
            if (!codeBlock) return;

            const button = document.createElement('button');
            button.className = 'copy-btn';
            button.innerHTML = '<i class="ri-clipboard-line"></i>';
            button.title = 'Copy code';

            button.addEventListener('click', async () => {
                const code = codeBlock.textContent;
                try {
                    await navigator.clipboard.writeText(code);
                    button.innerHTML = '<i class="ri-check-line"></i>';
                    button.style.background = 'rgba(34, 197, 94, 0.2)';
                    button.style.color = '#22c55e';

                    setTimeout(() => {
                        button.innerHTML = '<i class="ri-clipboard-line"></i>';
                        button.style.background = '';
                        button.style.color = '';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    button.innerHTML = '<i class="ri-error-warning-line"></i>';
                    setTimeout(() => {
                        button.innerHTML = '<i class="ri-clipboard-line"></i>';
                    }, 2000);
                }
            });

            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }

    // --- Functions ---

    // Load models dynamically
    async function loadModels() {
        if (!modelSelect) return;

        // Show loading state
        const originalText = modelSelect.options[modelSelect.selectedIndex]?.text || "Loading...";
        const loadingOption = document.createElement('option');
        loadingOption.text = "Fetching models...";
        modelSelect.add(loadingOption);
        modelSelect.disabled = true;

        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            const models = data.models || [];

            modelSelect.innerHTML = ''; // Clear defaults/loading

            if (models.length === 0) {
                const option = document.createElement('option');
                option.text = "No models found (Check Ollama)";
                modelSelect.add(option);
                return;
            }

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.text = model;
                // Auto-select preference order: exact match -> contains match -> first
                if (model.includes("llama3.1:8b")) {
                    option.selected = true;
                } else if (model.includes("qwen") && !modelSelect.value) {
                    // If no specific match yet, prefer qwen
                    // logic can be complex, let's keep it simple: defaults to first if no match
                }
                modelSelect.add(option);
            });

            // Restore selection if possible, or default to first
            if (modelSelect.options.length > 0) {
                modelSelect.disabled = false;
            }

        } catch (err) {
            console.warn("Failed to load models.", err);
            modelSelect.innerHTML = '<option>Connection Failed</option>';
            showError("Could not fetch models. Is Ollama running?");
        } finally {
            modelSelect.disabled = false;
        }
    }

    // Refresh Button Handler (Sync Models)
    // We reuse the existing "New Chat" button icon for now, OR valid if I add a new button.
    // Wait, the plan said "Add a Refresh Models button action to the existing refresh icon".
    // The existing icon is title="New Chat" (onClick resetSession). 
    // I should probably add a dedicated button in HTML next.
    // For now, I'll add the function `window.refreshModels = loadModels;` so I can call it from HTML.
    window.refreshModels = loadModels;

    // Auto-load
    loadModels();

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        // Icon
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = role === 'user'
            ? '<i class="ri-user-smile-line"></i>'
            : '<i class="ri-shield-user-fill"></i>';

        // Content
        const content = document.createElement('div');
        content.className = 'content';

        if (role === 'assistant') {
            content.innerHTML = text ? marked.parse(text) : '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        } else {
            content.innerText = text;
        }

        msgDiv.appendChild(avatar);
        msgDiv.appendChild(content);
        chatHistory.appendChild(msgDiv);

        chatHistory.scrollTop = chatHistory.scrollHeight;

        return content;
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // UI Updates
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;

        appendMessage('user', text);
        const assistantContentDiv = appendMessage('assistant', '');

        let fullResponse = "";

        try {
            const model = modelSelect.value;
            const role = roleSelect ? roleSelect.value : "general";

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    model: model,
                    role_mode: role,
                    session_id: sessionId
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let metrics = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);

                // Check for metadata
                if (chunk.includes("__METADATA__")) {
                    const parts = chunk.split("__METADATA__");
                    fullResponse += parts[0]; // Content before metadata if any

                    try {
                        metrics = JSON.parse(parts[1]);
                    } catch (e) {
                        console.error("Failed to parse metadata", e);
                    }
                } else {
                    fullResponse += chunk;
                }

                assistantContentDiv.innerHTML = marked.parse(fullResponse);

                // Highlight code blocks and add copy buttons
                assistantContentDiv.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
                addCopyButtonsToCodeBlocks(assistantContentDiv);

                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

            // Append metrics if available
            if (metrics) {
                const metricsDiv = document.createElement('div');
                metricsDiv.className = 'metrics';
                metricsDiv.innerHTML = `${metrics.tps} tps | ${metrics.tokens} tokens | ${metrics.duration_s}s`;
                assistantContentDiv.appendChild(metricsDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }

        } catch (err) {
            console.error(err);
            assistantContentDiv.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 1rem; border-radius: 8px; color: #fca5a5;">
                    <strong>Error:</strong> ${err.message}<br>
                    <small>Check if Ollama is running and accessible.</small>
                </div>`;
        } finally {
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    // UUID Generator (Polyfill for non-secure contexts)
    function generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async function resetSession() {
        if (!confirm("Start a new chat? History will be cleared.")) return;

        sessionId = generateUUID();
        localStorage.setItem('sessionId', sessionId);

        chatHistory.innerHTML = `
            <div class="message assistant">
                <div class="avatar"><i class="ri-shield-user-fill"></i></div>
                <div class="content">
                    <p>Hello! I am the AuditPartnership Bot running locally on the DGX server. How can I assist you today?</p>
                </div>
            </div>
        `;
    }

    // Initialize
    console.log("App script loaded.");
    const statusDiv = document.getElementById('connection-status');
    const errorDiv = document.getElementById('error-display');

    // Check session on load
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem('sessionId', sessionId);
    }

    // Global Error Handler
    window.onerror = function (message, source, lineno, colno, error) {
        showError(`JS Error: ${message} (${source}:${lineno})`);
        return false;
    };

    function showError(msg) {
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML += `<div>${msg}</div>`;
        }
        console.error(msg);
    }

    function updateStatus(msg, type = 'info') {
        if (!statusDiv) return;
        statusDiv.style.display = 'block';
        statusDiv.textContent = msg;
        if (type === 'error') statusDiv.style.background = '#ef4444'; // Red
        else if (type === 'success') statusDiv.style.background = '#22c55e'; // Green
        else statusDiv.style.background = '#eab308'; // Yellow
    }

    // Health Check
    async function checkHealth() {
        updateStatus("Checking connection...", "info");
        try {
            const res = await fetch('/health');
            const data = await res.json();
            if (res.ok) {
                const ollamaStatus = data.ollama_connected ? "Ollama Online" : "Ollama Offline";
                updateStatus(`Server Online | ${ollamaStatus}`, data.ollama_connected ? 'success' : 'warn');
            } else {
                updateStatus(`Server Error: ${res.status}`, 'error');
            }
        } catch (err) {
            updateStatus(`Connection Failed: ${err.message}`, 'error');
            showError(`Health check failed: ${err.message}. Are you on the same network?`);
        }
    }

    // Call health check on load
    checkHealth();
    loadModels();

    // Privacy Warning Modal - Only for Cloud Deployments
    const privacyModal = document.getElementById('privacy-modal');
    const privacyAccept = document.getElementById('privacy-accept');
    const hasAcceptedPrivacy = localStorage.getItem('privacyAccepted');

    // Check if this is a cloud deployment and show modal accordingly
    async function checkAndShowPrivacyModal() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();

            // Only show privacy modal for cloud deployments
            if (config.is_cloud && !hasAcceptedPrivacy) {
                if (privacyModal) {
                    privacyModal.style.display = 'flex';
                }
            }
        } catch (err) {
            console.warn('Failed to check cloud status:', err);
            // Default to not showing modal if we can't determine cloud status
        }
    }

    // Call the function on load
    checkAndShowPrivacyModal();

    // Handle privacy acceptance
    if (privacyAccept) {
        privacyAccept.addEventListener('click', () => {
            localStorage.setItem('privacyAccepted', 'true');
            if (privacyModal) {
                privacyModal.style.display = 'none';
            }
        });

        // Add hover effect
        privacyAccept.addEventListener('mouseenter', () => {
            privacyAccept.style.transform = 'scale(1.02)';
        });
        privacyAccept.addEventListener('mouseleave', () => {
            privacyAccept.style.transform = 'scale(1)';
        });
    }
});
