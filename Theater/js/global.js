// ==========================================
// 1. 全局状态与缓存
// ==========================================
window.ShiosaiPanelCache = window.ShiosaiPanelCache || {};
window.ShiosaiCacheKeys = window.ShiosaiCacheKeys || [];
const MAX_CACHE_SIZE = 50; // 最大缓存数量

function setShiosaiCache(id, htmlString) {
    if (window.ShiosaiPanelCache[id]) return;
    // 写入 Key
    window.ShiosaiPanelCache[id] = htmlString;
    window.ShiosaiCacheKeys.push(id);
    // FIFO
    if (window.ShiosaiCacheKeys.length > MAX_CACHE_SIZE) {
        const oldestId = window.ShiosaiCacheKeys.shift();
        delete window.ShiosaiPanelCache[oldestId];
    }
}

// ==========================================
// 2. 通用工具
// ==========================================
const parentDoc = window.parent.document;
/*!
==========================================
正则字典
注意：捕获组不可以使用 $1$2 等替换，与环境冲突
这块注释不要删掉（必须是多行注释）
==========================================
*/
const ShiosaiRegex = {
    //预处理
    MAIN_BLOCK: /<Shiosai\s+type="(.*?)";?>([\s\S]*)<\/Shiosai>/i,
    // 通用
    MOSAIC: /~~(.*?)~~/g,
    STAGE_DIR: /[(（].*?[)）]/g,
    ACTION_LINE: /^\*(.*?)\*$/gm,
    DIALOGUE_LINE: /^(.*?)[:：]\s*(.*)$/,
    STATUS: /status[:：]\s*(.*)/i,
    IMG_PRO: /snapshot[:：]\s*([\s\S]*)$/i,

    // BehindTheScenes 专用
    SCENE: /scene[:：]\s*(.*)/i,
    CUT: /cut[:：]\s*([\s\S]*?)(?=note[:：]|snapshot[:：]|$)/i,
    NOTE: /note[:：]\s*([\s\S]*?)(?=snapshot[:：]|$)/i,

    // HighCourt 专用
    CASE: /case[:：]\s*(.*)/i,
    DEBATE: /debate[:：]\s*([\s\S]*?)(?=verdict[:：]|snapshot[:：]|$)/i,
    VERDICT: /verdict[:：]\s*([\s\S]*?)(?=snapshot[:：]|$)/i,
};
// 哈希生成器
function generateContentHash(str) {
    if (!str) return 'empty';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// 酒馆消息时间解析器
function parseShiosaiTimestamp() {
    let rawDateObj = new Date();
    let dateText = rawDateObj.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '.');

    let timeText = rawDateObj.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    // 将替换逻辑移到内部，并接收参数
    function replaceShiosaiTimestamp(timeStr) {
        const normalizedTime = timeStr.replace('年', '/').replace('月', '/').replace('日', '');
        const d = new Date(normalizedTime);
        if (!isNaN(d.getTime())) {
            rawDateObj = d;
            dateText = d.getFullYear() + '.' +
                (d.getMonth() + 1).toString().padStart(2, '0') + '.' +
                d.getDate().toString().padStart(2, '0');
            timeText = d.getHours().toString().padStart(2, '0') + ':' +
                d.getMinutes().toString().padStart(2, '0');
        }
    }

    try {
        if (window.frameElement) {
            const mesNode = window.frameElement.closest('.mes');
            if (mesNode) {
                const rawTime = mesNode.getAttribute('timestamp');
                // 传入 rawTime
                if (rawTime) { replaceShiosaiTimestamp(rawTime); }
            }
        }
    } catch (e) { console.warn("时间解析失败", e); } // 建议把 e 打印出来，方便以后排错

    return { dateText, timeText, rawDateObj };
}

// 角色类名映射
function getCharacterClass(rawName) {
    let charClass = 'char-generic';
    if (rawName.toLowerCase() === 'yuki') charClass = 'char-yuki';
    else if (rawName.toLowerCase() === 'mio') charClass = 'char-mio';
    return charClass;
}
// ==========================================
// 对话块解析
// ==========================================
function parseScriptBlock(text, theme) {
    if (!text) return '';

    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            // 1. 处理 `*` 行
            if (line.startsWith('*') && line.endsWith('*')) {
                const actionText = line.slice(1, -1);
                switch (theme) {
                    case 'HighCourt':
                        return `<div class="action-text"><div class="action-text-header">—— CLERK'S NOTE ——</div>${actionText}</div>`;
                    case 'BehindTheScenes':
                        return `<div class="script-action">${actionText}</div>`;
                }
            }

            // 2. 处理括号内容
            const processedLine = line.replace(ShiosaiRegex.STAGE_DIR, (match) => {
                return `<span class="shiosai-stage-dir">${match.slice(1, -1)}</span>`;
            });

            // 3. 处理对话行
            const dialogueMatch = processedLine.match(ShiosaiRegex.DIALOGUE_LINE);
            if (dialogueMatch) {
                const namePart = dialogueMatch[1].trim();
                const charClass = getCharacterClass(namePart);
                const dialogue = dialogueMatch[2].trim();

                switch (theme) {
                    case 'HighCourt':
                        return `<div class="dialogue-item ${charClass}"><div class="role-name">${namePart}</div><div class="dialogue-text">${dialogue}</div></div>`;
                    case 'BehindTheScenes':
                        return `<div class="script-line"><div class="shiosai-char-name ${charClass}">${namePart}</div><p class="script-dialogue">${dialogue}</p></div>`;
                }
            }
        })
        .join(''); // 合并
}

// ==========================================
// pollinations.ai 图像生成
// ==========================================
const ShiosaiImage = {
    BASE_PATH: 'https://gen.pollinations.ai/image/',
    API_KEY: 'sk_dGTBbk78Di3nJ350gwFioO8WJRvQQE3s',

    // 1. 提示词清洗
    cleanPrompt: function (rawPrompt) {
        if (!rawPrompt) return '';
        let cleaned = rawPrompt.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (!/anime|2d|illustration|manga|comic/i.test(cleaned)) {
            cleaned += ', anime style, best quality';
        }
        return cleaned;
    },

    // 2. 哈希 seed
    generateNumericSeed: function (str) {
        if (!str) return 1024;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 1000000;
    },

    // 3. URL 生成
    generateUrl: function (prompt, options = {}) {
        if (!prompt) return '';

        const cleanedPrompt = this.cleanPrompt(prompt);
        const encodedPrompt = encodeURIComponent(cleanedPrompt).replace(/'/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });

        const defaults = {
            model: 'zimage',
            width: 1440,
            height: 960,
            seed: this.generateNumericSeed(cleanedPrompt),
            nologo: true
        };

        const config = { ...defaults, ...options };
        let finalUrl = this.BASE_PATH + encodedPrompt;
        const queryParams = new URLSearchParams();

        if (this.API_KEY && this.API_KEY !== '') {
            queryParams.set('key', this.API_KEY);
        }

        if (config.model) queryParams.set('model', config.model);
        if (config.width) queryParams.set('width', config.width);
        if (config.height) queryParams.set('height', config.height);
        if (config.seed) queryParams.set('seed', config.seed);
        if (config.nologo) queryParams.set('nologo', config.nologo);

        const queryString = queryParams.toString();
        if (queryString) finalUrl += '?' + queryString;

        return finalUrl;
    },

    // 4. 渲染
    renderTag: function (prompt, options = {}) {
        const imageUrl = this.generateUrl(prompt, options);
        if (!imageUrl) return '';
        return `<div class="img-frame" style="background-image: url('${imageUrl}');"></div>`;
    }
};


// ==========================================
// 3. 环境初始化
// ==========================================
function initShiosaiEnvironment() {
    try {
        // 获取父级 DOM
        if (!parentDoc) return;

        // --- 1. 注入样式 ---
        const styleId = 'ShiosaiGlobal-style';
        if (!parentDoc.getElementById(styleId)) {
            const templateNode = document.getElementById('ShiosaiGlobal-template');
            if (templateNode) {
                const innerStyleNode = templateNode.content ? templateNode.content.querySelector('style') : null;
                const cssText = innerStyleNode ? innerStyleNode.innerHTML : templateNode.innerHTML;

                const parentStyle = parentDoc.createElement('style');
                parentStyle.id = styleId;
                parentStyle.textContent = cssText;
                parentDoc.head.appendChild(parentStyle);
            }
        }

        // --- 2. 挂载字体 ---
        // 获取当前页面 head 中所有的 stylesheet 和 preconnect
        const fontLinks = document.querySelectorAll('head link[rel="stylesheet"], head link[rel="preconnect"]');
        fontLinks.forEach(link => {
            // 使用 getAttribute 获取原始 href，避免浏览器自动加斜杠或转义导致匹配失败
            const url = link.getAttribute('href');
            //  url 包含 'fonts' 就放行
            if (url && url.includes('fonts')) {
                if (!parentDoc.querySelector(`link[href="${url}"]`)) {
                    const newLink = parentDoc.createElement('link');

                    newLink.rel = link.rel;
                    newLink.href = url; // 赋值时用原始 url

                    if (link.crossOrigin) {
                        newLink.crossOrigin = link.crossOrigin;
                    }

                    newLink.className = 'ShiosaiGlobal-FontLink';
                    parentDoc.head.appendChild(newLink);
                }
            }
        });

        // --- 3. Overlay 预注入 ---
        if (!parentDoc.querySelector('.shiosai-overlay')) {
            const overlay = parentDoc.createElement('div');
            overlay.className = 'shiosai-overlay';
            parentDoc.body.appendChild(overlay);
        }

    } catch (e) { console.warn("[SHIOSAI]: 初始化环境失败", e); }
}

// Overlay 点击关闭监听
let isGlobalOverlayBound = false;
function bindGlobalOverlayEvents() {
    if (isGlobalOverlayBound) return;
    isGlobalOverlayBound = true;
    try {
        parentDoc.addEventListener('click', (e) => {
            if (e.target.classList.contains('shiosai-overlay')) {
                // 移除外层的激活态
                e.target.classList.remove('is-active');
                // 延迟移除
                setTimeout(() => {
                    // 移除面板的激活态
                    e.target.querySelectorAll('.shiosai-panel').forEach(panel => panel.classList.remove('is-active'));
                    // 移除图片的激活态
                    e.target.querySelectorAll('.shiosai-img-container').forEach(img => img.classList.remove('is-active'));
                }, 500);
                e.stopPropagation();
            }
        });
    } catch (e) { }
}

// 面板注入与打开
function openShiosaiPanel(targetId) {
    try {
        const overlay = parentDoc.querySelector('.shiosai-overlay');
        if (!overlay) return; // 极端容错

        let targetPanel = parentDoc.getElementById(targetId);

        // 如果没注入过，则从缓存中读取注入
        if (!targetPanel) {
            const htmlString = window.ShiosaiPanelCache[targetId];
            if (htmlString) {
                overlay.insertAdjacentHTML('beforeend', htmlString);
                targetPanel = parentDoc.getElementById(targetId);

                // 控制上限为 4 个（FIFO 淘汰）
                const panels = overlay.querySelectorAll('.shiosai-panel');
                if (panels.length > 4) {
                    panels[0].remove();
                }
            }
        }

        // 切换激活状态
        if (targetPanel) {
            overlay.querySelectorAll('.shiosai-panel').forEach(panel => panel.classList.remove('is-active'));
            targetPanel.classList.add('is-active');
            overlay.classList.add('is-active');
        }
    } catch (err) { console.warn("[SHIOSAI]: 打开面板失败", err); }
}

// ==========================================
// 4. 主执行逻辑
// ==========================================
window.renderShiosai = function () {
    // 1. 环境与事件挂载
    initShiosaiEnvironment();
    bindGlobalOverlayEvents();

    const rawDataElement = document.getElementById('Shiosai-raw-data');
    const renderTarget = document.getElementById('Shiosai-render-target');

    if (!rawDataElement || !renderTarget) return;

    // 错误状态渲染器
    const renderError = () => {
        document.body.className = 'theme-default';
        renderTarget.innerHTML = `
            <div class="error-box">
                <strong>⚠️ 未找到有效的 Shiosai 标签数据</strong><br>
                <span style="color: #a18232; margin-top: 6px; display: inline-block;">
                    请检查源数据标签内是否为以下正确格式：<br>
                    <code>&lt;Shiosai type="..."&gt;</code><br><br>
                    当前支持的 type 类型：<br>
                    <ul style="margin: 4px 0 0 0; padding-left: 24px; color: #856404;">
                        <li><strong>BehindTheScenes</strong> - 拍摄现场</li>
                        <li><strong>HighCourt</strong> - 法庭审判</li>
                    </ul>
                </span>
            </div>`;
    };

    // 2. 提取数据
    const rawData = rawDataElement.textContent || rawDataElement.innerHTML;
    const match = ShiosaiRegex.MAIN_BLOCK.exec(rawData);

    if (!match) {
        return renderError();
    }

    // 3. 预处理数据
    const shiosaiType = match[1].trim();
    let shiosaiContent = match[2].replace(/`([^`]+)`/g, (m, innerText) => {
        return `<code>${innerText}</code>`;
    });

    // 马赛克处理
    shiosaiContent = shiosaiContent.replace(ShiosaiRegex.MOSAIC, (m, mosaicContent) => {
        return `<span class="mosaic-blackout">${mosaicContent}</span>`;
    });

    // 4. 路由分发
    switch (shiosaiType) {
        case 'HighCourt':
            document.body.className = 'theme-highcourt';
            renderTarget.innerHTML = renderHighCourt(shiosaiContent);
            break;
        case 'BehindTheScenes':
            document.body.className = 'theme-behindthescenes';
            renderTarget.innerHTML = renderBehindTheScenes(shiosaiContent);
            break;
        default:
            renderError();
            break;
    }
};
// ==========================================
// 5. 究极逻辑
// ==========================================
if (!window.BakaEgg_initialized) {
    window.BakaEgg_initialized = true;
    const secretCode = [
        'arrowup', 'arrowup',
        'arrowdown', 'arrowdown',
        'arrowleft', 'arrowright',
        'arrowleft', 'arrowright'
    ];

    let inputSequence = [];

    window.addEventListener('keydown', (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();
        inputSequence.push(key);
        if (inputSequence.length > secretCode.length) {
            inputSequence.shift();
        }
        if (inputSequence.length === secretCode.length &&
            inputSequence.every((val, index) => val === secretCode[index])) {
            BakaEgg();
            inputSequence = [];
        }
    });

    function BakaEgg() {
        const Logo = `

      ███╗   ███╗███████╗ ██████╗ ██╗    ██╗    ███████╗ ██╗   ██╗
     ████╗ ████║██╔════╝██╔═══██╗██║    ██║    ██╔════╝████╗  ██║
    ██╔████╔██║█████╗  ██║   ██║██║ █╗ ██║    █████╗  ██╔████╔██║
   ██║╚██╔╝██║██╔══╝  ██║   ██║██║███╗██║    ██╔══╝  ██║╚██╔╝██║
  ██║ ╚═╝ ██║███████╗╚██████╔╝╚███╔███╔╝    ██║     ██║ ╚═╝ ██║
 ╚═╝     ╚═╝╚══════╝ ╚═════╝  ╚══╝╚══╝     ╚═╝     ╚═╝     ╚═╝
`;

        console.clear();
        console.log(
            `%c${Logo}\n%c> WARNING: UNAUTHORIZED ACCESS DETECTED.\n> ESTABLISHING SECURE CONNECTION TO 2077 SERVER...\n> ACCESS GRANTED...%c WELCOME, TIME TRAVELER.`,
            "color: #d6ecf0; text-shadow: 4px -2px 0.1px #549688, -8px 1px 4px #7397ab; font-family: 'Space Mono', Consolas, monospace; line-height: 0.9;font-size: 13px; padding: 4px 0 2px;",
            "color: #bacac6; font-family: 'Courier New', Courier, monospace; font-size: 11.5px; margin-top: 10px;",
            "color: #f20c00; font-family: 'Courier New', Courier, monospace; font-size: 11.5px; margin-top: 10px;"
        );

        triggerScreenShake();
        showBakaAlert();
    }

    function triggerScreenShake() {

        try {
            parentDoc.body.classList.add('baka-shake-active');
            setTimeout(() => {
                parentDoc.body.classList.remove('baka-shake-active');
            }, 400);
        } catch (error) { }
    }

    function showBakaAlert() {
        const existingAlert = parentDoc.getElementById('baka-alert');
        if (existingAlert) existingAlert.remove();

        const alertBox = parentDoc.createElement('div');
        alertBox.id = 'baka-alert';
        alertBox.innerHTML = `
                    <div class="alert-header">>> 嗷嗷嗷！ <<</div>
                    <div class="alert-body">控制台好像掉落了一点东西...</div>
                `;
        parentDoc.body.appendChild(alertBox);
        setTimeout(() => { alertBox.classList.add('show'); }, 500);
        setTimeout(() => {
            alertBox.classList.remove('show');
            setTimeout(() => alertBox.remove(), 1000);
        }, 4000);
    }
}