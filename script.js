/**
 * Video Watermark Remover Pro
 * Complete JavaScript Implementation
 * Using FFmpeg WASM for video processing
 */

// ========================================
// Global Variables
// ========================================

let ffmpeg = null;
let ffmpegLoaded = false;

// Video elements
let videoPreview = null;
let overlayCanvas = null;
let canvasCtx = null;
let videoWrapper = null;

// Selection boxes
let selectionBoxes = [];
let activeBox = null;
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragOffset = { x: 0, y: 0 };

// App state
let currentVideo = null;
let currentVideoFile = null;
let processedVideos = [];
let batchQueue = [];
let isProcessing = false;

// Settings
let currentMode = 'single';
let currentMethod = 'fast';
let exportQuality = '720';
let autoDetectEnabled = false;

// ========================================
// Initialize Application
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    initializeTheme();
    loadFFmpeg();
});

function initializeElements() {
    videoPreview = document.getElementById('videoPreview');
    overlayCanvas = document.getElementById('overlayCanvas');
    canvasCtx = overlayCanvas.getContext('2d');
    videoWrapper = document.getElementById('videoWrapper');
}

function initializeEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Upload
    document.getElementById('selectVideoBtn').addEventListener('click', () => {
        document.getElementById('videoInput').click();
    });
    document.getElementById('videoInput').addEventListener('change', handleVideoSelect);

    // Drag and drop
    const dragDropArea = document.getElementById('dragDropArea');
    dragDropArea.addEventListener('dragover', handleDragOver);
    dragDropArea.addEventListener('dragleave', handleDragLeave);
    dragDropArea.addEventListener('drop', handleDrop);

    // Change video
    document.getElementById('changeVideoBtn').addEventListener('click', () => {
        document.getElementById('uploadSection').style.display = 'flex';
        document.getElementById('editorSection').style.display = 'none';
        resetEditor();
    });

    // Selection mode
    document.getElementById('singleModeBtn').addEventListener('click', () => setSelectionMode('single'));
    document.getElementById('multiModeBtn').addEventListener('click', () => setSelectionMode('multi'));

    // Removal method
    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', () => setRemovalMethod(card.dataset.method));
    });

    // Quality select
    document.getElementById('qualitySelect').addEventListener('change', (e) => {
        exportQuality = e.target.value;
    });

    // Auto detect
    document.getElementById('autoDetectCheck').addEventListener('change', (e) => {
        autoDetectEnabled = e.target.checked;
    });

    // Action buttons
    document.getElementById('processBtn').addEventListener('click', processVideo);
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelections);
    document.getElementById('downloadBtn').addEventListener('click', downloadVideo);
    document.getElementById('processAnotherBtn').addEventListener('click', processAnotherVideo);
    document.getElementById('addToBatchBtn').addEventListener('click', addToBatch);
    document.getElementById('downloadAllBtn').addEventListener('click', downloadAllBatch);

    // Canvas interactions
    overlayCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    overlayCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    overlayCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    overlayCanvas.addEventListener('mouseleave', handleCanvasMouseUp);

    // Touch support
    overlayCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    overlayCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    overlayCanvas.addEventListener('touchend', handleTouchEnd);
}

// ========================================
// Theme Management
// ========================================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ========================================
// FFmpeg Initialization
// ========================================

async function loadFFmpeg() {
    try {
        const { FFmpeg } = window.FFmpeg;
        ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }) => {
            console.log('FFmpeg:', message);
        });

        ffmpeg.on('progress', ({ progress }) => {
            updateProgress(Math.round(progress * 100));
        });

        showToast('🔄 Loading FFmpeg...', 'info');
        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js'
        });

        ffmpegLoaded = true;
        showToast('✅ FFmpeg loaded successfully!', 'success');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        showToast('❌ Failed to load FFmpeg. Please refresh the page.', 'error');
    }
}

// ========================================
// Video Upload Handling
// ========================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
        loadVideo(files[0]);
    } else {
        showToast('❌ Please drop a valid video file', 'error');
    }
}

function handleVideoSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadVideo(file);
    }
}

function loadVideo(file) {
    if (!file.type.startsWith('video/')) {
        showToast('❌ Please select a valid video file', 'error');
        return;
    }

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
        showToast('❌ Unsupported format. Use MP4, MOV, or WEBM', 'error');
        return;
    }

    currentVideoFile = file;
    const url = URL.createObjectURL(file);

    videoPreview.src = url;
    videoPreview.onloadedmetadata = () => {
        document.getElementById('videoName').textContent = file.name;
        document.getElementById('videoDuration').textContent = formatTime(videoPreview.duration);

        // Setup canvas
        setupCanvas();

        // Switch to editor section
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('editorSection').style.display = 'block';

        showToast('✅ Video loaded successfully!', 'success');

        // Auto detect if enabled
        if (autoDetectEnabled) {
            detectWatermark();
        }
    };
}

function setupCanvas() {
    const rect = videoWrapper.getBoundingClientRect();
    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;

    // Reset selections
    selectionBoxes = [];
    drawCanvas();

    // Handle resize
    window.addEventListener('resize', () => {
        const newRect = videoWrapper.getBoundingClientRect();
        overlayCanvas.width = newRect.width;
        overlayCanvas.height = newRect.height;
        drawCanvas();
    });
}

function resetEditor() {
    videoPreview.src = '';
    videoPreview.load();
    selectionBoxes = [];
    currentVideo = null;
    currentVideoFile = null;
    clearCanvas();
}

// ========================================
// Canvas Drawing & Selection
// ========================================

function drawCanvas() {
    clearCanvas();

    selectionBoxes.forEach((box, index) => {
        const { x, y, width, height } = box;

        // Draw selection box
        canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        canvasCtx.fillRect(x, y, width, height);

        canvasCtx.strokeStyle = index === selectionBoxes.length - 1 || activeBox === box
            ? 'rgba(255, 255, 0, 1)'
            : 'rgba(255, 0, 0, 0.8)';
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeRect(x, y, width, height);

        // Draw resize handles on active box
        if (activeBox === box || index === selectionBoxes.length - 1) {
            drawResizeHandles(x, y, width, height);
        }

        // Draw label
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        canvasCtx.font = '12px Poppins';
        canvasCtx.fillText(`Area ${index + 1}`, x + 5, y + 15);
    });
}

function drawResizeHandles(x, y, width, height) {
    const handles = [
        { x: x, y: y, type: 'nw' },
        { x: x + width, y: y, type: 'ne' },
        { x: x, y: y + height, type: 'sw' },
        { x: x + width, y: y + height, type: 'se' }
    ];

    handles.forEach(handle => {
        canvasCtx.beginPath();
        canvasCtx.arc(handle.x, handle.y, 8, 0, Math.PI * 2);
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        canvasCtx.fill();
        canvasCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
    });
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ========================================
// Mouse/Touch Interactions
// ========================================

function getCanvasCoordinates(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;

    if (e.touches) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getResizeHandle(x, y, box) {
    const handleSize = 15;
    const handles = [
        { x: box.x, y: box.y, type: 'nw' },
        { x: box.x + box.width, y: box.y, type: 'ne' },
        { x: box.x, y: box.y + box.height, type: 'sw' },
        { x: box.x + box.width, y: box.y + box.height, type: 'se' }
    ];

    for (const handle of handles) {
        const dx = x - handle.x;
        const dy = y - handle.y;
        if (Math.sqrt(dx * dx + dy * dy) <= handleSize) {
            return handle.type;
        }
    }
    return null;
}

function handleCanvasMouseDown(e) {
    if (!videoPreview.videoWidth) return;

    const coords = getCanvasCoordinates(e);
    const clickedBox = findBoxAtPoint(coords.x, coords.y);

    if (clickedBox) {
        activeBox = clickedBox;
        const handle = getResizeHandle(coords.x, coords.y, clickedBox);

        if (handle) {
            isResizing = true;
            resizeHandle = handle;
        } else {
            isDragging = true;
            dragOffset = {
                x: coords.x - clickedBox.x,
                y: coords.y - clickedBox.y
            };
        }
    } else {
        // Create new box
        if (currentMode === 'single') {
            selectionBoxes = [];
        }

        activeBox = {
            x: coords.x,
            y: coords.y,
            width: 0,
            height: 0,
            startX: coords.x,
            startY: coords.y
        };
        selectionBoxes.push(activeBox);
        isResizing = true;
        resizeHandle = 'se';
    }

    drawCanvas();
}

function handleCanvasMouseMove(e) {
    if (!activeBox) return;

    const coords = getCanvasCoordinates(e);

    if (isDragging) {
        activeBox.x = coords.x - dragOffset.x;
        activeBox.y = coords.y - dragOffset.y;

        // Boundary checks
        activeBox.x = Math.max(0, Math.min(activeBox.x, overlayCanvas.width - activeBox.width));
        activeBox.y = Math.max(0, Math.min(activeBox.y, overlayCanvas.height - activeBox.height));
    } else if (isResizing) {
        switch (resizeHandle) {
            case 'se':
                activeBox.width = Math.max(30, coords.x - activeBox.x);
                activeBox.height = Math.max(30, coords.y - activeBox.y);
                break;
            case 'sw':
                const newWidthSW = activeBox.x + activeBox.width - coords.x;
                if (newWidthSW > 30) {
                    activeBox.x = coords.x;
                    activeBox.width = newWidthSW;
                }
                activeBox.height = Math.max(30, coords.y - activeBox.y);
                break;
            case 'ne':
                activeBox.width = Math.max(30, coords.x - activeBox.x);
                const newHeightNE = activeBox.y + activeBox.height - coords.y;
                if (newHeightNE > 30) {
                    activeBox.y = coords.y;
                    activeBox.height = newHeightNE;
                }
                break;
            case 'nw':
                const newWidthNW = activeBox.x + activeBox.width - coords.x;
                const newHeightNW = activeBox.y + activeBox.height - coords.y;
                if (newWidthNW > 30) {
                    activeBox.x = coords.x;
                    activeBox.width = newWidthNW;
                }
                if (newHeightNW > 30) {
                    activeBox.y = coords.y;
                    activeBox.height = newHeightNW;
                }
                break;
        }
    }

    drawCanvas();
}

function handleCanvasMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;

    // Remove tiny boxes
    if (activeBox && activeBox.width < 30 && activeBox.height < 30) {
        selectionBoxes = selectionBoxes.filter(b => b !== activeBox);
    }

    activeBox = null;
    drawCanvas();
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    handleCanvasMouseDown(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    handleCanvasMouseMove(mouseEvent);
}

function handleTouchEnd(e) {
    e.preventDefault();
    handleCanvasMouseUp();
}

function findBoxAtPoint(x, y) {
    for (let i = selectionBoxes.length - 1; i >= 0; i--) {
        const box = selectionBoxes[i];
        if (x >= box.x && x <= box.x + box.width &&
            y >= box.y && y <= box.y + box.height) {
            return box;
        }
    }
    return null;
}

// ========================================
// Selection Mode & Method
// ========================================

function setSelectionMode(mode) {
    currentMode = mode;

    document.getElementById('singleModeBtn').classList.toggle('active', mode === 'single');
    document.getElementById('multiModeBtn').classList.toggle('active', mode === 'multi');

    if (mode === 'single' && selectionBoxes.length > 1) {
        selectionBoxes = [selectionBoxes[selectionBoxes.length - 1]];
        drawCanvas();
    }

    showToast(`📐 Selection mode: ${mode === 'single' ? 'Single Area' : 'Multiple Areas'}`, 'info');
}

function setRemovalMethod(method) {
    currentMethod = method;

    document.querySelectorAll('.method-card').forEach(card => {
        card.classList.toggle('active', card.dataset.method === method);
    });

    const methodNames = {
        'fast': 'Mode Cepat',
        'clean': 'Mode Bersih',
        'ai': 'Mode AI Pro'
    };

    showToast(`⚙️ Removal method: ${methodNames[method]}`, 'info');
}

function clearSelections() {
    selectionBoxes = [];
    activeBox = null;
    drawCanvas();
    showToast('🗑️ Selections cleared', 'info');
}

// ========================================
// Auto Detect Watermark (AI)
// ========================================

async function detectWatermark() {
    if (!videoPreview.videoWidth) return;

    showToast('🔍 Analyzing video for watermarks...', 'info');

    // Create a temporary canvas to analyze video frame
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = videoPreview.videoWidth;
    tempCanvas.height = videoPreview.videoHeight;

    // Draw current frame
    tempCtx.drawImage(videoPreview, 0, 0);

    // Get image data for analysis
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Simple heuristic: look for high-contrast areas in corners (common watermark locations)
    const corners = [
        { x: 0, y: 0, name: 'top-left' },
        { x: tempCanvas.width - 200, y: 0, name: 'top-right' },
        { x: 0, y: tempCanvas.height - 100, name: 'bottom-left' },
        { x: tempCanvas.width - 200, y: tempCanvas.height - 100, name: 'bottom-right' }
    ];

    let detectedCorner = null;
    let maxContrast = 0;

    corners.forEach(corner => {
        const contrast = analyzeContrast(data, tempCanvas.width, corner.x, corner.y, 200, 100);
        if (contrast > maxContrast) {
            maxContrast = contrast;
            detectedCorner = corner;
        }
    });

    if (detectedCorner && maxContrast > 30) {
        // Convert to canvas coordinates
        const scaleX = overlayCanvas.width / tempCanvas.width;
        const scaleY = overlayCanvas.height / tempCanvas.height;

        selectionBoxes = [{
            x: detectedCorner.x * scaleX,
            y: detectedCorner.y * scaleY,
            width: 200 * scaleX,
            height: 100 * scaleY
        }];

        drawCanvas();
        showToast(`✅ Watermark detected at ${detectedCorner.name}!`, 'success');
    } else {
        showToast('⚠️ No watermark detected. Please select manually.', 'warning');
    }
}

function analyzeContrast(data, width, startX, startY, areaWidth, areaHeight) {
    let contrast = 0;
    let pixelCount = 0;

    for (let y = startY; y < startY + areaHeight && y < data.length / (width * 4); y++) {
        for (let x = startX; x < startX + areaWidth && x < width; x++) {
            const idx = (y * width + x) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

            // Check neighbors for contrast
            if (x < width - 1) {
                const nextIdx = (y * width + x + 1) * 4;
                const nextBrightness = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
                contrast += Math.abs(brightness - nextBrightness);
                pixelCount++;
            }
        }
    }

    return pixelCount > 0 ? contrast / pixelCount : 0;
}

// ========================================
// Video Processing
// ========================================

async function processVideo() {
    if (!currentVideoFile || !ffmpegLoaded) {
        showToast('❌ Please load a video first', 'error');
        return;
    }

    if (selectionBoxes.length === 0) {
        showToast('❌ Please select watermark area(s)', 'error');
        return;
    }

    isProcessing = true;
    document.getElementById('editorSection').style.display = 'none';
    document.getElementById('progressSection').style.display = 'block';

    try {
        await processWithFFmpeg();
    } catch (error) {
        console.error('Processing error:', error);
        showToast(`❌ Processing failed: ${error.message}`, 'error');
        resetToEditor();
    }

    isProcessing = false;
}

async function processWithFFmpeg() {
    updateProgress(0);
    updateStatus('Preparing video...');

    const videoData = await currentVideoFile.arrayBuffer();
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    // Write video file to FFmpeg FS
    await ffmpeg.writeFile(inputName, new Uint8Array(videoData));

    // Calculate crop/filter parameters based on selections
    const videoRatio = videoPreview.videoWidth / videoPreview.videoHeight;
    const canvasRatio = overlayCanvas.width / overlayCanvas.height;

    let filters = [];

    selectionBoxes.forEach(box => {
        // Convert canvas coordinates to video coordinates
        const scaleX = videoPreview.videoWidth / overlayCanvas.width;
        const scaleY = videoPreview.videoHeight / overlayCanvas.height;

        const x = Math.round(box.x * scaleX);
        const y = Math.round(box.y * scaleY);
        const w = Math.round(box.width * scaleX);
        const h = Math.round(box.height * scaleY);

        switch (currentMethod) {
            case 'fast':
                // Apply blur to the selected area
                filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}`);
                break;

            case 'clean':
                // Use crop and scale approach
                filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:mode=white`);
                break;

            case 'ai':
                // Advanced inpainting simulation using multiple filters
                filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:b=10`);
                break;
        }
    });

    // Add quality scaling
    let qualityFilter = '';
    switch (exportQuality) {
        case '480':
            qualityFilter = 'scale=-2:480';
            break;
        case '720':
            qualityFilter = 'scale=-2:720';
            break;
        case '1080':
            qualityFilter = 'scale=-2:1080';
            break;
    }

    if (qualityFilter) {
        filters.push(qualityFilter);
    }

    // Build FFmpeg command
    const filterComplex = filters.join(',');

    updateStatus('Processing video...');

    await ffmpeg.exec([
        '-i', inputName,
        '-vf', filterComplex,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
    ]);

    updateStatus('Finalizing...');

    // Read output file
    const outputData = await ffmpeg.readFile(outputName);
    const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

    // Create download URL
    const downloadUrl = URL.createObjectURL(outputBlob);

    // Show result
    showResult(downloadUrl, outputBlob);

    // Cleanup
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
}

function updateProgress(percent) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent + '%';
}

function updateStatus(status) {
    document.getElementById('progressStatus').textContent = status;
}

function showResult(url, blob) {
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('downloadSection').style.display = 'block';

    const resultVideo = document.getElementById('resultVideo');
    resultVideo.src = url;

    // Store for download
    currentVideo = { url, blob };

    // Setup download button
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = url;
    downloadBtn.download = `watermark_removed_${Date.now()}.mp4`;
}

function resetToEditor() {
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('editorSection').style.display = 'block';
}

function processAnotherVideo() {
    document.getElementById('downloadSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'flex';
    resetEditor();
}

// ========================================
// Download Functions
// ========================================

function downloadVideo() {
    if (!currentVideo) {
        showToast('❌ No video to download', 'error');
        return;
    }

    const a = document.createElement('a');
    a.href = currentVideo.url;
    a.download = `watermark_removed_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('✅ Download started!', 'success');
}

// ========================================
// Batch Processing
// ========================================

function addToBatch() {
    if (!currentVideo) {
        showToast('❌ No processed video to add', 'error');
        return;
    }

    batchQueue.push({
        ...currentVideo,
        name: `video_${batchQueue.length + 1}.mp4`
    });

    updateBatchUI();
    showToast('✅ Added to batch!', 'success');
}

function updateBatchUI() {
    document.getElementById('batchCount').textContent = batchQueue.length;
    document.getElementById('downloadAllBtn').disabled = batchQueue.length === 0;
}

async function downloadAllBatch() {
    if (batchQueue.length === 0) {
        showToast('❌ No videos in batch', 'error');
        return;
    }

    showToast('📦 Preparing batch download...', 'info');

    // Create ZIP using JSZip-like approach (simplified - downloads individually)
    for (let i = 0; i < batchQueue.length; i++) {
        const video = batchQueue[i];
        const a = document.createElement('a');
        a.href = video.url;
        a.download = `batch_${i + 1}_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    showToast('✅ Batch download complete!', 'success');
    batchQueue = [];
    updateBatchUI();
}

// ========================================
// Utility Functions
// ========================================

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slide-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// Keyboard Shortcuts
// ========================================

document.addEventListener('keydown', (e) => {
    // Delete selected box
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeBox && document.getElementById('editorSection').style.display !== 'none') {
            selectionBoxes = selectionBoxes.filter(b => b !== activeBox);
            activeBox = null;
            drawCanvas();
        }
    }

    // Escape to clear
    if (e.key === 'Escape') {
        clearSelections();
    }

    // Space to play/pause
    if (e.key === ' ' && videoPreview && videoPreview.src) {
        e.preventDefault();
        if (videoPreview.paused) {
            videoPreview.play();
        } else {
            videoPreview.pause();
        }
    }
});

// ========================================
// Service Worker Registration (for PWA)
// ========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment below to enable PWA functionality
        // navigator.serviceWorker.register('/sw.js');
    });
}

console.log('🎬 Video Watermark Remover Pro initialized!');
