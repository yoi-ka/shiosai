/**
 * Shiosai Theater - 动态资源加载器
 * 自动加载所有 CSS 和 JS 文件
 */

const currentScriptUrl = document.currentScript ? document.currentScript.src : window.location.href;

// 截取前面的基准路径 (去掉 /js/loader.js)
// 变成：https://xxx.github.io/repo
const baseUrl = currentScriptUrl.substring(0, currentScriptUrl.lastIndexOf('/js/loader.js'));

// 使用动态拼凑的绝对路径
const rscManifest = {
    styles: [
        `${baseUrl}/css/behindthescenes.css`,
        `${baseUrl}/css/highcourt.css`
    ],
    scripts: [
        `${baseUrl}/js/global.js`,
        `${baseUrl}/js/behindthescenes.js`,
        `${baseUrl}/js/highcourt.js`
    ]
};

/**
 * 加载所有样式表
 */
function loadStyles() {
    rscManifest.styles.forEach(stylesheet => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        link.onerror = () => console.error(`Failed to load stylesheet: ${stylesheet}`);
        document.head.appendChild(link);
    });
}

/**
 * 动态加载所有脚本（按顺序执行）
 */
function loadScripts() {
    if (rscManifest.scripts.length > 0) {
        // 直接从第 0 个索引开始链式加载
        loadRemainingScripts(0);
    }
}

/**
 * 递归加载脚本以保证顺序
 */
function loadRemainingScripts(index) {
    // 当所有脚本都加载完毕时，触发渲染！
    if (index >= rscManifest.scripts.length) {
        if (typeof window.renderShiosai === 'function') {
            window.renderShiosai();
        }
        return;
    }

    const scriptPath = rscManifest.scripts[index];
    const script = document.createElement('script');
    script.src = scriptPath;
    script.async = false;
    script.onerror = () => console.error(`Failed to load script: ${scriptPath}`);

    script.onload = () => {
        loadRemainingScripts(index + 1);
    };

    document.body.appendChild(script);
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadStyles();
        loadScripts();
    });
} else {
    // 如果脚本在 DOM 已加载后执行
    loadStyles();
    loadScripts();
}
