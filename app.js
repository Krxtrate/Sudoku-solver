// Sudoku OCR Solver - Production-Grade Client-Side Engine

// App State
let currentBoard = Array(9).fill(null).map(() => Array(9).fill('.'));
let activeCell = null; // {r, c} currently selected

// DOM Elements
const gridContainer = document.getElementById('sudoku-grid');
const systemStatus = document.getElementById('system-status');
const btnSolve = document.getElementById('btn-solve');
const btnClear = document.getElementById('btn-clear');
const virtualKeys = document.querySelectorAll('.virtual-keypad .key:not(.key-clear)');
const btnKeypadClear = document.getElementById('keypad-clear');

// Upload Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');

// Crop Modal Elements
const cropModal = document.getElementById('crop-modal');
const sourceImage = document.getElementById('source-image');
const cropWorkspace = document.getElementById('crop-workspace');
const cropBox = document.getElementById('crop-box');
const btnCropCancel = document.getElementById('btn-crop-cancel');
const btnCropConfirm = document.getElementById('btn-crop-confirm');

// Loader Elements
const loaderModal = document.getElementById('loader-modal');
const loaderTitle = document.getElementById('loader-title');
const loaderSubtitle = document.getElementById('loader-subtitle');
const progressBar = document.getElementById('progress-bar');
const loaderSpinner = document.getElementById('loader-spinner');
const btnLoaderClose = document.getElementById('btn-loader-close');

// Crop Drag/Resize State variables
let isDragging = false;
let activeHandle = null;
let startX = 0, startY = 0;
let boxLeft = 0, boxTop = 0, boxWidth = 0, boxHeight = 0;
let workspaceRect = null;

// Initialize the board grid UI
function initBoardGrid() {
    gridContainer.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'cell';
            cellDiv.dataset.row = r;
            cellDiv.dataset.col = c;
            cellDiv.setAttribute('role', 'gridcell');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.pattern = '[1-9]';
            input.maxLength = 1;
            
            cellDiv.appendChild(input);
            gridContainer.appendChild(cellDiv);
            
            // Wire listeners
            input.addEventListener('focus', () => handleCellFocus(r, c));
            input.addEventListener('input', (e) => handleCellInput(r, c, e.target.value));
            input.addEventListener('keydown', (e) => handleKeyDown(r, c, e));
        }
    }
}

// UI Cell Fetch helpers
function getCellElement(r, c) {
    return gridContainer.children[r * 9 + c];
}

function getCellInput(r, c) {
    return getCellElement(r, c).querySelector('input');
}

// Clear selected active highlight group on click off
function clearFocusHighlight() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = getCellElement(r, c);
            cell.classList.remove('highlight-group', 'highlight-active');
        }
    }
}

// Highlighting active columns, rows, and boxes
function handleCellFocus(focusedRow, focusedCol) {
    activeCell = { r: focusedRow, c: focusedCol };
    
    const boxRowStart = Math.floor(focusedRow / 3) * 3;
    const boxColStart = Math.floor(focusedCol / 3) * 3;
    
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = getCellElement(r, c);
            cell.classList.remove('highlight-group', 'highlight-active');
            
            if (r === focusedRow && c === focusedCol) {
                cell.classList.add('highlight-active');
            } else if (
                r === focusedRow || 
                c === focusedCol || 
                (r >= boxRowStart && r < boxRowStart + 3 && c >= boxColStart && c < boxColStart + 3)
            ) {
                cell.classList.add('highlight-group');
            }
        }
    }
}

// Arrow keys cell movement & backspace clearing
function handleKeyDown(r, c, e) {
    let targetRow = r;
    let targetCol = c;
    
    switch (e.key) {
        case 'ArrowUp':
            targetRow = Math.max(0, r - 1);
            break;
        case 'ArrowDown':
            targetRow = Math.min(8, r + 1);
            break;
        case 'ArrowLeft':
            targetCol = Math.max(0, c - 1);
            break;
        case 'ArrowRight':
            targetCol = Math.min(8, c + 1);
            break;
        case 'Backspace':
        case 'Delete':
            handleCellInput(r, c, '');
            e.preventDefault();
            return;
        default:
            if (!/^[1-9]$/.test(e.key)) {
                e.preventDefault();
            }
            return;
    }
    
    getCellInput(targetRow, targetCol).focus();
    e.preventDefault();
}

// Update local board structure
function handleCellInput(r, c, val) {
    const input = getCellInput(r, c);
    val = String(val || '').trim();
    if (val.length > 1) val = val.charAt(0);
    
    if (val === '' || /^[1-9]$/.test(val)) {
        currentBoard[r][c] = val === '' ? '.' : val;
        input.value = val;
        
        // Remove OCR fixed state on custom edit
        getCellElement(r, c).classList.remove('preset-value');
        validateBoard();
    } else {
        input.value = currentBoard[r][c] === '.' ? '' : currentBoard[r][c];
    }
}

// Check for coordinate duplicate conflicts
function validateBoard() {
    let hasConflict = false;
    
    // Clear old errors
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            getCellElement(r, c).classList.remove('invalid-conflict');
        }
    }
    
    // Validate rows
    for (let r = 0; r < 9; r++) {
        const seen = {};
        for (let c = 0; c < 9; c++) {
            const val = currentBoard[r][c];
            if (val !== '.') {
                if (seen[val] !== undefined) {
                    getCellElement(r, seen[val]).classList.add('invalid-conflict');
                    getCellElement(r, c).classList.add('invalid-conflict');
                    hasConflict = true;
                }
                seen[val] = c;
            }
        }
    }
    
    // Validate cols
    for (let c = 0; c < 9; c++) {
        const seen = {};
        for (let r = 0; r < 9; r++) {
            const val = currentBoard[r][c];
            if (val !== '.') {
                if (seen[val] !== undefined) {
                    getCellElement(seen[val], c).classList.add('invalid-conflict');
                    getCellElement(r, c).classList.add('invalid-conflict');
                    hasConflict = true;
                }
                seen[val] = r;
            }
        }
    }
    
    // Validate 3x3 blocks
    for (let box = 0; box < 9; box++) {
        const seen = {};
        const boxRow = Math.floor(box / 3) * 3;
        const boxCol = (box % 3) * 3;
        for (let i = 0; i < 9; i++) {
            const r = boxRow + Math.floor(i / 3);
            const c = boxCol + (i % 3);
            const val = currentBoard[r][c];
            if (val !== '.') {
                if (seen[val] !== undefined) {
                    const [prevR, prevC] = seen[val];
                    getCellElement(prevR, prevC).classList.add('invalid-conflict');
                    getCellElement(r, c).classList.add('invalid-conflict');
                    hasConflict = true;
                }
                seen[val] = [r, c];
            }
        }
    }
    
    if (hasConflict) {
        systemStatus.textContent = "BOARD CONFLICT DETECTED";
        systemStatus.style.borderColor = "rgba(255, 0, 80, 0.4)";
        systemStatus.style.color = "var(--accent-pink)";
        systemStatus.style.background = "rgba(255, 0, 80, 0.08)";
        systemStatus.style.textShadow = "0 0 10px rgba(255, 0, 80, 0.7)";
    } else {
        systemStatus.textContent = "SYSTEM READY";
        systemStatus.style.borderColor = "rgba(0, 242, 254, 0.25)";
        systemStatus.style.color = "var(--accent-cyan)";
        systemStatus.style.background = "rgba(0, 242, 254, 0.08)";
        systemStatus.style.textShadow = "0 0 5px rgba(0, 242, 254, 0.4)";
    }
    
    return !hasConflict;
}

// Reset/Clear everythingī
function clearGrid() {
    currentBoard = Array(9).fill(null).map(() => Array(9).fill('.'));
    activeCell = null;
    
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = getCellElement(r, c);
            const input = getCellInput(r, c);
            
            cell.className = 'cell';
            input.value = '';
            input.disabled = false;
        }
    }
    validateBoard();
}

// -------------------------------------------------------------
// IMAGE FILE HANDLING & DRAG-AND-DROP
// -------------------------------------------------------------
uploadZone.addEventListener('click', () => fileInput.click());
btnBrowse.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processUploadedImage(e.target.files[0]);
    }
});

// Drag over highlights
['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    }, false);
});

uploadZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processUploadedImage(files[0]);
    }
});

// Process image file
function processUploadedImage(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file (PNG, JPG, or WebP)!");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        sourceImage.onload = () => {
            openCropModal();
        };
        sourceImage.onerror = () => {
            alert("Unable to load the selected image. Please try a different file.");
        };
        sourceImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// -------------------------------------------------------------
// DRAGGABLE RESIZABLE CROP OVERLAY
// -------------------------------------------------------------
function openCropModal() {
    cropModal.classList.add('show');
    
    // Fit alignment box to the full visible image area, leaving only a small margin.
    const imgWidth = sourceImage.clientWidth;
    const imgHeight = sourceImage.clientHeight;
    const margin = 8;
    const side = Math.max(0, Math.min(imgWidth, imgHeight) - margin * 2);
    boxWidth = side;
    boxHeight = side;
    boxLeft = Math.max(0, (imgWidth - side) / 2);
    boxTop = Math.max(0, (imgHeight - side) / 2);
    
    updateCropBoxUI();
}

function closeCropModal() {
    cropModal.classList.remove('show');
    fileInput.value = ''; // Reset file input
}

function updateCropBoxUI() {
    cropBox.style.left = `${boxLeft}px`;
    cropBox.style.top = `${boxTop}px`;
    cropBox.style.width = `${boxWidth}px`;
    cropBox.style.height = `${boxHeight}px`;
}

// Mouse/Touch Drag Handlers
cropBox.addEventListener('mousedown', startDrag);
cropBox.addEventListener('touchstart', startDrag, { passive: false });

function startDrag(e) {
    e.preventDefault();
    workspaceRect = sourceImage.getBoundingClientRect();
    
    // Check if clicked a handle or the box body
    const handleElement = e.target.closest('.handle');
    if (handleElement) {
        activeHandle = handleElement.dataset.handle;
    } else {
        isDragging = true;
    }
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    startX = clientX;
    startY = clientY;
    
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function dragMove(e) {
    if (!isDragging && !activeHandle) return;
    e.preventDefault();
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    
    const imgWidth = sourceImage.clientWidth;
    const imgHeight = sourceImage.clientHeight;
    const minSize = 60; // minimum grid width size
    
    if (isDragging) {
        // Translate entire crop box
        let nextLeft = boxLeft + deltaX;
        let nextTop = boxTop + deltaY;
        
        // Bounds constraint
        nextLeft = Math.max(0, Math.min(imgWidth - boxWidth, nextLeft));
        nextTop = Math.max(0, Math.min(imgHeight - boxHeight, nextTop));
        
        boxLeft = nextLeft;
        boxTop = nextTop;
    } else if (activeHandle) {
        // Resize box via drag handles
        let nextLeft = boxLeft;
        let nextTop = boxTop;
        let nextWidth = boxWidth;
        let nextHeight = boxHeight;
        
        switch (activeHandle) {
            case 'nw':
                nextLeft = Math.max(0, Math.min(boxLeft + boxWidth - minSize, boxLeft + deltaX));
                nextTop = Math.max(0, Math.min(boxTop + boxHeight - minSize, boxTop + deltaY));
                nextWidth = boxWidth + (boxLeft - nextLeft);
                nextHeight = boxHeight + (boxTop - nextTop);
                break;
            case 'ne':
                nextTop = Math.max(0, Math.min(boxTop + boxHeight - minSize, boxTop + deltaY));
                nextWidth = Math.max(minSize, Math.min(imgWidth - boxLeft, boxWidth + deltaX));
                nextHeight = boxHeight + (boxTop - nextTop);
                break;
            case 'sw':
                nextLeft = Math.max(0, Math.min(boxLeft + boxWidth - minSize, boxLeft + deltaX));
                nextWidth = boxWidth + (boxLeft - nextLeft);
                nextHeight = Math.max(minSize, Math.min(imgHeight - boxTop, boxHeight + deltaY));
                break;
            case 'se':
                nextWidth = Math.max(minSize, Math.min(imgWidth - boxLeft, boxWidth + deltaX));
                nextHeight = Math.max(minSize, Math.min(imgHeight - boxTop, boxHeight + deltaY));
                break;
        }
        
        boxLeft = nextLeft;
        boxTop = nextTop;
        boxWidth = nextWidth;
        boxHeight = nextHeight;
    }
    
    startX = clientX;
    startY = clientY;
    
    updateCropBoxUI();
}

function endDrag() {
    isDragging = false;
    activeHandle = null;
    
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('touchend', endDrag);
}

btnCropCancel.addEventListener('click', closeCropModal);

// -------------------------------------------------------------
// PURE-JS DIGIT CLASSIFIER  (zero external dependencies)
// Builds multi-font zone-density prototypes at startup,
// then classifies each cell via nearest-neighbour matching.
// -------------------------------------------------------------
const DigitClassifier = (function () {
    const NORM = 24;       // normalised canvas size (px)
    const ZR = 5, ZC = 4; // 5-row × 4-col zone grid → 20 features

    // Crop to bounding box of dark pixels, scale to NORM×NORM, re-binarize
    function normalize(src) {
        const W = src.width, H = src.height;
        const d = src.getContext('2d').getImageData(0, 0, W, H).data;
        let x0 = W, x1 = -1, y0 = H, y1 = -1;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (d[(y * W + x) * 4] < 128) {
                    if (x < x0) x0 = x; if (x > x1) x1 = x;
                    if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
            }
        }
        const out = document.createElement('canvas');
        out.width = NORM; out.height = NORM;
        const oCtx = out.getContext('2d');
        oCtx.fillStyle = '#ffffff';
        oCtx.fillRect(0, 0, NORM, NORM);
        if (x1 >= x0 && y1 >= y0) {
            const pad = 2;
            oCtx.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1,
                pad, pad, NORM - 2 * pad, NORM - 2 * pad);
        }
        // Re-binarize to remove anti-aliasing from canvas scaling
        const oImg = oCtx.getImageData(0, 0, NORM, NORM);
        const od = oImg.data;
        for (let i = 0; i < od.length; i += 4) {
            const v = od[i] < 128 ? 0 : 255;
            od[i] = od[i + 1] = od[i + 2] = v; od[i + 3] = 255;
        }
        oCtx.putImageData(oImg, 0, 0);
        return out;
    }

    // Compute zone-density feature vector (ZR×ZC = 20 values, each 0-1)
    function featureVec(c) {
        const d = c.getContext('2d').getImageData(0, 0, NORM, NORM).data;
        const fv = [];
        for (let zr = 0; zr < ZR; zr++) {
            for (let zc = 0; zc < ZC; zc++) {
                const r0 = Math.round(zr * NORM / ZR);
                const r1 = Math.round((zr + 1) * NORM / ZR);
                const c0 = Math.round(zc * NORM / ZC);
                const c1 = Math.round((zc + 1) * NORM / ZC);
                let dark = 0, tot = 0;
                for (let r = r0; r < r1; r++) {
                    for (let cc = c0; cc < c1; cc++) {
                        if (d[(r * NORM + cc) * 4] < 128) dark++;
                        tot++;
                    }
                }
                fv.push(tot ? dark / tot : 0);
            }
        }
        return fv;
    }

    // Render a digit in several fonts and return the averaged feature vector
    function buildProto(digit) {
        const SIZE = NORM * 3;
        const fonts = [
            `bold ${NORM * 2.2}px Arial`,
            `bold ${NORM * 2.2}px Helvetica`,
            `bold ${NORM * 2.2}px "Times New Roman"`,
            `bold ${NORM * 2.2}px Verdana`,
            `bold ${NORM * 2.2}px "Courier New"`,
            `bold ${NORM * 2.2}px Georgia`,
            `${NORM * 2.2}px Arial`,
            `${NORM * 2.2}px "Times New Roman"`,
        ];
        const all = fonts.map(font => {
            const c = document.createElement('canvas');
            c.width = c.height = SIZE;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.fillStyle = '#000000';
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(digit), SIZE / 2, SIZE / 2);
            return featureVec(normalize(c));
        });
        // Average all per-font feature vectors into one prototype
        return all[0].map((_, i) => all.reduce((s, f) => s + f[i], 0) / all.length);
    }

    // Pre-build prototypes for digits 1-9 at module init
    const PROTOS = {};
    for (let d = 1; d <= 9; d++) PROTOS[d] = buildProto(d);

    // Classify a cell canvas → '1'-'9' or null if empty/unrecognisable
    function classify(cellCanvas) {
        const norm = normalize(cellCanvas);
        const fv = featureVec(norm);
        // Reject clearly empty cells
        const avgInk = fv.reduce((s, v) => s + v, 0) / fv.length;
        if (avgInk < 0.03) return null;
        let best = null, bestDist = Infinity;
        for (let d = 1; d <= 9; d++) {
            let dist = 0;
            const ref = PROTOS[d];
            for (let i = 0; i < fv.length; i++) dist += (fv[i] - ref[i]) ** 2;
            if (dist < bestDist) { bestDist = dist; best = d; }
        }
        return best !== null ? String(best) : null;
    }

    return { classify };
})();

// -------------------------------------------------------------
// GRID SCAN ENGINE  (uses DigitClassifier, no Tesseract)
// -------------------------------------------------------------
btnCropConfirm.addEventListener('click', async () => {
    // Show loading overlay immediately, but keep the crop modal visible until we capture the image.
    loaderModal.classList.add('show');
    loaderTitle.textContent = "SCANNING GRID";
    loaderSubtitle.textContent = "Preparing image...";
    progressBar.style.width = "0%";
    loaderSpinner.style.display = 'block';
    btnLoaderClose.style.display = 'none';
    progressBar.style.background = "linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))";

    // Yield so the browser can repaint before heavy canvas work
    await new Promise(r => setTimeout(r, 80));

    try {
        // ── 1. Draw cropped region onto 450×450 canvas ──────────────
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 450; cropCanvas.height = 450;
        const ctx = cropCanvas.getContext('2d');

        const scaleX = sourceImage.naturalWidth / sourceImage.clientWidth;
        const scaleY = sourceImage.naturalHeight / sourceImage.clientHeight;
        ctx.drawImage(sourceImage,
            boxLeft * scaleX, boxTop * scaleY,
            boxWidth * scaleX, boxHeight * scaleY,
            0, 0, 450, 450);

        closeCropModal();

        // ── 2. Convert the crop to grayscale so each cell can be binarized adaptively.
        const imgData = ctx.getImageData(0, 0, 450, 450);
        const px = imgData.data;
        for (let i = 0; i < px.length; i += 4) {
            const r = px[i];
            const g = px[i + 1];
            const b = px[i + 2];

            const gray =
                0.2126 * r +
                0.7152 * g +
                0.0722 * b;
            px[i] = px[i + 1] = px[i + 2] = gray;
            px[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);

        clearGrid();
        loaderTitle.textContent = "DECODING DIGITS";
        let found = 0;

        // ── 3. Process each of the 81 cells ─────────────────────────
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const CS = 50; // cell size in the 450px canvas

                // Extract cell
                const cellCanvas = document.createElement('canvas');
                cellCanvas.width = CS; cellCanvas.height = CS;
                const cCtx = cellCanvas.getContext('2d');
                cCtx.drawImage(cropCanvas, c * CS, r * CS, CS, CS, 0, 0, CS, CS);

                const cellData = cCtx.getImageData(0, 0, CS, CS);
                let sum = 0;
                for (let i = 0; i < cellData.data.length; i += 4) {
                    sum += cellData.data[i];
                }
                const mean = sum / (CS * CS);

                const binCanvas = document.createElement('canvas');
                binCanvas.width = CS;
                binCanvas.height = CS;

                const bCtx = binCanvas.getContext('2d');
                const binData = bCtx.createImageData(CS, CS);

                let darkCount = 0;

                for (let y = 0; y < CS; y++) {
                    for (let x = 0; x < CS; x++) {

                        const idx = (y * CS + x) * 4;

                        const lum = cellData.data[idx];

                        const localThreshold = mean * 0.9;

                        let v = lum < localThreshold ? 0 : 255;

                        // ignore borders/gridlines
                        if (
                            x < 5 || x > CS - 6 ||
                            y < 5 || y > CS - 6
                        ) {
                            v = 255;
                        }

                        if (v === 0) darkCount++;

                        binData.data[idx] =
                        binData.data[idx + 1] =
                        binData.data[idx + 2] = v;

                        binData.data[idx + 3] = 255;
                    }
                }
                const darkRatio = darkCount / (CS * CS);
                if (darkRatio > 0.5) {
                    for (let i = 0; i < binData.data.length; i += 4) {
                        const inv = 255 - binData.data[i];
                        binData.data[i] = binData.data[i + 1] = binData.data[i + 2] = inv;
                        binData.data[i + 3] = 255;
                    }
                }
                bCtx.putImageData(binData, 0, 0);

                // Always classify each cell after removing the grid border.
                const scaled = document.createElement('canvas');
                scaled.width = 80; scaled.height = 80;
                const sCtx = scaled.getContext('2d');
                sCtx.fillStyle = '#ffffff';
                sCtx.fillRect(0, 0, 80, 80);
                sCtx.drawImage(binCanvas, 10, 10, 30, 30, 0, 0, 80, 80);
                const img = sCtx.getImageData(0, 0, 80, 80);
                const d = img.data;

                for (let i = 0; i < d.length; i += 4) {
                    const v = d[i];

                    const sharp = v < 180 ? 0 : 255;

                    d[i] =
                    d[i + 1] =
                    d[i + 2] = sharp;
                }

                sCtx.putImageData(img, 0, 0);

                const digit = DigitClassifier.classify(scaled);
                if (digit) {
                    currentBoard[r][c] = digit;
                    const cellEl = getCellElement(r, c);
                    const inp = getCellInput(r, c);
                    inp.value = digit;
                    cellEl.classList.add('preset-value');
                    inp.disabled = true;
                    found++;
                }

                // Update progress bar
                const pct = Math.round(((r * 9 + c + 1) / 81) * 100);
                progressBar.style.width = `${pct}%`;
                loaderSubtitle.textContent = `Scanned ${r * 9 + c + 1}/81 cells — ${found} digits found`;
            }
            // Yield once per row to keep UI responsive
            await new Promise(res => setTimeout(res, 0));
        }

        validateBoard();
        loaderModal.classList.remove('show');

        if (found === 0) {
            systemStatus.textContent = "NO DIGITS DETECTED";
            systemStatus.style.color = "var(--accent-pink)";
            systemStatus.style.borderColor = "rgba(255,0,80,0.4)";
            systemStatus.style.background = "rgba(255,0,80,0.08)";
            systemStatus.style.textShadow = "0 0 10px rgba(255,0,80,0.7)";
        } else {
            systemStatus.textContent = `${found} DIGITS EXTRACTED`;
            systemStatus.style.color = "var(--accent-cyan)";
            systemStatus.style.borderColor = "rgba(0,242,254,0.25)";
            systemStatus.style.background = "rgba(0,242,254,0.08)";
            systemStatus.style.textShadow = "0 0 5px rgba(0,242,254,0.4)";
        }

    } catch (err) {
        console.error("Grid scan error:", err);
        loaderTitle.textContent = "SCAN FAILED";
        loaderSubtitle.textContent = err.message || "Unexpected error during grid scanning.";
        loaderSubtitle.style.color = "var(--accent-pink)";
        progressBar.style.width = "100%";
        progressBar.style.background = "var(--accent-pink)";
        loaderSpinner.style.display = 'none';
        btnLoaderClose.style.display = 'block';
    }
});

// -------------------------------------------------------------
// CORE HIGH-PERFORMANCE SUDOKU BACKTRACKING SOLVER ENGINE
// -------------------------------------------------------------
function isValid(board, r, c, val) {
    // Row duplicate
    for (let col = 0; col < 9; col++) {
        if (col !== c && board[r][col] === val) return false;
    }
    // Col duplicate
    for (let row = 0; row < 9; row++) {
        if (row !== r && board[row][c] === val) return false;
    }
    // 3x3 Box duplicate
    const boxRowStart = Math.floor(r / 3) * 3;
    const boxColStart = Math.floor(c / 3) * 3;
    for (let row = boxRowStart; row < boxRowStart + 3; row++) {
        for (let col = boxColStart; col < boxColStart + 3; col++) {
            if ((row !== r || col !== c) && board[row][col] === val) return false;
        }
    }
    return true;
}

// Blazing fast sync backtracking solver
function solveSudokuInstant(board) {
    const emptyCells = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === '.') {
                emptyCells.push({ r, c });
            }
        }
    }
    
    function solve(index) {
        if (index === emptyCells.length) return true;
        
        const { r, c } = emptyCells[index];
        for (let num = 1; num <= 9; num++) {
            const numStr = num.toString();
            if (isValid(board, r, c, numStr)) {
                board[r][c] = numStr;
                if (solve(index + 1)) return true;
                board[r][c] = '.';
            }
        }
        return false;
    }
    
    return solve(0);
}

// Trigger instant solve
btnSolve.addEventListener('click', () => {
    if (!validateBoard()) {
        alert("The grid currently contains conflict numbers. Please resolve errors before solving!");
        return;
    }
    
    // Copy current state
    const solveCopy = Array(9).fill(null).map((_, r) => [...currentBoard[r]]);
    
    const solved = solveSudokuInstant(solveCopy);
    
    if (solved) {
        currentBoard = solveCopy;
        
        // Update Grid UI
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = getCellElement(r, c);
                const input = getCellInput(r, c);
                
                input.value = currentBoard[r][c];
                
                if (!cell.classList.contains('preset-value')) {
                    cell.classList.add('solved-final');
                }
            }
        }
        
        systemStatus.textContent = "BOARD SOLVED";
        systemStatus.style.color = "var(--accent-green)";
        systemStatus.style.borderColor = "rgba(0, 255, 135, 0.4)";
        systemStatus.style.textShadow = "0 0 10px rgba(0, 255, 135, 0.8)";
        systemStatus.style.background = "rgba(0, 255, 135, 0.1)";
    } else {
        alert("No valid solution exists for this Sudoku board!");
    }
});

btnClear.addEventListener('click', clearGrid);

// Virtual mobile keys input bindings
virtualKeys.forEach(key => {
    key.addEventListener('click', () => {
        if (!activeCell) return;
        const val = key.dataset.val;
        handleCellInput(activeCell.r, activeCell.c, val);
        getCellInput(activeCell.r, activeCell.c).focus();
    });
});

btnKeypadClear.addEventListener('click', () => {
    if (!activeCell) return;
    handleCellInput(activeCell.r, activeCell.c, '');
    getCellInput(activeCell.r, activeCell.c).focus();
});

// Click outside cleanup active cell focus indicators
document.addEventListener('click', (e) => {
    if (!gridContainer.contains(e.target) && !e.target.closest('.virtual-keypad') && !e.target.closest('#upload-zone')) {
        activeCell = null;
        clearFocusHighlight();
    }
});

btnLoaderClose.addEventListener('click', () => {
    loaderModal.classList.remove('show');
    btnLoaderClose.style.display = 'none';
    loaderSpinner.style.display = 'block';
});

// Start application
window.addEventListener('DOMContentLoaded', () => {
    initBoardGrid();
    clearGrid();
});
