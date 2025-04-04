const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');

const PORT = 3000;

// Đường dẫn đến thư mục dist/
const distDir = path.join(__dirname, 'dist');

// Lấy danh sách file .js trong dist/, trừ index.js và runAll.js
const getFiles = async () => {
    try {
        const files = (await fs.readdir(distDir))
            .filter(
                (file) =>
                    file.endsWith('.js') &&
                    file !== 'index.js' &&
                    file !== 'runAll.js',
            )
            .map((file) => ({ name: file }));
        return files;
    } catch (err) {
        console.error('Lỗi khi đọc thư mục dist/:', err);
        return [];
    }
};

// Đọc nội dung file
const getCode = async (url) => {
    try {
        const filePath = path.join(distDir, url);
        const scriptContent = await fs.readFile(filePath, 'utf-8');
        return scriptContent;
    } catch (err) {
        console.error(`Lỗi khi đọc file ${url}:`, err);
        return `// Không thể đọc file ${url}`;
    }
};

// Hàm để ghi đè console.log và thu thập output cho từng file
const getLogs = (fileName) => {
    const consoleLogs = [];
    const originalConsoleLog = console.log;

    console.log = (...args) => {
        const message = args.join(' ');
        originalConsoleLog(`[Captured from ${fileName}] ${message}`);
        consoleLogs.push(message);
    };

    return () => {
        console.log = originalConsoleLog;
        return consoleLogs;
    };
};

// Xử lý và lấy nội dung + output của tất cả file
const processFiles = async () => {
    const files = await getFiles();
    const results = [];

    for (const file of files) {
        const stopCapture = getLogs(file.name);
        const code = await getCode(file.name);
        let logs = [];
        try {
            eval(code);
        } catch (err) {
            console.error(`Lỗi khi chạy file ${file.name}:`, err);
        }
        logs = stopCapture();
        results.push({ name: file.name, code, logs });
    }

    return results;
};

// Chạy các file .js trong dist/ (trừ index.js) khi server khởi động
const runAllFiles = () => {
    fs.readdir(distDir, (err, files) => {
        if (err) {
            console.error('Lỗi khi đọc thư mục dist/:', err);
            return;
        }

        // Lọc các file .js và loại bỏ index.js
        const jsFiles = files.filter(
            (file) => file.endsWith('.js') && file !== 'index.js',
        );

        // Kiểm tra xem có file nào để chạy không
        if (jsFiles.length === 0) {
            console.log(
                'Không tìm thấy file .js nào trong dist/ (trừ index.js).',
            );
            return;
        }

        console.log('Danh sách file sẽ chạy:', jsFiles);

        // Chạy từng file
        jsFiles.forEach((file) => {
            try {
                const relativePath = path.relative(
                    __dirname,
                    path.join(distDir, file),
                );
                console.log(`Đang chạy file: ${file}`);

                // Ghi đè console.log để thu thập output
                const consoleLogs = [];
                const originalConsoleLog = console.log;
                console.log = (...args) => {
                    const message = args.join(' ');
                    consoleLogs.push(message);
                    originalConsoleLog(`[Output from ${file}] ${message}`);
                };

                // Require file
                require(`./${relativePath}`);

                // Khôi phục console.log
                console.log = originalConsoleLog;

                // Log nếu không có output
                if (consoleLogs.length === 0) {
                    console.log(`[Output from ${file}] Không có output`);
                }
            } catch (err) {
                console.error(`Lỗi khi chạy file ${file}:`, err);
            }
        });
    });
};

// Tạo server HTTP
const server = http.createServer(async (req, res) => {
    try {
        if (req.url === '/api/files') {
            const results = await processFiles();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(results));
            return;
        }

        let filePath;
        if (req.url === '/' || req.url === '/index.html') {
            filePath = path.join(__dirname, 'index.html');
            res.writeHead(200, { 'Content-Type': 'text/html' });
        } else if (req.url.startsWith('/dist/')) {
            filePath = path.join(__dirname, req.url);
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
        } else if (req.url.endsWith('.css')) {
            filePath = path.join(__dirname, req.url);
            res.writeHead(200, { 'Content-Type': 'text/css' });
        } else if (req.url === '/index.js') {
            filePath = path.join(__dirname, 'index.js');
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const content = await fs.readFile(filePath);
        res.end(content);
    } catch (err) {
        console.error(`Lỗi khi phục vụ file ${req.url}:`, err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
    }
});

// Tạo WebSocket server
const wss = new WebSocket.Server({ server });

// Theo dõi thư mục dist/ và file index.html để phát hiện thay đổi
const watcher = chokidar.watch([distDir, path.join(__dirname, 'index.html')], {
    ignored: /(index|runAll)\.js$/, // Bỏ qua index.js và runAll.js trong dist/
    persistent: true,
});

watcher.on('change', (filePath) => {
    const fileName = path.basename(filePath);
    console.log(`File thay đổi: ${fileName}`);
    // Gửi thông báo đến tất cả client qua WebSocket
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send('reload');
        }
    });
});

watcher.on('add', (filePath) => {
    const fileName = path.basename(filePath);
    if (
        fileName.endsWith('.js') &&
        fileName !== 'index.js' &&
        fileName !== 'runAll.js'
    ) {
        console.log(`File mới được tạo: ${fileName}`);
        // Gửi thông báo đến tất cả client qua WebSocket
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send('reload');
            }
        });
    }
});

// Chạy các file trong dist/ khi server khởi động
runAllFiles();

// Khởi động server
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
