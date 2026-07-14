// ============================================
//  STATE
// ============================================
const state = {
    mediaStream: null,
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    isPaused: false,
    startTime: null,
    timerInterval: null,
    elapsedTime: 0,
    pausedAt: null
};

// ============================================
//  DOM ELEMENTS
// ============================================
const elements = {
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    stopBtn: document.getElementById('stopBtn'),
    resetBtn: document.getElementById('resetBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    preview: document.getElementById('preview'),
    statusText: document.getElementById('statusText'),
    timer: document.getElementById('timer'),
    dot: document.querySelector('.dot')
};

// ============================================
//  EVENT LISTENERS
// ============================================
elements.startBtn.addEventListener('click', startRecording);
elements.pauseBtn.addEventListener('click', pauseRecording);
elements.resumeBtn.addEventListener('click', resumeRecording);
elements.stopBtn.addEventListener('click', stopRecording);
elements.resetBtn.addEventListener('click', resetAll);
elements.downloadBtn.addEventListener('click', downloadRecording);

// ============================================
//  RECORDING FUNCTIONS
// ============================================
async function startRecording() {
    try {
        // Capture screen with system audio
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                width: 1920, 
                height: 1080, 
                frameRate: 30 
            },
            audio: true  // Capture system audio
        });

        // Capture microphone
        const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { 
                echoCancellation: true, 
                noiseSuppression: true 
            }
        });

        // Combine all tracks
        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...screenStream.getAudioTracks(),
            ...audioStream.getAudioTracks()
        ]);

        state.mediaStream = combinedStream;
        state.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.recordedChunks.push(event.data);
            }
        };

        state.mediaRecorder.onstop = () => {
            createPreview();
            elements.downloadBtn.disabled = false;
            elements.resetBtn.disabled = false;
        };

        state.mediaRecorder.start(1000);
        state.isRecording = true;
        state.isPaused = false;
        state.elapsedTime = 0;
        state.startTime = Date.now();

        updateUI('recording');
        startTimer();
        updateStatus('Recording', 'recording');

        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
            stopRecording();
        };

    } catch (error) {
        console.error('Recording error:', error);
        alert('Please allow screen, microphone, and system audio access.');
    }
}

function pauseRecording() {
    if (state.mediaRecorder && state.isRecording && !state.isPaused) {
        state.mediaRecorder.pause();
        state.isPaused = true;
        
        state.elapsedTime += (Date.now() - state.startTime);
        
        updateUI('paused');
        updateStatus('Paused', 'paused');
        clearInterval(state.timerInterval);
    }
}

function resumeRecording() {
    if (state.mediaRecorder && state.isPaused) {
        state.mediaRecorder.resume();
        state.isPaused = false;
        state.startTime = Date.now();
        
        updateUI('recording');
        updateStatus('Recording', 'recording');
        startTimer();
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
        state.isPaused = false;
        
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
        }

        updateUI('stopped');
        updateStatus('Ready', '');
        clearInterval(state.timerInterval);
        state.elapsedTime = 0;
    }
}

// ============================================
//  RESET FUNCTION - COMPLETE CLEANUP
// ============================================
function resetAll() {
    // 1. Stop recording if active
    if (state.isRecording) {
        if (state.mediaRecorder) {
            state.mediaRecorder.stop();
        }
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
        }
        state.isRecording = false;
        state.isPaused = false;
    }

    // 2. Clear all recorded data
    state.recordedChunks = [];
    state.elapsedTime = 0;

    // 3. Clear timer
    clearInterval(state.timerInterval);
    state.timerInterval = null;

    // 4. Clear preview video
    if (elements.preview.src) {
        URL.revokeObjectURL(elements.preview.src);
        elements.preview.src = '';
        elements.preview.removeAttribute('src');
        elements.preview.load(); // Reset video element
    }

    // 5. Reset UI
    elements.timer.textContent = '00:00';
    elements.downloadBtn.disabled = true;
    elements.resetBtn.disabled = true;
    
    // 6. Reset buttons to initial state
    updateUI('idle');
    updateStatus('Ready', '');

    // 7. Reset state properties
    state.mediaStream = null;
    state.mediaRecorder = null;
    state.startTime = null;
    state.pausedAt = null;

    console.log('🔄 App reset successfully');
}

// ============================================
//  PREVIEW & DOWNLOAD
// ============================================
function createPreview() {
    const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    elements.preview.src = url;
    elements.preview.controls = true;
}

function downloadRecording() {
    if (state.recordedChunks.length === 0) return;

    const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================
//  UI HELPERS
// ============================================
function updateUI(stateType) {
    const states = {
        recording: { start: true, pause: false, resume: true, stop: false, reset: true },
        paused: { start: true, pause: true, resume: false, stop: false, reset: true },
        stopped: { start: false, pause: true, resume: true, stop: true, reset: false },
        idle: { start: false, pause: true, resume: true, stop: true, reset: true }
    };

    const s = states[stateType] || { start: false, pause: true, resume: true, stop: true, reset: true };
    
    elements.startBtn.disabled = s.start;
    elements.pauseBtn.disabled = s.pause;
    elements.resumeBtn.disabled = s.resume;
    elements.stopBtn.disabled = s.stop;
    elements.resetBtn.disabled = s.reset;
}

function updateStatus(text, dotState) {
    elements.statusText.textContent = text;
    elements.dot.className = 'dot';
    if (dotState) elements.dot.classList.add(dotState);
}

function startTimer() {
    clearInterval(state.timerInterval);
    
    state.timerInterval = setInterval(() => {
        const currentSessionTime = Date.now() - state.startTime;
        const totalElapsed = state.elapsedTime + currentSessionTime;
        
        const seconds = Math.floor(totalElapsed / 1000);
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        elements.timer.textContent = `${mins}:${secs}`;
    }, 100);
}

// ============================================
//  KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    // Start/Stop: Ctrl+Shift+R or Cmd+Shift+R
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        state.isRecording ? stopRecording() : startRecording();
    }
    
    // Pause/Resume: Space
    if (e.key === ' ' && state.isRecording) {
        e.preventDefault();
        state.isPaused ? resumeRecording() : pauseRecording();
    }

    // Reset: Ctrl+Shift+X or Cmd+Shift+X
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        e.preventDefault();
        if (!elements.resetBtn.disabled) {
            resetAll();
        }
    }
});

console.log('Screen Recorder loaded. ⌘⇧R to start/stop, Space to pause/resume, ⌘⇧X to reset.');