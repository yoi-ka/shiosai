// ==========================================
// BehindTheScenes 相关逻辑
// ==========================================

let isBtsEventsBound = false;
const audioUrl = "https://sharkpan.xyz/f/Ll74u7/clapper.mp3";
const realClapperAudio = new Audio(audioUrl);
realClapperAudio.preload = 'auto';

function playClapperSnap() {
    if (!realClapperAudio) return;
    try {
        realClapperAudio.currentTime = 0;
        realClapperAudio.play().catch(() => { });
    } catch (e) { }
}

// ==========================================
// 事件委托
// ==========================================
function bindBtsEvents() {
    if (isBtsEventsBound) return;
    isBtsEventsBound = true;

    document.addEventListener('click', (e) => {
        // --- 1. 点击Tab按钮：调用公共面板打开逻辑 ---
        const tabBtn = e.target.closest('.bts-tab-btn');
        if (tabBtn) {
            const targetId = tabBtn.getAttribute('data-target');
            openShiosaiPanel(targetId);
            e.stopPropagation();
            return;
        }

        // --- 2. 点击图片放大 ---
        const imgBorder = e.target.closest('.img-border');
        if (imgBorder && imgBorder.innerHTML.trim() !== '') {
            try {
                const parentDoc = window.parent.document;
                const overlay = parentDoc.querySelector('.shiosai-overlay');
                if (overlay) {
                    // 销毁上一次遗留的图片容器
                    overlay.querySelectorAll('.shiosai-img-container').forEach(el => el.remove());
                    // 创建新容器并注入
                    const imgContainer = parentDoc.createElement('div');
                    // 默认加上 is-active
                    imgContainer.className = 'shiosai-img-container is-active';
                    imgContainer.innerHTML = `
                        <div class="open-img-border">
                            ${imgBorder.innerHTML}
                        </div>
                    `;
                    // 挂载并激活外层
                    overlay.appendChild(imgContainer);
                    overlay.classList.add('is-active');
                }
            } catch (err) { }
            e.stopPropagation();
            return;
        }
        // --- 3. 点击场记板主板 ---
        const board = e.target.closest('.realistic-clapboard');
        if (board) {
            const wrapper = board.closest('.theme-wrapper-film');
            const card = board.closest('.shiosai-film');
            if (!wrapper || !card) return;

            const clapperBoard = card.querySelector('.clapper-board');
            const stickTop = board.querySelector('.stick-top');
            const hiddenSections = wrapper.querySelector('.bts-sections');

            board.classList.toggle('is-active');

            if (clapperBoard) clapperBoard.classList.toggle('is-open');
            if (hiddenSections) hiddenSections.classList.add('is-revealed');

            if (stickTop) {
                stickTop.classList.remove('is-clapping');
                void stickTop.offsetWidth; // 触发重绘
                stickTop.classList.add('is-clapping');
                setTimeout(() => { stickTop.classList.remove('is-clapping'); }, 400);
            }
            setTimeout(playClapperSnap, 60);
            return;
        }
    });
}

function getRandomLens() {
    const configurations = [
        "24mm T1.4\nND.3",
        "35mm T1.5\n1/4 BPM",
        "50mm T1.2",
        "50mm T1.4\n1/8 BPM",
        "85mm T1.4\nND.6",
        "135mm T2.0",
        "40mm Anamorphic",
        "65mm Anamorphic"
    ];

    const randomIndex = Math.floor(Math.random() * configurations.length);
    return configurations[randomIndex];
}
// ==========================================
// 渲染器
// ==========================================
function renderBehindTheScenes(rawContent) {
    // 1. 基础清理
    let content = rawContent.split('\n').map(line => line.trim()).join('\n');

    // ==========================================
    // 第一层（外层）：安全提取大区块
    // ==========================================
    let rawStatus = "";
    let rawScene = "";
    let rawCut = "";
    let rawNote = "";
    let imageHTML = '';


    const statusMatch = content.match(ShiosaiRegex.STATUS);
    if (statusMatch) rawStatus = statusMatch[1].trim();

    const sceneLineMatch = content.match(ShiosaiRegex.SCENE);
    if (sceneLineMatch) rawScene = sceneLineMatch[1].trim();

    const cutMatch = content.match(ShiosaiRegex.CUT);
    if (cutMatch) rawCut = cutMatch[1].trim();

    const noteMatch = content.match(ShiosaiRegex.NOTE);
    if (noteMatch) rawNote = noteMatch[1].trim();

    const imageMatch = content.match(ShiosaiRegex.IMG_PRO);
    if (imageMatch) {
        const rawPrompt = imageMatch[1].trim();
        imageHTML = ShiosaiImage.renderTag(rawPrompt);
        imageHTML = `<div class="img-border">${imageHTML}</div>`;
    }

    // ==========================================
    // 第二层（内层）：行内元素解析与默认值兜底
    // ==========================================
    let sceneNum = "1A";
    let takeNum = "1";
    let status = rawStatus || "现场准备中...";
    let noteContent = rawNote || "";

    if (rawScene) {
        const parts = rawScene.split('-');
        if (parts[0]) sceneNum = parts[0].trim();
        if (parts[1]) takeNum = parts[1].trim();
    }

    // ==========================================
    // 第三层：数据拼装与面板注册
    // ==========================================

    // 时间与随机参数解析
    const { timeText, rawDateObj } = parseShiosaiTimestamp();
    const DateText = rawDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const pad = (num) => num.toString().padStart(2, '0');
    let h = Math.floor(Math.random() * 14) + 10;
    let m = Math.floor(Math.random() * 60);
    let s = Math.floor(Math.random() * 60);
    let recTime = `${pad(h)}:${pad(m)}:${pad(s)}`;

    let rollChar = String.fromCharCode(65 + Math.floor(Math.random() * 3));
    let rollDigit = pad(Math.floor(Math.random() * 35) + 1);
    let activeRoll = `ROLL ${rollChar}`;
    let rollNum = `${rollChar}${rollDigit}`;

    // 随机镜头
    let lensFilter = getRandomLens();

    // 面板缓存与 Tab 按钮生成
    let tabsHtml = '';

    if (rawNote) {
        const targetId = `bts_note_${generateContentHash(rawNote)}`;
        const panelHtml = `
            <div class="shiosai-panel note-data" id="${targetId}">
                <div class="note-container">
                    <div class="note-paper">${noteContent}</div>
                </div>
            </div>`;
        setShiosaiCache(targetId, panelHtml);
        tabsHtml += `<div class="bts-tab-btn" data-target="${targetId}"></div>`;
    }
    if (rawCut) {
        const targetId = `bts_cut_${generateContentHash(rawCut)}`;
        const panelHtml = `
            <div class="shiosai-panel cut-data" id="${targetId}">
                <div class="script-container">
                    <p>SCENE ${sceneNum} | TAKE ${takeNum}</p>
                    ${parseScriptBlock(rawCut, 'BehindTheScenes')}
                </div>
            </div>`;
        setShiosaiCache(targetId, panelHtml);
        tabsHtml += `<div class="bts-tab-btn" data-target="${targetId}"></div>`;
    }

    const extensionsHtml = `
        <div class="bts-sections">
            ${tabsHtml}
            ${imageHTML}
        </div>`;
    // 绑定事件
    bindBtsEvents();

    // 最终 HTML 渲染
    return `
<div class="theme-wrapper-film">
    <div class="shiosai-film">
        <div class="realistic-clapboard">
            <div class="clapper-sticks">
                <div class="clapper-stick stick-bottom"></div>
                <div class="clapper-stick stick-top"></div>
                <div class="clapper-hinge-plate">
                    <div class="hinge-screw screw-1"></div>
                    <div class="hinge-screw screw-2"></div>
                    <div class="hinge-screw screw-3"></div>
                </div>
            </div>

            <div class="bts-status-bar">
                <div class="status-left">
                    <div class="status-label">SHIOSAI FILM</div>
                    <div class="status-text">${status}</div>
                </div>
                <div class="status-right">
                    <div class="rec-dot"></div>
                    <span>REC ${recTime} - ${activeRoll}</span>
                </div>
            </div>
        </div>

        <div class="clapper-board">
            <div class="clapper-board-content">
                <div class="board-red-header">
                    <div class="red-stats-group">
                        <div class="red-stat-block"><span class="red-value">${rollNum}</span><span class="red-label">ROLL</span></div>
                        <div class="red-stat-block"><span class="red-value">${sceneNum}</span><span class="red-label">SCENE</span></div>
                        <div class="red-stat-block"><span class="red-value">${takeNum}</span><span class="red-label">TAKE</span></div>
                    </div>
                    <div class="title-section">
                        <div class="title-text">SHIOSAI</div>
                        <div class="title-text-2">P R O J E C T</div>
                    </div>
                </div>

                <div class="board-white-footer">
                    <div class="white-info-block">
                        <span class="info-label">DATE</span>
                        <span class="info-value">${DateText}</span>
                    </div>
                    <div class="white-info-block">
                        <span class="info-label">TIME</span>
                        <span class="info-value">${timeText}</span>
                    </div>
                    <div class="white-info-block">
                        <span class="info-label">LENS/FILTER</span>
                        <span class="info-value">${lensFilter}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    ${extensionsHtml}

</div>
    `;
}
