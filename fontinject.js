const parentDoc = window.parent.document;

function createToggleButton() {
  if (parentDoc.getElementById('meowFM-toggle-btn')) return;

  const btn = parentDoc.createElement('button');
  btn.id = 'meowFM-toggle-btn';

  btn.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 777;
        width: 40px;
        height: 40px;
        background-color: #2c2f33;
        color: white;
        border-radius: 50%;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        border: 1px solid #4f545c;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;

  btn.innerHTML = '<i class="fa-solid fa-virus"></i>';

  btn.onmouseover = () => btn.style.backgroundColor = '#23272a';
  btn.onmouseout = () => btn.style.backgroundColor = '#2c2f33';

  btn.onclick = () => {
    const panel = parentDoc.getElementById('meowFM-font-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    } else {
      createFontInjectionPanel();
    }
  };

  parentDoc.body.appendChild(btn);
}

function createFontInjectionPanel() {
  if (parentDoc.getElementById('meowFM-font-panel')) {
    parentDoc.getElementById('meowFM-font-panel').style.display = 'flex';
    return;
  }

  const panel = parentDoc.createElement('div');
  panel.id = 'meowFM-font-panel';

  panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 999;
        width: 480px;
        max-width: 90dvw;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 24px;
        color: snow;
        background: rgba(0,0,0,0.5);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5), inset 0 0 1px black;
        box-sizing: border-box;
        backdrop-filter: blur(8px) invert(0.2);
    `;

  panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
            <span style="cursor: default;">字体注入</span>
            <span id="meowFM-close-icon" style="cursor: pointer; color: #9ca3af; font-size: 20px;"><i class="fa-solid fa-xmark"></i></span>
        </div>
        <hr style="height: 1px; border: none; margin: 0 -8px; background: linear-gradient(to right, transparent 20%, snow, transparent 80%);">

        <div>
        <span style="font-size: 12px;">支持纯链接、&lt;link&gt; 标签 或 @import 规则</span>
        <textarea id="meowFM-link-input" placeholder="例:&#10;https://fonts.googleapis.com/css2?family=Roboto&#10;@import url('https://fonts.googleapis.com/css2?family=Oswald');"
                  style="width: 100%; height: 180px; padding:8px; background: rgba(0,0,0,0.5); box-shadow: inset 0 0 2px black; border:none; border-radius: 4px; font-size: 14px; outline: none; resize: none; color: snow; white-space: pre;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px">
            <button id="meowFM-apply-btn" style="width: 100%; padding: 8px; background-color: #2563eb; color: snow; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background-color 0.2s;">解析并应用</button>
        </div>
    `;

  parentDoc.body.appendChild(panel);

  const closeIcon = parentDoc.getElementById('meowFM-close-icon');
  closeIcon.onmouseover = () => closeIcon.style.color = 'white';
  closeIcon.onmouseout = () => closeIcon.style.color = '#9ca3af';
  closeIcon.onclick = () => panel.style.display = 'none';

  const applyBtn = parentDoc.getElementById('meowFM-apply-btn');
  applyBtn.onmouseover = () => applyBtn.style.backgroundColor = '#3b82f6';
  applyBtn.onmouseout = () => applyBtn.style.backgroundColor = '#2563eb';

  applyBtn.onclick = async () => {
    const rawInput = parentDoc.getElementById('meowFM-link-input').value.trim();
    if (!rawInput) return;

    const originalText = applyBtn.innerText;
    applyBtn.innerText = '正在抓取并注入...';
    applyBtn.style.backgroundColor = '#1d4ed8';
    applyBtn.style.pointerEvents = 'none';

    await executeInjection(rawInput);

    applyBtn.innerText = originalText;
    applyBtn.style.backgroundColor = '#2563eb';
    applyBtn.style.pointerEvents = 'auto';
  };
}

async function executeInjection(rawInput) {
  const oldLinks = parentDoc.querySelectorAll('.meowFM-FontLink');
  oldLinks.forEach(el => el.remove());
  const oldStyles = parentDoc.querySelectorAll('.meowFM-FontStyle');
  oldStyles.forEach(el => el.remove());

  const metas = parentDoc.head.querySelectorAll('meta');
  const insertBeforeTarget = metas.length > 0 ? metas[metas.length - 1].nextSibling : parentDoc.head.firstChild;

  // 1. 兼容纯 URL、<link href="..."> 和 @import url('...')
  const lines = rawInput.split('\n').map(line => line.trim()).filter(Boolean);
  const urls = lines.map(line => {
    let extractedUrl = line;

    // 匹配 @import url('...') 或 @import "..."
    const importMatch = line.match(/@import\s+(?:url\()?['"]?(.*?)['"]?\)?/);
    // 匹配 <link href="...">
    const hrefMatch = line.match(/href=["'](.*?)["']/);

    if (importMatch) {
      extractedUrl = importMatch[1];
    } else if (hrefMatch) {
      extractedUrl = hrefMatch[1];
    }

    // 补全协议
    if (extractedUrl.startsWith('//')) {
      extractedUrl = 'https:' + extractedUrl;
    } else if (!/^https?:\/\//i.test(extractedUrl)) {
      extractedUrl = 'https://' + extractedUrl;
    }

    return extractedUrl;
  });

  const hasGoogleFonts = urls.some(url => url.includes('fonts.googleapis.com'));

  // 2. Google Fonts 专属 Preconnect
  if (hasGoogleFonts) {
    const preconnect1 = parentDoc.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    preconnect1.className = 'meowFM-FontLink';

    const preconnect2 = parentDoc.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    preconnect2.className = 'meowFM-FontLink';

    parentDoc.head.insertBefore(preconnect1, insertBeforeTarget);
    parentDoc.head.insertBefore(preconnect2, insertBeforeTarget);
  }

  const fontNames = new Set();
  let fetchErrorCount = 0;

  // 3. 并发拉取 CSS 并解析
  const fetchPromises = urls.map(async (url) => {
    const newLink = parentDoc.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = url;
    newLink.className = 'meowFM-FontLink';
    parentDoc.head.insertBefore(newLink, insertBeforeTarget);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cssText = await response.text();

      const regex = /@font-face\s*\{[^}]*?font-family:\s*['"]?([^'";}]+)['"]?/gi;
      let match;
      while ((match = regex.exec(cssText)) !== null) {
        fontNames.add(match[1].trim());
      }
    } catch (error) {
      console.warn(`[meowFM] 字体解析失败 (${url})`, error);
      fetchErrorCount++;
      if (typeof toastr !== 'undefined') {
        toastr.error(`无法抓取或解析:\n${url}\n可能是跨域或无效链接`, '字体加载失败');
      }
    }
  });

  await Promise.all(fetchPromises);

  // 4. 生成最终字体栈并注入
  const fontsArray = Array.from(fontNames).map(font => `"${font}"`);
  fontsArray.push('sans-serif');
  const finalFontFamily = fontsArray.join(', ');

  const newStyle = parentDoc.createElement('style');
  newStyle.className = 'meowFM-FontStyle';
  newStyle.textContent = `:root {--mainFontFamily: ${finalFontFamily};}`;

  const customStyleEle = parentDoc.getElementById('custom-style');
  if (customStyleEle && customStyleEle.parentNode) {
    customStyleEle.parentNode.insertBefore(newStyle, customStyleEle);
  } else {
    parentDoc.head.appendChild(newStyle);
  }

  // 综合反馈
  if (typeof toastr !== 'undefined') {
    if (fontNames.size > 0) {
      toastr.success(`已应用字体: ${finalFontFamily}`, '注入成功');
    } else if (fetchErrorCount === 0 && urls.length > 0) {
      toastr.warning('链接访问成功，但未解析出有效字体，已退回 sans-serif。', '无有效字体');
    } else if (urls.length === 0) { }
  }
}

createToggleButton();