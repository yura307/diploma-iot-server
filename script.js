// --- КОНФІГУРАЦІЯ ---
const THRESHOLD_NOISE = 75;      
const THRESHOLD_VIBRO_WARN = 2.8; 
const THRESHOLD_VIBRO_CRIT = 7.1; 
const MAX_LOG_ROWS = 10; 

let lastLogTime = 0; 
const LOG_COOLDOWN = 2000; 

// 1. АНІМАЦІЯ ГРАФІКІВ: Плавний перехід за 300 мс (синхронно з ESP32)
const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { 
        duration: 300, 
        easing: 'linear' 
    }, 
    scales: { x: { display: true }, y: { beginAtZero: true } } 
};

// --- ІНІЦІАЛІЗАЦІЯ ГРАФІКІВ ---
const noiseChart = new Chart(document.getElementById('noiseChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Шум (дБ)', borderColor: '#0d6efd', data: [], fill: true, tension: 0.4 }] },
    options: commonOptions
});

const vibroChart = new Chart(document.getElementById('vibroChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Вібрація (mm/s)', borderColor: '#ffc107', data: [], fill: true, tension: 0.4 }] },
    options: commonOptions
});

// --- ФУНКЦІЯ ПЛАВНОЇ ЗМІНИ ЧИСЕЛ ---
function animateValue(obj, start, end, duration, isFloat) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = start + progress * (end - start);
        
        obj.innerText = isFloat ? currentVal.toFixed(2) : currentVal.toFixed(0);
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// --- ПІДКЛЮЧЕННЯ ---
const ws = new WebSocket("wss://diploma-iot-server.onrender.com/ws");

ws.onopen = () => {
    console.log("WebSocket Connected ✅");
    document.getElementById('connectionStatus').classList.replace('text-danger', 'text-success');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const currentTime = new Date().toLocaleTimeString();

    const noise = parseFloat(data.noise);
    const vibration = parseFloat(data.vibration);

    // 2. АНІМАЦІЯ ЦИФР: Замість різкого перемикання, запускаємо плавний перебіг
    const noiseEl = document.getElementById('noiseValue');
    const vibroEl = document.getElementById('vibroValue');
    
    const currentNoise = parseFloat(noiseEl.innerText) || 0;
    const currentVibro = parseFloat(vibroEl.innerText) || 0;

    animateValue(noiseEl, currentNoise, noise, 300, false);
    animateValue(vibroEl, currentVibro, vibration, 300, true);

    let isAnomaly = false;
    let anomalyMessage = "";
    let anomalyLevel = "";

    // Аналіз шуму
    if (noise > THRESHOLD_NOISE) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger">ШУМНО!</span>';
        anomalyMessage = "Перевищення шуму";
        anomalyLevel = "danger";
        isAnomaly = true;
    } else {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // Аналіз вібрації
    if (vibration > THRESHOLD_VIBRO_CRIT) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-danger">КРИТИЧНО!</span>';
        anomalyMessage = "АВАРІЙНА ВІБРАЦІЯ";
        anomalyLevel = "danger";
        isAnomaly = true;
    } else if (vibration > THRESHOLD_VIBRO_WARN) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-warning text-dark">УВАГА</span>';
        anomalyMessage = "Підвищена вібрація";
        anomalyLevel = "warning";
        isAnomaly = true;
    } else {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // Запис у журнал
    const now = Date.now();
    if (isAnomaly && (now - lastLogTime > LOG_COOLDOWN)) {
        console.log("⚠️ Аномалія зафіксована:", anomalyMessage);
        logAnomaly(currentTime, anomalyMessage, (isAnomaly ? (anomalyMessage.includes("шум") ? noise : vibration.toFixed(2)) : ""), anomalyLevel);
        lastLogTime = now;
    }

    // Стан системи
    const sysState = document.getElementById('systemState');
    if (isAnomaly) {
        sysState.innerText = "ВИЯВЛЕНО АНОМАЛІЮ";
        sysState.className = "text-danger fw-bold";
    } else {
        sysState.innerText = "Система стабільна";
        sysState.className = "text-success fw-bold";
    }

    updateChart(noiseChart, currentTime, noise);
    updateChart(vibroChart, currentTime, vibration);
};

function logAnomaly(time, eventText, value, level) {
    const tableBody = document.getElementById('logBody');
    if (!tableBody) return;

    const badgeClass = level === 'danger' ? 'bg-danger' : 'bg-warning text-dark';
    const row = `<tr>
                    <td>${time}</td>
                    <td class="fw-bold">${eventText}</td>
                    <td>${value}</td>
                    <td><span class="badge ${badgeClass}">${level.toUpperCase()}</span></td>
                 </tr>`;
    
    tableBody.insertAdjacentHTML('afterbegin', row);
    if (tableBody.rows.length > MAX_LOG_ROWS) {
        tableBody.deleteRow(MAX_LOG_ROWS);
    }
}

function updateChart(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(data);
    if (chart.data.labels.length > 20) { 
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}
