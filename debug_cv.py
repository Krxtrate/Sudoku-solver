import cv2
import numpy as np
import sys
import glob

# Find the latest artifact image
images = glob.glob(r'C:\Users\krita\.gemini\antigravity\brain\cfc4bcd9-2d47-41a5-8a9f-267848914de0\*.png')
if not images:
    print("No images found.")
    sys.exit(1)

latest_image = max(images)
print(f"Testing on {latest_image}")

img = cv2.imread(latest_image)
if img is None:
    print("Failed to load image")
    sys.exit(1)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

contours, hierarchy = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

bestArea = 0
bestIdx = -1
for i, cnt in enumerate(contours):
    area = cv2.contourArea(cnt)
    if area > bestArea:
        bestArea = area
        bestIdx = i

if bestIdx == -1 or bestArea < 5000:
    print("No grid found.")
    sys.exit(1)

bestCnt = contours[bestIdx]
perim = cv2.arcLength(bestCnt, True)

foundQuad = False
approx = None
for eps in [0.02, 0.03, 0.05, 0.07, 0.10]:
    approx = cv2.approxPolyDP(bestCnt, eps * perim, True)
    if len(approx) == 4:
        foundQuad = True
        print(f"Found quad with eps {eps}")
        break

if foundQuad:
    pts = approx.reshape(4, 2)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
else:
    print("Fell back to bounding rect")
    x, y, w, h = cv2.boundingRect(bestCnt)
    p = 2
    tl = [x+p, y+p]
    tr = [x+w-p, y+p]
    bl = [x+p, y+h-p]
    br = [x+w-p, y+h-p]

print(f"Corners: tl={tl}, tr={tr}, bl={bl}, br={br}")

SIDE = 450
srcPts = np.array([tl, tr, bl, br], dtype="float32")
dstPts = np.array([[0, 0], [SIDE, 0], [0, SIDE], [SIDE, SIDE]], dtype="float32")
M = cv2.getPerspectiveTransform(srcPts, dstPts)
warped = cv2.warpPerspective(img, M, (SIDE, SIDE))

warpGray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
warpThresh = cv2.adaptiveThreshold(warpGray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 9)

kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
closed = cv2.morphologyEx(warpThresh, cv2.MORPH_CLOSE, kernel)

CS = SIDE // 9
GUARD = 4

found = 0
for row in range(9):
    for col in range(9):
        cx = col * CS + GUARD
        cy = row * CS + GUARD
        cw = min(CS - 2 * GUARD, SIDE - cx)
        ch = min(CS - 2 * GUARD, SIDE - cy)
        
        cellMat = closed[cy:cy+ch, cx:cx+cw]
        inkCount = cv2.countNonZero(cellMat)
        
        if inkCount / (cw * ch) < 0.02:
            continue
            
        cc, ch2 = cv2.findContours(cellMat, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        maxA = 0
        maxI = -1
        for i, c in enumerate(cc):
            a = cv2.contourArea(c)
            if a > maxA:
                maxA = a
                maxI = i
                
        if maxI != -1 and maxA > 15:
            x, y, w, h = cv2.boundingRect(cc[maxI])
            aspect = w / max(h, 1)
            hRatio = h / ch
            
            if 0.1 <= aspect <= 8.0 and 0.2 <= hRatio <= 1.1:
                found += 1
                print(f"Cell {row},{col}: found digit. Aspect {aspect:.2f}, hRatio {hRatio:.2f}")

print(f"Total digits found: {found}")
