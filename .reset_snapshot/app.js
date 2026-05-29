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

// Loader Elements
const loaderModal = document.getElementById('loader-modal');
const loaderTitle = document.getElementById('loader-title');
const loaderSubtitle = document.getElementById('loader-subtitle');
const progressBar = document.getElementById('progress-bar');
const loaderSpinner = document.getElementById('loader-spinner');
const btnLoaderClose = document.getElementById('btn-loader-close');

// Hidden image element for OpenCV to read from
const sourceImage = new Image();

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

// Clipboard paste support (Ctrl+V anywhere on the page)
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) processUploadedImage(file);
            break;
        }
    }
});


// Process image file
function processUploadedImage(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file (PNG, JPG, or WebP)!");
        return;
    }
    
    if (!window.cvLoaded) {
        alert("Please wait a moment for the Vision Engine to load...");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        sourceImage.onload = () => {
            processGridImage(); // Trigger auto-detection
        };
        sourceImage.onerror = () => {
            alert("Unable to load the selected image. Please try a different file.");
        };
        sourceImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// --- DIAG AND CROP LOGIC REMOVED: Auto-detecting grid with OpenCV ---

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

    function pixelVector(c) {
        const d = c.getContext('2d').getImageData(0, 0, NORM, NORM).data;
        const pixels = new Float32Array(NORM * NORM);
        for (let i = 0; i < NORM * NORM; i++) {
            pixels[i] = d[i * 4] < 128 ? 1 : 0;
        }
        return pixels;
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
            const norm = normalize(c);
            return {
                fv: featureVec(norm),
                pixels: pixelVector(norm),
            };
        });

        const avgFeature = all[0].fv.map((_, i) => all.reduce((s, item) => s + item.fv[i], 0) / all.length);
        return {
            feature: avgFeature,
            templates: all.map(item => item.pixels),
        };
    }

    // Pre-build prototypes for digits 1-9 at module init
    const PROTOS = {};
    for (let d = 1; d <= 9; d++) PROTOS[d] = buildProto(d);

    // Classify a cell canvas with distance scoring.
    function classifyWithScore(cellCanvas) {
        const norm = normalize(cellCanvas);
        const fv = featureVec(norm);
        const pixels = pixelVector(norm);
        const avgInk = fv.reduce((s, v) => s + v, 0) / fv.length;
        let best = null, bestDist = Infinity, secondBestDist = Infinity;
        for (let d = 1; d <= 9; d++) {
            const ref = PROTOS[d];
            let zoneDist = 0;
            for (let i = 0; i < fv.length; i++) zoneDist += (fv[i] - ref.feature[i]) ** 2;
            let pixelDist = Infinity;
            for (const tmpl of ref.templates) {
                let pd = 0;
                for (let i = 0; i < pixels.length; i++) {
                    const diff = pixels[i] - tmpl[i];
                    pd += diff * diff;
                }
                if (pd < pixelDist) pixelDist = pd;
            }
            pixelDist /= (NORM * NORM);
            const dist = 0.65 * pixelDist + 0.35 * zoneDist;
            if (dist < bestDist) {
                secondBestDist = bestDist;
                bestDist = dist;
                best = d;
            } else if (dist < secondBestDist) {
                secondBestDist = dist;
            }
        }

        return {
            digit: best !== null ? String(best) : null,
            distance: bestDist,
            margin: secondBestDist - bestDist,
            avgInk,
        };
    }

    function classify(cellCanvas) {
        const result = classifyWithScore(cellCanvas);
        return result.avgInk < 0.01 ? null : result.digit;
    }

    return { classify, classifyWithScore };
})();

function stripDuplicateDigitConflicts(scores) {
    let removed = 0;

    const removeCell = (r, c) => {
        if (!scores[r][c] && currentBoard[r][c] === '.') return;
        scores[r][c] = null;
        currentBoard[r][c] = '.';
        const inp = getCellInput(r, c);
        inp.value = '';
        inp.disabled = false;
        getCellElement(r, c).classList.remove('preset-value', 'invalid-conflict');
        removed++;
    };

    const scoreValue = (entry) => {
        if (!entry) return Infinity;
        return entry.distance - entry.avgInk * 0.12;
    };

    const resolvePair = (a, b) => {
        if (!a || !b) return null;
        return scoreValue(a.score) > scoreValue(b.score) ? a : b;
    };

    const processDuplicate = (existing, current) => {
        const loser = resolvePair(existing, current);
        if (!loser) return existing || current;
        removeCell(loser.r, loser.c);
        return loser === existing ? current : existing;
    };

    // Rows
    for (let r = 0; r < 9; r++) {
        const seen = {};
        for (let c = 0; c < 9; c++) {
            const val = currentBoard[r][c];
            if (val === '.') continue;
            if (seen[val]) {
                seen[val] = processDuplicate(seen[val], { r, c, score: scores[r][c] });
            } else {
                seen[val] = { r, c, score: scores[r][c] };
            }
        }
    }

    // Columns
    for (let c = 0; c < 9; c++) {
        const seen = {};
        for (let r = 0; r < 9; r++) {
            const val = currentBoard[r][c];
            if (val === '.') continue;
            if (seen[val]) {
                seen[val] = processDuplicate(seen[val], { r, c, score: scores[r][c] });
            } else {
                seen[val] = { r, c, score: scores[r][c] };
            }
        }
    }

    // Boxes
    for (let box = 0; box < 9; box++) {
        const seen = {};
        const boxRow = Math.floor(box / 3) * 3;
        const boxCol = (box % 3) * 3;
        for (let i = 0; i < 9; i++) {
            const r = boxRow + Math.floor(i / 3);
            const c = boxCol + (i % 3);
            const val = currentBoard[r][c];
            if (val === '.') continue;
            if (seen[val]) {
                seen[val] = processDuplicate(seen[val], { r, c, score: scores[r][c] });
            } else {
                seen[val] = { r, c, score: scores[r][c] };
            }
        }
    }

    return removed;
}

// -------------------------------------------------------------
// GRID SCAN ENGINE (Auto-Detect with OpenCV + DigitClassifier)
// -------------------------------------------------------------
async function processGridImage() {
    loaderModal.classList.add('show');
    loaderTitle.textContent = "VISION ENGINE DETECTING GRID";
    loaderSubtitle.textContent = "Scanning image for Sudoku board...";
    progressBar.style.width = "0%";
    loaderSpinner.style.display = 'block';
    btnLoaderClose.style.display = 'none';
    progressBar.style.background = "linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))";
    await new Promise(r => setTimeout(r, 100));

    try {
        // ── STEP 1: Load image and convert to grayscale ──────────
        let src = cv.imread(sourceImage);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

        // ── STEP 2: Threshold to find grid outline using Canny Edge Detection ──
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        
        let edges = new cv.Mat();
        // Canny perfectly isolates the board outline even if the outer background is darker than the board
        cv.Canny(blurred, edges, 50, 150, 3, false);
        blurred.delete();

        // Close gaps in edges so the grid forms a single solid contour
        let kernelEdge = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernelEdge);
        kernelEdge.delete();

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        edges.delete();

        // ── STEP 3: Find the largest contour (the grid) ─────────
        let bestArea = 0, bestIdx = -1;
        let imgArea = src.cols * src.rows;
        
        for (let i = 0; i < contours.size(); i++) {
            let a = cv.contourArea(contours.get(i));
            // Require contour to be < 98% of image to avoid selecting the image boundary itself
            if (a > bestArea && a < imgArea * 0.98) { 
                bestArea = a; 
                bestIdx = i; 
            }
        }
        
        if (bestIdx === -1 || bestArea < 5000) {
            throw new Error("No Sudoku grid found. Please ensure the full board is visible.");
        }

        // ── STEP 4: Get grid corners (quad or bounding rect) ──────
        let bestCnt = contours.get(bestIdx);
        let bbox = cv.boundingRect(bestCnt);
        let bboxArea = bbox.width * bbox.height;
        let isScreenshot = (bestArea / bboxArea) > 0.85;

        let tl, tr, bl, br;
        
        // If it's a screenshot (upright rectangle), bypass skew logic to prevent cell drift
        if (isScreenshot) {
            let p = 2; // slight inset to avoid thick outer border
            tl = { x: bbox.x + p,              y: bbox.y + p };
            tr = { x: bbox.x + bbox.width - p, y: bbox.y + p };
            bl = { x: bbox.x + p,              y: bbox.y + bbox.height - p };
            br = { x: bbox.x + bbox.width - p, y: bbox.y + bbox.height - p };
        } else {
            let perim = cv.arcLength(bestCnt, true);
            let approx = new cv.Mat();
            let foundQuad = false;
            for (let eps of [0.02, 0.03, 0.05, 0.07, 0.10]) {
                approx.delete();
                approx = new cv.Mat();
                cv.approxPolyDP(bestCnt, approx, eps * perim, true);
                if (approx.rows === 4) { foundQuad = true; break; }
            }

            if (foundQuad) {
                let pts = [];
                for (let i = 0; i < 4; i++)
                    pts.push({ x: approx.data32S[i * 2], y: approx.data32S[i * 2 + 1] });
                pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
                tl = pts[0]; br = pts[3];
                let mid = [pts[1], pts[2]].sort((a, b) => (a.x - a.y) - (b.x - b.y));
                bl = mid[0]; tr = mid[1];
            } else {
                let p = 2;
                tl = { x: bbox.x + p,              y: bbox.y + p };
                tr = { x: bbox.x + bbox.width - p, y: bbox.y + p };
                bl = { x: bbox.x + p,              y: bbox.y + bbox.height - p };
                br = { x: bbox.x + bbox.width - p, y: bbox.y + bbox.height - p };
            }
            approx.delete();
        }
        contours.delete();
        hierarchy.delete();

        // ── STEP 5: Perspective-warp grid to 450×450 ──────────────
        const SIDE = 450;
        let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2,
            [tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y]);
        let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2,
            [0, 0, SIDE, 0, 0, SIDE, SIDE, SIDE]);
        let M = cv.getPerspectiveTransform(srcPts, dstPts);
        let warped = new cv.Mat();
        cv.warpPerspective(src, warped, M, new cv.Size(SIDE, SIDE),
            cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        src.delete(); srcPts.delete(); dstPts.delete(); M.delete();

        // ── STEP 6: Global threshold + morphological closing ──────
        let warpGray = new cv.Mat();
        cv.cvtColor(warped, warpGray, cv.COLOR_RGBA2GRAY, 0);
        warped.delete();

        let warpThresh = new cv.Mat();
        cv.adaptiveThreshold(warpGray, warpThresh, 255,
            cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 12);

        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        let closed = new cv.Mat();
        cv.morphologyEx(warpThresh, closed, cv.MORPH_CLOSE, kernel);
        kernel.delete(); warpThresh.delete();

        // ── STEP 7: Extract digits cell by cell ───────────────────
        const CS = Math.floor(SIDE / 9); // 50
        const GUARD = 4; // smaller guard to preserve more digit ink near thick lines
        clearGrid();
        loaderTitle.textContent = "DECODING DIGITS";
        let found = 0;
        const scoredCells = Array(9).fill(null).map(() => Array(9).fill(null));

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                let cx = col * CS + GUARD;
                let cy = row * CS + GUARD;
                let cw = Math.min(CS - 2 * GUARD, SIDE - cx);
                let ch = Math.min(CS - 2 * GUARD, SIDE - cy);
                if (cw <= 0 || ch <= 0) continue;

                let cellGrayROI = warpGray.roi(new cv.Rect(cx, cy, cw, ch));
                let cellGray = new cv.Mat();
                cellGrayROI.copyTo(cellGray);
                cellGrayROI.delete();
                cv.medianBlur(cellGray, cellGray, 3);

                let cellThresh = new cv.Mat();
                cv.adaptiveThreshold(cellGray, cellThresh, 255,
                    cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 8);

                let cellOtsu = new cv.Mat();
                cv.threshold(cellGray, cellOtsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
                cv.bitwise_or(cellThresh, cellOtsu, cellThresh);
                cellOtsu.delete();
                cellGray.delete();

                let kernelCell = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
                let cellMat = new cv.Mat();
                cv.morphologyEx(cellThresh, cellMat, cv.MORPH_CLOSE, kernelCell);
                cv.morphologyEx(cellMat, cellMat, cv.MORPH_OPEN, kernelCell);
                cellThresh.delete();
                kernelCell.delete();

                let inkCount = cv.countNonZero(cellMat);

                if (inkCount / (cw * ch) < 0.0015) {
                    cellMat.delete();
                    progressBar.style.width = `${Math.round(((row * 9 + col + 1) / 81) * 100)}%`;
                    loaderSubtitle.textContent = `Scanned ${row * 9 + col + 1}/81 cells — ${found} digits found`;
                    continue;
                }

                let cc = new cv.MatVector();
                let ch2 = new cv.Mat();
                cv.findContours(cellMat, cc, ch2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                let cellArea = cw * ch;
                let maxA = 0, maxI = -1;
                for (let i = 0; i < cc.size(); i++) {
                    let cnt = cc.get(i);
                    let a = cv.contourArea(cnt);
                    if (a < 10) continue;

                    let bbox = cv.boundingRect(cnt);
                    let areaRatio = a / cellArea;
                    let touchesEdge = bbox.x <= 1 || bbox.y <= 1 || bbox.x + bbox.width >= cw - 1 || bbox.y + bbox.height >= ch - 1;
                    if (touchesEdge && areaRatio < 0.05) continue;

                    if (a > maxA) {
                        maxA = a;
                        maxI = i;
                    }
                }

                let digitCanvas = document.createElement('canvas');
                digitCanvas.width = 28; digitCanvas.height = 28;
                let dCtx = digitCanvas.getContext('2d');
                dCtx.fillStyle = '#fff';
                dCtx.fillRect(0, 0, 28, 28);
                let hasDigit = false;

                if (maxI !== -1 && maxA / cellArea >= 0.015) {
                    let cnt = cc.get(maxI);
                    let bbox = cv.boundingRect(cnt);
                    let aspect = bbox.width / Math.max(bbox.height, 1);
                    let hRatio = bbox.height / ch;
                    let boxRatio = (bbox.width * bbox.height) / cellArea;

                    if (aspect >= 0.08 && aspect <= 2.4 && hRatio >= 0.14 && hRatio <= 0.98 && boxRatio >= 0.009) {
                        hasDigit = true;

                        let roiMat = cellMat.roi(bbox);
                        let roiCopy = new cv.Mat();
                        roiMat.copyTo(roiCopy);
                        roiMat.delete();
                        let tmpC = document.createElement('canvas');
                        tmpC.width = bbox.width; tmpC.height = bbox.height;
                        cv.imshow(tmpC, roiCopy);
                        roiCopy.delete();

                        let scale = Math.min(22 / bbox.width, 22 / bbox.height);
                        let dw = Math.max(1, Math.round(bbox.width * scale));
                        let dh = Math.max(1, Math.round(bbox.height * scale));
                        let ox = Math.round((28 - dw) / 2);
                        let oy = Math.round((28 - dh) / 2);

                        let rawData = tmpC.getContext('2d').getImageData(0, 0, bbox.width, bbox.height);
                        let outData = dCtx.getImageData(0, 0, 28, 28);
                        for (let dy = 0; dy < dh; dy++) {
                            for (let dx = 0; dx < dw; dx++) {
                                let sy = Math.min(Math.round(dy / scale), bbox.height - 1);
                                let sx = Math.min(Math.round(dx / scale), bbox.width - 1);
                                let ink = rawData.data[(sy * bbox.width + sx) * 4] > 128 ? 0 : 255;
                                let pi = ((oy + dy) * 28 + (ox + dx)) * 4;
                                outData.data[pi] = ink;
                                outData.data[pi + 1] = ink;
                                outData.data[pi + 2] = ink;
                                outData.data[pi + 3] = 255;
                            }
                        }
                        dCtx.putImageData(outData, 0, 0);
                    }
                }

                cellMat.delete(); cc.delete(); ch2.delete();

                if (hasDigit) {
                    const result = DigitClassifier.classifyWithScore(digitCanvas);
                    let accept = result.digit && result.distance <= 4.0 && result.margin >= 0.04 && result.avgInk >= 0.008 && result.avgInk <= 0.70;
                    if (!accept && result.digit && result.distance <= 5.5 && result.avgInk >= 0.006 && result.avgInk <= 0.78) {
                        accept = true;
                    }
                    if (accept) {
                        currentBoard[row][col] = result.digit;
                        scoredCells[row][col] = result;
                        const cellEl = getCellElement(row, col);
                        const inp = getCellInput(row, col);
                        inp.value = result.digit;
                        cellEl.classList.add('preset-value');
                        inp.disabled = true;
                        found++;
                    }
                }

                progressBar.style.width = `${Math.round(((row * 9 + col + 1) / 81) * 100)}%`;
                loaderSubtitle.textContent = `Scanned ${row * 9 + col + 1}/81 cells — ${found} digits found`;
            }
            await new Promise(res => setTimeout(res, 0));
        }

        const removedConflicts = stripDuplicateDigitConflicts(scoredCells);
        if (removedConflicts > 0) {
            found = Math.max(0, found - removedConflicts);
        }
        closed.delete();
        warpGray.delete();
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
}

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
