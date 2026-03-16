// ==========================================
//  HighCourt 相关逻辑
// ==========================================

let audioCtx = null;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new window.AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playGavelSmash() {
    if (!audioCtx) return;
    const time = audioCtx.currentTime;

    // 1. 低频重击声 (Thud)
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    oscGain.gain.setValueAtTime(1, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.2);

    // 2. 白噪音拍击感 (Crack)
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSource.start(time);
}

// ==========================================
// 事件委托
// ==========================================
let isCourtEventsBound = false;

function bindCourtEvents() {
    if (isCourtEventsBound) return;
    isCourtEventsBound = true;

    document.addEventListener('click', (e) => {
        // --- 1. 点击查阅判决：调用全局公共面板打开逻辑 ---
        const triggerBtn = e.target.closest('.verdict-trigger');
        if (triggerBtn) {
            initAudioContext();
            setTimeout(() => { playGavelSmash(); }, 150);
            const targetId = triggerBtn.getAttribute('data-target');
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

        // --- 3. 点击 shiosai-highcourt-card 切换 debate-section 展开/收起 ---
        const cardContainer = e.target.closest('.shiosai-highcourt-card');
        if (cardContainer) {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                return;
            }
            const debateSection = cardContainer.querySelector('.debate-section');
            if (debateSection) {
                debateSection.classList.toggle('is-open');
            }
            e.stopPropagation();
            return;
        }
    });
}
// ==========================================
// 渲染器
// ==========================================
function renderHighCourt(rawContent) {
    // 1. 基础清理
    let content = rawContent.split('\n').map(line => line.trim()).join('\n');

    // ==========================================
    // 第一层（外层）：结构化数据提取
    // ==========================================
    let caseName = "UNKNOWN CASE";
    let statusText = "N/A";
    let rawDebate = "";
    let rawVerdict = "";
    let imageHTML = '';

    const caseMatch = content.match(ShiosaiRegex.CASE);
    if (caseMatch) caseName = caseMatch[1].trim();

    const statusMatch = content.match(ShiosaiRegex.STATUS);
    if (statusMatch) statusText = statusMatch[1].trim();

    const debateMatch = content.match(ShiosaiRegex.DEBATE);
    if (debateMatch) rawDebate = debateMatch[1].trim();

    const verdictMatch = content.match(ShiosaiRegex.VERDICT);
    if (verdictMatch) rawVerdict = verdictMatch[1].trim();

    const imageMatch = content.match(ShiosaiRegex.IMG_PRO);
    if (imageMatch) {
        const rawPrompt = imageMatch[1].trim();
        imageHTML = ShiosaiImage.renderTag(rawPrompt);
        imageHTML = `<div class="img-border">${imageHTML}</div>`;
    }
    // ==========================================
    // 第二层（内层）：行内元素解析与子模块渲染
    // ==========================================
    let debateHTML = parseScriptBlock(rawDebate, 'HighCourt');
    // ==========================================
    // 第三层：数据拼装与面板注册
    // ==========================================
    const docId = generateContentHash(rawVerdict).toUpperCase();
    const targetId = `court_verdict_${docId}`;


    // 调用时间解析
    const { dateText, rawDateObj } = parseShiosaiTimestamp();

    // 生成英文日期
    let letterDateText = rawDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const copyNum = String(Math.floor(Math.random() * 250));

    // 缓存判决书面板 HTML
    const panelHtml = `
        <div class="shiosai-panel court-data" id="${targetId}">
            <div class="verdict-paper">
                <div class="letter-header">
                    <div class="letter-logo">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" stroke="#8b0000" stroke-width="3" fill="none" stroke-dasharray="60 4 10 4"/>
                            <text x="50" y="62" text-anchor="middle" fill="#8b0000" font-family="'Times New Roman', serif" font-size="34" font-weight="900">SH</text>
                        </svg>
                    </div>
                    <div class="letter-org">
                        <div class="org-name">Shiosai HighCourt, INC.</div>
                        <div class="org-address">DIVISION OF ANOMALOUS BEHAVIOR • SECTOR 404</div>
                    </div>
                </div>
                <div class="letter-papper">
                    <div class="letter-meta">
                        <div class="meta-recipient">
                            <div class="meta-record">${docId}</div>
                            <div class="meta-no">${copyNum}</div>
                        </div>
                        <div class="meta-date">${letterDateText}</div>
                    </div>
                    <div class="verdict-content">${rawVerdict}</div>
                    <div class="letter-signature"><div class="sign-marker">yoika.</div></div>
                </div>
                <div class="stamp-seal">BAKA CER.</div>
            </div>
        </div>`;
    setShiosaiCache(targetId, panelHtml);

    // 绑定事件
    bindCourtEvents();

    // 返回主卡片 HTML
    return `
        <div class="theme-wrapper theme-wrapper-highcourt">
            <div class="shiosai-highcourt-card">
                <div class="card-header">
                    <div class="doc-meta">
                        <div class="doc-id">#SH.${docId}</div>
                        <div class="doc-date">${dateText}</div>
                    </div>
                    <div class="court-logo">Shiosai HighCourt</div>
                    <h2>${caseName}</h2>
                    <div class="status-atmosphere">
                        <div class="status-atmosphere-header">现场定性</div>
                        ${statusText}
                    </div>
                    ${imageHTML}
                </div>
                <div class="card-hr"></div>
                <div class="debate-section">
                    ${debateHTML}
                    <div class="verdict-trigger" data-target="${targetId}">查阅最终判决</div>
                </div>
                <div class="card-footer"></div>
            </div>
        </div>
    `;
}