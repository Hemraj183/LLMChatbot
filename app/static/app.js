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

// State
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('sessionId', sessionId);
}

const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Auto-resize textarea
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // Icon
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = role === 'user'
        ? '<i class="ri-user-smile-line"></i>'
        : '<i class="ri-openai-fill"></i>'; // Or robot icon

    // Content
    const content = document.createElement('div');
    content.className = 'content';

    if (role === 'assistant') {
        // Initial loading state or empty
        content.innerHTML = text ? marked.parse(text) : '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
        content.innerText = text; // User text is plain
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatHistory.appendChild(msgDiv);

    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return content; // Return content div for updating
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // UI Updates
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', text);
    const assistantContentDiv = appendMessage('assistant', ''); // Empty initially with loader

    let fullResponse = "";

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                model: "kimi-k2", // Default from frontend, backend also has fallback
                session_id: sessionId
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            fullResponse += chunk;

            // Re-render markdown with accumulated text
            // Optimization: For very long text, appending might be better than re-parsing everything,
            // but marked is fast enough for typical chat usage.
            assistantContentDiv.innerHTML = marked.parse(fullResponse);

            // Highlight code blocks
            assistantContentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

    } catch (err) {
        console.error(err);
        assistantContentDiv.innerHTML = `<p style="color: #ef4444;">Error: ${err.message}</p>`;
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function resetSession() {
    if (!confirm("Start a new chat? History will be cleared.")) return;

    // Generate new ID
    sessionId = crypto.randomUUID();
    localStorage.setItem('sessionId', sessionId);

    // visual cleanup
    chatHistory.innerHTML = `
        <div class="message assistant">
            <div class="avatar"><i class="ri-openai-fill"></i></div>
            <div class="content">
                <p>Hello! I am your AI assistant running locally on the DGX server. How can I help you with your code today?</p>
            </div>
        </div>
    `;

    // Optional: Tell backend to clear old session memory if needed, 
    // but simply changing ID effectively resets it.
}
