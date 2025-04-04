// Lấy danh sách file từ API
const getFilesData = async () => {
    try {
        const response = await fetch('/api/files');
        if (!response.ok) {
            throw new Error(
                `Không thể lấy danh sách file: ${response.statusText}`,
            );
        }
        return await response.json();
    } catch (err) {
        console.error('Lỗi khi lấy danh sách file:', err);
        return [];
    }
};

// Hàm để ghi đè console.log và thu thập output cho từng file
const getLogs = () => {
    const consoleLogs = [];
    const originalConsoleLog = console.log;

    console.log = (...args) => {
        const message = args.join(' '); // Gộp các tham số thành một chuỗi
        originalConsoleLog.apply(console, args); // In ra terminal/DevTools
        consoleLogs.push(message); // Lưu thông điệp
    };

    return () => {
        console.log = originalConsoleLog; // Khôi phục console.log gốc
        return consoleLogs; // Trả về output của file
    };
};

// Hiển thị nội dung file và output lên HTML
function displayFileContent(fileName, code, logs, container) {
    const h2 = Object.assign(document.createElement('h2'), {
        className: 'title',
    });
    h2.innerHTML = `Nội dung file: ${fileName}`;
    container.appendChild(h2);

    const codeOutput = document.createElement('div');
    codeOutput.innerHTML = `<pre><code class="language-typescript">${escapeHtml(
        code,
    )}</code></pre>`;
    container.appendChild(codeOutput);

    const logOutput = document.createElement('div');
    logOutput.className = 'log-output';
    logOutput.innerHTML = `<h3>Output của ${fileName}:</h3><pre>${
        logs.length > 0 ? logs.join('\n') : 'Không có output'
    }</pre>`;
    container.appendChild(logOutput);

    Prism.highlightAll();
}

// Thoát các ký tự HTML để hiển thị an toàn
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;') // Thoát ký tự &
        .replace(/</g, '&lt;') // Thoát ký tự <
        .replace(/>/g, '&gt;') // Thoát ký tự >
        .replace(/"/g, '&quot;') // Thoát ký tự "
        .replace(/'/g, '&apos;'); // Thoát ký tự '
}

// Chạy khi trang load
document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('.root');
    if (!root) {
        console.error('Không tìm thấy phần tử có class "root"');
        return;
    }

    const files = await getFilesData();
    if (files.length === 0) {
        console.error('Không có file nào để hiển thị.');
        return;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i].name;
        const code = files[i].code;
        const logs = files[i].logs;
        displayFileContent(file, code, logs, root); // Hiển thị nội dung và output
    }
});
