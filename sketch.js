// ──────────────────────────────────────────────────────────────────
//XSETTINGS
// ──────────────────────────────────────────────────────────────────

const fabricWidthCm   = 20;   

const warpThreadsPerCm = 4;   // warp ends per cm /  reed sett


const weftPicksPerCm   = 1.3;   // weft picks per cm/ pick density before = 2.5!!
//warp is being stretches, things will collapse a little, so round down

// eco barbante cotton twist: 1.3
//cottolin + wool: 3 
//cottolin + cottolin: 4?

const threadsPerDent   = 2;   // 0.1 to 1

// image

const darkPixelThreshold = 0.3;  // 0.1 to 1
//0.3




// appearance:
const squareHeight    = 0.5;  // fraction of a pick-row for rectangle height
const squareWidth     = 0.8;  // fraction of a module for rectangle width

// grid styling:
const gridLightOpacity  = 120;
const gridStrongOpacity = 120;
const gridLightWeight   = 1;
const gridStrongWeight  = 2;
// ──────────────────────────────────────────────────────────────────

// derived horizontal:
const modulesPerCm = warpThreadsPerCm / threadsPerDent; 

//OVERWRITING TOTAL UNITS
const totalUnits   = fabricWidthCm * modulesPerCm;       
// const totalUnits   = 121       



// image file
const filename = 'Artboard 2.png';

let img;
let rowsModules = [];
let currentRow  = 0;
let cnv;

// DOM elements
let hdr, inpJump, btnGo, previewBtn, imgBtn, spanCm, bottomDiv;
let previewAll = false;
let showImage = true; // ← NEW: controls whether the image is drawn

// vertical density (initialized in setup)
let fabricHeightCm, totalPickRows;

function preload() {
  img = loadImage(filename);
}

//start helper
function computeEdgeDiffs(previousModules, currentModules) {
  const leftPrev  = previousModules[0]      || 0;
  const rightPrev = previousModules.at(-1) || 0;
  const leftCurr  = currentModules[0]       || 0;
  const rightCurr = currentModules.at(-1)  || 0;

  const leftDiff  = leftPrev  - leftCurr;
  const rightDiff = rightCurr - rightPrev;
  return [ leftDiff, rightDiff ];
}

/** Turn a positive diff into “+…”, negative into “-…” */
function diffMarker(n) {
  if (n > 0) return '+'.repeat(n);
  if (n < 0) return '-'.repeat(-n);
  return '';
}

// end helped


// Build the pick‐map: for each pick‐row (0 at top → bottom), list the modules
// 
function buildPickMap() {
  img.loadPixels();        // make sure img.pixels[] is populated
  rowsModules = [];        // clear any previous data

  

  // For each “pick” row from top (0) to bottom (totalPickRows-1)…
  for (let rowIndex = 0; rowIndex < totalPickRows; rowIndex++) {
    const modulesToPick = [];

    // Which pixel-rows in the image map to this weave row?
    const pixelRowStart = floor(rowIndex     * img.height / totalPickRows);
    const pixelRowEnd   = floor((rowIndex+1) * img.height / totalPickRows);

    // Scan each vertical module (warp group) across that band:
    for (let moduleIndex = 0; moduleIndex < totalUnits; moduleIndex++) {
      // Which pixel-columns correspond to this module?
      const pixelColStart = floor(moduleIndex     * img.width / totalUnits);
      const pixelColEnd   = floor((moduleIndex+1) * img.width / totalUnits);

      // Dimensions of this module×row block
      const blockWidth  = pixelColEnd   - pixelColStart;
      const blockHeight = pixelRowEnd   - pixelRowStart;
      const totalPixels = blockWidth * blockHeight;

      // Count how many of those pixels are “dark”
      let darkCount = 0;
      for (let py = pixelRowStart; py < pixelRowEnd; py++) {
        for (let px = pixelColStart; px < pixelColEnd; px++) {
          const base = 4 * (py * img.width + px);
          const r = img.pixels[base + 0];
          const g = img.pixels[base + 1];
          const b = img.pixels[base + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 128) {
            darkCount++;
          }
        }
      }

      // If the fraction of dark pixels meets your threshold, mark it
      if ((darkCount / totalPixels) >= darkPixelThreshold) {
        modulesToPick.push(moduleIndex);
      }
    }

    // Save this row’s pick-list
    rowsModules.push(modulesToPick);
  }
}


// ──────────────────────────────────────────────────────────────────

function setup() {
  // compute vertical density
  fabricHeightCm = (img.height / img.width) * fabricWidthCm;
  totalPickRows  = Math.round(fabricHeightCm * weftPicksPerCm);

  // prevent page scroll on arrow keys (unless input focused)
  window.addEventListener('keydown', e => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        document.activeElement !== inpJump.elt) {
      e.preventDefault();
    }
  }, { passive: false });

  // full‐width canvas with correct aspect
  const canvasH = windowWidth * img.height / img.width;
  cnv = createCanvas(windowWidth, canvasH);

  // build the pick‐map once
  buildPickMap();

  // ─── HEADER ─────────────────────────────────────────────────────
  hdr = createDiv().style(`
    position: fixed; top: 0; left: 0;
    background: rgba(255,255,255,0.9);
    padding: 6px 12px; font-size: 18px; font-family: sans-serif;
    z-index: 100; display: flex; align-items: center; gap: 8px;
  `);
  createSpan('Row ').parent(hdr);

  inpJump = createInput(currentRow + 1, 'number')
    .attribute('min','1').attribute('max', totalPickRows)
    .style('width','60px').parent(hdr);

  btnGo = createButton('Go')
    .parent(hdr)
    .mousePressed(() => {
      const v = parseInt(inpJump.value(), 10);
      if (!isNaN(v)) {
        currentRow = constrain(v - 1, 0, totalPickRows - 1);
        scrollToCurrentRow();
      }
    });

  previewBtn = createButton('Show grid')
    .parent(hdr)
    .mousePressed(() => {
      previewAll = !previewAll;
      previewBtn.html(previewAll ? 'Hide grid' : 'Show grid');
    });

  // UPDATED: separate button that toggles image visibility
  imgBtn = createButton('Hide image')
    .parent(hdr)
    .mousePressed(() => {
      showImage = !showImage;
      imgBtn.html(showImage ? 'Hide image' : 'Show image');
    });

  spanCm = createSpan().parent(hdr);

  // ─── FOOTER ─────────────────────────────────────────────────────
  bottomDiv = createDiv().style(`
    position: fixed; bottom: 10px; left: 0;
    padding: 6px 12px; font-size: 22px; font-family: sans-serif;
    z-index: 100; display: flex; gap: 6px;
  `);
}

function windowResized() {
  const canvasH = windowWidth * img.height / img.width;
  resizeCanvas(windowWidth, canvasH);
}

// ──────────────────────────────────────────────────────────────────
function draw() {
  background(255);

  // draw image + vertical warp grid
  if (showImage) {
    image(img, 0, 0, width, height); // ← gated by showImage
  }
  drawGrid();

  // if full preview toggled, draw grey modules
  if (previewAll) drawPreviewBlocks();

  // always draw current‐row blue modules on top
  drawPickBlocks();

  drawInlineLabels();


  // highlight the current row
  drawHighlightLine();

  // refresh header & footer
  updateHeader();
  drawFooter();
}
// ──────────────────────────────────────────────────────────────────
function drawGrid() {
  const moduleW = width  / totalUnits;       // px per warp‐module
  const rowH    = height / totalPickRows;    // px per weft‐pick

  // 1) Vertical (warp) lines every module, bold every modulesPerCm
  for (let u = 0; u <= totalUnits; u++) {
    const isWarpCm = (u % modulesPerCm === 0);
    stroke(150, isWarpCm ? gridStrongOpacity : gridLightOpacity);
    strokeWeight(isWarpCm ? gridStrongWeight : gridLightWeight);
    line(u * moduleW, 0, u * moduleW, height);
  }

  // 2) Horizontal (weft) lines every pick, bold every weftPicksPerCm
  for (let r = 0; r <= totalPickRows; r++) {
    const isWeftCm = (r % weftPicksPerCm === 0);
    stroke(150, isWeftCm ? gridStrongOpacity : gridLightOpacity);
    strokeWeight(isWeftCm ? gridStrongWeight : gridLightWeight);
    line(0, r * rowH, width, r * rowH);
  }
}

function drawPickBlocks() {
  noStroke(); fill('blue');
  const moduleW = width / totalUnits;
  const rowH    = height / totalPickRows;
  const mapRow  = totalPickRows - 1 - currentRow;
  const yCenter = mapRow * rowH + rowH/2;
  const blockH  = rowH * squareHeight;

  for (let m of rowsModules[mapRow]) {
    rect(
      m * moduleW,
      yCenter + -3,              // a small offset below the line
      moduleW * squareWidth,
      blockH
    );
  }
}

function drawPreviewBlocks() {
  noStroke(); fill(4, 59, 92,255);
  const moduleW = width / totalUnits;
  const rowH    = height / totalPickRows;
  const blockH  = rowH * squareHeight;

  for (let r = 0; r < totalPickRows; r++) {
    const yCenter = r * rowH + rowH/2;
    for (let m of rowsModules[r]) {
      rect(
        m * moduleW,
        yCenter - blockH/2,
        moduleW * squareWidth,
        blockH
      );
    }
  }
}


function drawInlineLabels() {
  // 1) sizing
  const moduleW = width  / totalUnits;     // px per warp-module
  const rowH    = height / totalPickRows;  // px per weft-pick
  const mapRow  = totalPickRows - 1 - currentRow;

  // 2) build boolean flags of this row
  const flags = new Array(totalUnits).fill(false);
  for (let m of rowsModules[mapRow]) flags[m] = true;

  // 3) run-length encode current row
  const runs    = [];
  let curFlag   = flags[0], runLen = 1;
  for (let i = 1; i < totalUnits; i++) {
    if (flags[i] === curFlag) {
      runLen++;
    } else {
      runs.push({ picked: curFlag, units: runLen });
      curFlag = flags[i];
      runLen  = 1;
    }
  }
  runs.push({ picked: curFlag, units: runLen });

  // 4) do the same for the previous row (for diffing)
  const prevMap = mapRow + 1 < totalPickRows
    ? rowsModules[mapRow + 1]
    : [];
  const prevFlags = new Array(totalUnits).fill(false);
  for (let m of prevMap) prevFlags[m] = true;

  const prevRuns = [];
  let pFlag = prevFlags[0], pLen = 1;
  for (let i = 1; i < totalUnits; i++) {
    if (prevFlags[i] === pFlag) {
      pLen++;
    } else {
      prevRuns.push({ picked: pFlag, units: pLen });
      pFlag = prevFlags[i];
      pLen  = 1;
    }
  }
  prevRuns.push({ picked: pFlag, units: pLen });

  // 5) draw each run’s label beneath the blocks, showing +/– diff
  textSize(14);
  let xCursor = 0;
  const yBase = mapRow * rowH + rowH + 8;
  for (let idx = 0; idx < runs.length; idx++) {
    const run     = runs[idx];
    const prevRun = prevRuns[idx] || { units: 0 };

    // core label
    let labelText = run.picked
      ? `pick ${run.units}`
      : `blank ${run.units}`;

    // compute diff and cap at ±2
    const diff = run.units - prevRun.units;
    let marker = '';
    if      (diff >=  2) marker = '++';
    else if (diff === 1) marker = '+';
    else if (diff === -1)marker = '-';
    else if (diff <= -2) marker = '--';

    if (marker) labelText += ' ' + marker;

    // measure
    const tw  = textWidth(labelText);
    const th  = textAscent() + textDescent();
    const pad = 4;

    // bubble
    fill(run.picked ? 0 : 255, 80);
    noStroke();
    rect(
      xCursor + (moduleW * run.units - tw)/2 - pad,
      yBase - pad,
      tw + pad*2,
      th + pad*2,
      4
    );

    // text
    fill(run.picked ? 255 : 0);
    text(
      labelText,
      xCursor + (moduleW * run.units - tw)/2,
      yBase + textAscent()/2
    );

    xCursor += moduleW * run.units;
  }
}





function drawHighlightLine() {
  // height of each weft-row in canvas-pixels:
  const rowH = height / totalPickRows;

  // pick-row index, 0=bottom, totalPickRows-1=top:
  const gridRow = totalPickRows - 1 - currentRow;

  // highlight exactly at that grid line:
  const yPos = gridRow * rowH;

  stroke('tomato');
  strokeWeight(3);
  line(0, yPos, width, yPos);
}


function updateHeader() {
  if (document.activeElement !== inpJump.elt) {
    inpJump.value(currentRow + 1);
  }
  // show actual cm on header
  const cm = ((currentRow + 1) / weftPicksPerCm).toFixed(1);
  spanCm.html(
    `(${cm} cm) ${fabricWidthCm} cm at ` +
    `${warpThreadsPerCm} e/cm (warp), ` +
    `${weftPicksPerCm} p/cm (weft), ` +
    `${totalUnits} dents used, ` +
    `${totalUnits * 10 }   pixels image`
  );
}

function drawFooter() {
  // 1) which array row to use?
  const mapRow = totalPickRows - 1 - currentRow;

  // 2) boolean flags for each module
  const flags = new Array(totalUnits).fill(false);
  for (let m of rowsModules[mapRow]) {
    flags[m] = true;
  }

  // 3) run‐length encode
  const runs = [];
  let flag = flags[0], len = 1;
  for (let i = 1; i < totalUnits; i++) {
    if (flags[i] === flag) {
      len++;
    } else {
      runs.push({ picked: flag, units: len });
      flag = flags[i];
      len = 1;
    }
  }
  runs.push({ picked: flag, units: len });

  // 4) build HTML with clear labels
  let html = '';
  for (let run of runs) {
    let labelText, bgColor, textColor;
    if (run.picked) {
      labelText = 'pick ' + run.units;
      bgColor   = 'rgba(0,0,0,0.4)';
      textColor = 'white';
    } else {
      labelText = '–– ' + run.units;
      bgColor   = 'rgba(255,255,255,0.7)';
      textColor = 'black';
    }
    html +=
      `<span style="
         background:${bgColor};
         color:${textColor};
         border:1px solid ${textColor};
         padding:4px 10px 6px;
         border-radius:50px;
         margin-right:6px;
      ">${labelText}</span>`;
  }

  bottomDiv.html(html);
}

function scrollToCurrentRow() {
  const rowH = height / totalPickRows;
  const yPix = (totalPickRows - 1 - currentRow) * rowH;
  window.scrollTo({ top: yPix - 400, behavior: 'smooth' });
}

function keyPressed() {
  if (keyCode === DOWN_ARROW) {
    currentRow = max(currentRow - 1, 0);
    scrollToCurrentRow();
    return false;
  }
  if (keyCode === UP_ARROW) {
    currentRow = min(currentRow + 1, totalPickRows - 1);
    scrollToCurrentRow();
    return false;
  }
}
