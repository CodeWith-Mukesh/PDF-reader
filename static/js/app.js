/**
 * FlexiParse - Modern Interactive Web App Logic
 */

let isProcessing = false;
let currentPdfFile = null;
let chatHistory = [];
let speechRecognition = null;
let isRecording = false;
let currentSpeakingBtn = null;
let soundFxEnabled = localStorage.getItem('flexiparse-sound') !== 'false'; // default on

document.addEventListener('DOMContentLoaded', () => {
    initBackgroundParticles();
    initTheme();
    initDropzone();
    initChat();
    initSpeechRecognition();
    initTools();
    initSoundFx();
});

/* ==========================================================================
   Theme Management
   ========================================================================== */
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('flexiparse-theme') || 'dark';
    
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('flexiparse-theme', newTheme);
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        if (theme === 'light') {
            themeIcon.setAttribute('data-lucide', 'moon');
        } else {
            themeIcon.setAttribute('data-lucide', 'sun');
        }
        if (window.lucide) lucide.createIcons();
    }
}

/* ==========================================================================
   File Dropzone & Upload
   ========================================================================== */
function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    const removeFileBtn = document.getElementById('remove-file-btn');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', resetFileUpload);
    }
}

function handleFileSelect(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a valid PDF document.', 'error');
        return;
    }

    currentPdfFile = file;
    displayActiveFile(file);
    uploadPdfToServer(file);
}

function displayActiveFile(file) {
    const dropzone = document.getElementById('dropzone');
    const activeFileCard = document.getElementById('active-file-card');
    const fileNameEl = document.getElementById('active-file-name');
    const fileMetaEl = document.getElementById('active-file-meta');

    if (dropzone) dropzone.style.display = 'none';
    if (activeFileCard) activeFileCard.style.display = 'block';

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileMetaEl) fileMetaEl.textContent = `${formatBytes(file.size)} • PDF Document`;
}

function resetFileUpload() {
    currentPdfFile = null;
    const fileInput = document.getElementById('pdf-file-input');
    const dropzone = document.getElementById('dropzone');
    const activeFileCard = document.getElementById('active-file-card');
    const progressContainer = document.getElementById('upload-progress');

    if (fileInput) fileInput.value = '';
    if (dropzone) dropzone.style.display = 'flex';
    if (activeFileCard) activeFileCard.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'none';

    updateStatusPill('No Document', 'idle');
    showToast('Document cleared.', 'info');
}

async function uploadPdfToServer(file) {
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const progressPercent = document.getElementById('progress-percent');

    if (progressContainer) progressContainer.style.display = 'block';
    updateStatusPill('Processing...', 'busy');

    // Simulate progressive stages
    let progress = 15;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressLabel) progressLabel.textContent = 'Uploading document...';
    if (progressPercent) progressPercent.textContent = `${progress}%`;

    const progressInterval = setInterval(() => {
        if (progress < 85) {
            progress += 10;
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = `${progress}%`;
            if (progress >= 50 && progressLabel) {
                progressLabel.textContent = 'Generating vector embeddings...';
            }
        }
    }, 350);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload PDF');
        }

        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Ready to query!';

        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 1500);

        updateStatusPill('Ready', 'ready');
        showToast('Document processed successfully!', 'success');
        triggerConfetti();

        // Add friendly system prompt to chat
        addSystemGreeting(file.name);

    } catch (err) {
        clearInterval(progressInterval);
        if (progressContainer) progressContainer.style.display = 'none';
        updateStatusPill('Error', 'idle');
        showToast(err.message, 'error');
    }
}

function updateStatusPill(text, state) {
    const pill = document.getElementById('status-pill');
    const pillText = document.getElementById('status-text');
    if (!pill || !pillText) return;

    pill.className = 'status-pill';
    if (state === 'ready') pill.classList.add('ready');
    if (state === 'busy') pill.classList.add('busy');

    pillText.textContent = text;
}

/* ==========================================================================
   Chat Interactions
   ========================================================================== */
function initChat() {
    const chatForm = document.getElementById('chat-form');
    const chatTextarea = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    if (chatTextarea) {
        chatTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuestion();
            }
        });

        // Auto-expand textarea
        chatTextarea.addEventListener('input', () => {
            chatTextarea.style.height = 'auto';
            chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px';
            if (sendBtn) {
                sendBtn.disabled = !chatTextarea.value.trim();
            }
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitQuestion();
        });
    }

    // Suggested prompt chips & Bento cards
    document.querySelectorAll('.prompt-chip, .bento-card').forEach(item => {
        item.addEventListener('click', () => {
            const prompt = item.getAttribute('data-prompt');
            if (prompt) {
                if (chatTextarea) chatTextarea.value = prompt;
                submitQuestion();
            }
        });
    });
}

async function submitQuestion() {
    const chatTextarea = document.getElementById('chat-input');
    const question = chatTextarea ? chatTextarea.value.trim() : '';

    if (!question || isProcessing) return;

    if (!currentPdfFile) {
        showToast('Please upload a PDF document first!', 'error');
        return;
    }

    // Hide empty welcome screen
    const welcomeScreen = document.getElementById('chat-welcome');
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    // Append user message
    addMessage(question, 'user');
    playAudioFx('send');
    chatTextarea.value = '';
    chatTextarea.style.height = 'auto';
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Glowing energy state on chatbox
    const chatPanel = document.querySelector('.chat-panel');
    if (chatPanel) chatPanel.classList.add('querying');

    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    isProcessing = true;

    try {
        const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        });

        const data = await response.json();
        removeTypingIndicator(typingIndicator);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to retrieve answer');
        }

        const answer = data.answer || 'No response generated.';
        addMessage(answer, 'bot');
        playAudioFx('receive');

    } catch (err) {
        removeTypingIndicator(typingIndicator);
        addMessage(`**Error:** ${err.message}`, 'bot');
        showToast(err.message, 'error');
    } finally {
        if (chatPanel) chatPanel.classList.remove('querying');
        isProcessing = false;
        if (sendBtn) sendBtn.disabled = false;
        if (chatTextarea) chatTextarea.focus();
    }
}

function addMessage(content, sender) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    chatHistory.push({ sender, content, time: new Date() });

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = sender === 'bot' 
        ? '<i data-lucide="bot"></i>' 
        : '<i data-lucide="user"></i>';

    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.style.display = 'flex';
    bubbleWrapper.style.flexDirection = 'column';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (sender === 'bot') {
        // Parse markdown if marked is loaded
        if (window.marked) {
            bubble.innerHTML = marked.parse(content);
        } else {
            bubble.textContent = content;
        }

        // Highlight code blocks
        if (window.hljs) {
            bubble.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    } else {
        bubble.textContent = content;
    }

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    footer.appendChild(timeSpan);

    if (sender === 'bot') {
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i> Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                showToast('Copied to clipboard!', 'info');
            });
        });
        footer.appendChild(copyBtn);

        // Speak / Stop button
        if ('speechSynthesis' in window) {
            const speakBtn = document.createElement('button');
            speakBtn.className = 'msg-action-btn';
            speakBtn.title = 'Speak response aloud';
            speakBtn.innerHTML = '<i data-lucide="volume-2" style="width:12px;height:12px;"></i> Speak';
            speakBtn.addEventListener('click', () => {
                toggleSpeak(content, speakBtn);
            });
            footer.appendChild(speakBtn);
        }

        // Reactions (Helpful / Unhelpful)
        const helpfulBtn = document.createElement('button');
        helpfulBtn.className = 'msg-reaction-btn';
        helpfulBtn.innerHTML = '<i data-lucide="thumbs-up" style="width:12px;height:12px;"></i>';
        helpfulBtn.title = 'Helpful response';
        helpfulBtn.addEventListener('click', () => {
            helpfulBtn.classList.toggle('voted');
            showToast('Thanks for your feedback!', 'success');
        });
        footer.appendChild(helpfulBtn);

        const unhelpfulBtn = document.createElement('button');
        unhelpfulBtn.className = 'msg-reaction-btn';
        unhelpfulBtn.innerHTML = '<i data-lucide="thumbs-down" style="width:12px;height:12px;"></i>';
        unhelpfulBtn.title = 'Needs improvement';
        unhelpfulBtn.addEventListener('click', () => {
            unhelpfulBtn.classList.toggle('voted');
            showToast('Feedback noted.', 'info');
        });
        footer.appendChild(unhelpfulBtn);
    }

    bubbleWrapper.appendChild(bubble);
    bubbleWrapper.appendChild(footer);

    messageRow.appendChild(avatar);
    messageRow.appendChild(bubbleWrapper);
    chatMessages.appendChild(messageRow);

    if (window.lucide) lucide.createIcons();
    scrollToBottom();
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return null;

    const row = document.createElement('div');
    row.className = 'message-row bot typing-row';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = '<i data-lucide="bot"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';
    bubble.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatMessages.appendChild(row);

    if (window.lucide) lucide.createIcons();
    scrollToBottom();
    return row;
}

function removeTypingIndicator(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

function addSystemGreeting(filename) {
    const welcomeScreen = document.getElementById('chat-welcome');
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    addMessage(`I've analyzed **${filename}** and prepared the vector database. Ask me anything about its contents, key takeaways, or specific queries!`, 'bot');
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/* ==========================================================================
   Speech Synthesis & Speech Recognition
   ========================================================================== */
function stopSpeaking() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (currentSpeakingBtn) {
        currentSpeakingBtn.innerHTML = '<i data-lucide="volume-2" style="width:12px;height:12px;"></i> Speak';
        currentSpeakingBtn.classList.remove('speaking');
        currentSpeakingBtn.title = 'Speak response aloud';
        currentSpeakingBtn = null;
        if (window.lucide) lucide.createIcons();
    }
}

function toggleSpeak(text, btn) {
    if (!('speechSynthesis' in window)) return;

    // If already speaking this message, stop it immediately
    if (currentSpeakingBtn === btn) {
        stopSpeaking();
        showToast('Speech stopped.', 'info');
        return;
    }

    // Stop any previously playing speech
    stopSpeaking();

    // Strip markdown formatting for voice
    const cleanText = text.replace(/[#*_`~\[\]\(\)]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;

    currentSpeakingBtn = btn;
    btn.innerHTML = '<i data-lucide="square" style="width:11px;height:11px;fill:currentColor;"></i> Stop';
    btn.classList.add('speaking');
    btn.title = 'Stop speech playback';
    if (window.lucide) lucide.createIcons();

    utterance.onend = () => {
        if (currentSpeakingBtn === btn) {
            stopSpeaking();
        }
    };

    utterance.onerror = () => {
        if (currentSpeakingBtn === btn) {
            stopSpeaking();
        }
    };

    window.speechSynthesis.speak(utterance);
}

function initSpeechRecognition() {
    const voiceBtn = document.getElementById('voice-input-btn');
    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
        return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
        isRecording = true;
        voiceBtn.style.color = 'var(--accent-rose)';
        showToast('Listening... speak now', 'info');
    };

    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = transcript;
            chatInput.focus();
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) sendBtn.disabled = false;
        }
    };

    speechRecognition.onerror = (event) => {
        showToast(`Voice error: ${event.error}`, 'error');
    };

    speechRecognition.onend = () => {
        isRecording = false;
        voiceBtn.style.color = '';
    };

    voiceBtn.addEventListener('click', () => {
        if (!isRecording) {
            speechRecognition.start();
        } else {
            speechRecognition.stop();
        }
    });
}

/* ==========================================================================
   Chat Export & Tools
   ========================================================================== */
function initTools() {
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const exportChatBtn = document.getElementById('export-chat-btn');

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (chatHistory.length === 0) return;
            if (confirm('Clear the conversation history?')) {
                stopSpeaking();
                const chatMessages = document.getElementById('chat-messages');
                const welcomeScreen = document.getElementById('chat-welcome');
                if (chatMessages) chatMessages.innerHTML = '';
                if (welcomeScreen) {
                    chatMessages.appendChild(welcomeScreen);
                    welcomeScreen.style.display = 'flex';
                }
                chatHistory = [];
                showToast('Chat history cleared', 'info');
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        stopSpeaking();
    });

    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', exportChatHistory);
    }
}

function exportChatHistory() {
    if (chatHistory.length === 0) {
        showToast('No messages to export.', 'info');
        return;
    }

    let markdown = `# FlexiParse Conversation Export\n\n`;
    markdown += `*Generated on ${new Date().toLocaleString()}*\n`;
    if (currentPdfFile) markdown += `*Document: ${currentPdfFile.name}*\n\n---\n\n`;

    chatHistory.forEach(msg => {
        const role = msg.sender === 'bot' ? 'FlexiParse AI' : 'User';
        markdown += `### ${role} (${msg.time.toLocaleTimeString()})\n\n${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlexiParse-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Conversation exported as Markdown!', 'success');
}

/* ==========================================================================
   Utilities
   ========================================================================== */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `<i data-lucide="${iconName}" style="width:18px;height:18px;flex-shrink:0;"></i> <span>${message}</span>`;
    container.appendChild(toast);

    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#6366f1', '#06b6d4', '#10b981']
        });
    }
}

/* ==========================================================================
   Animated Background Particle Constellation
   ========================================================================== */
function initBackgroundParticles() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const numParticles = Math.min(Math.floor((width * height) / 18000), 65);
    const particles = [];

    for (let i = 0; i < numParticles; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            radius: Math.random() * 1.8 + 0.8,
            alpha: Math.random() * 0.5 + 0.25,
            color: Math.random() > 0.4 ? '#6366f1' : '#06b6d4'
        });
    }

    let mouseX = -1000;
    let mouseY = -1000;
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function render() {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            // Draw particle node
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();

            // Connect nearby nodes
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 115) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = '#6366f1';
                    ctx.globalAlpha = (1 - dist / 115) * 0.18;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(render);
    }

    render();
}

/* ==========================================================================
   Sound FX Engine (Web Audio API Synthesizer)
   ========================================================================== */
function initSoundFx() {
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (!soundBtn) return;

    updateSoundBtnUi(soundBtn);

    soundBtn.addEventListener('click', () => {
        soundFxEnabled = !soundFxEnabled;
        localStorage.setItem('flexiparse-sound', soundFxEnabled);
        updateSoundBtnUi(soundBtn);
        showToast(soundFxEnabled ? 'Sound FX enabled' : 'Sound FX muted', 'info');
        if (soundFxEnabled) playAudioFx('send');
    });
}

function updateSoundBtnUi(btn) {
    if (!btn) return;
    if (soundFxEnabled) {
        btn.classList.add('active');
        btn.innerHTML = '<i data-lucide="volume-2" style="width:16px;height:16px;"></i>';
        btn.title = 'Sound FX: ON (Click to mute)';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i data-lucide="volume-x" style="width:16px;height:16px;"></i>';
        btn.title = 'Sound FX: MUTED (Click to enable)';
    }
    if (window.lucide) lucide.createIcons();
}

function playAudioFx(type) {
    if (!soundFxEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (type === 'send') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'receive') {
            const now = ctx.currentTime;
            [523.25, 659.25].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.07);

                gain.gain.setValueAtTime(0.09, now + i * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.16);

                osc.start(now + i * 0.07);
                osc.stop(now + i * 0.07 + 0.17);
            });
        }
    } catch (e) {
        // AudioContext autoplay restriction fallback
    }
}
