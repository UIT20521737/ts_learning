// Đọc nội dung file script.js
const scriptContent = fetch('./dist/script.js')
    .then((response) => response.text())
    .catch((err) => {
        console.error('Lỗi khi đọc file script.js:', err);
        return '// Không thể đọc file script.js';
    });

// Hàm hiển thị code lên HTML
function displayCode(code) {
    const output = document.getElementById('code-output');
    if (output) {
        output.innerHTML = `<pre><code class="language-typescript">${escapeHtml(
            code,
        )}</code></pre>`;
        Prism.highlightAll();
    }
}

// Thoát các ký tự HTML để hiển thị an toàn
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Chạy khi trang load
document.addEventListener('DOMContentLoaded', () => {
    scriptContent.then((code) => displayCode(code));
});
