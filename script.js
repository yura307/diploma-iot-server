// --- КОНФІГУРАЦІЯ ---
const THRESHOLD_NOISE = 75;      
const THRESHOLD_VIBRO_WARN = 2.8; 
const THRESHOLD_VIBRO_CRIT = 7.1; 
const MAX_LOG_ROWS = 10; 

// Змінна для запобігання спаму в журналі
let lastLogTime = 0; 
const LOG_COOLDOWN = 2000; 

// Налаштування для «нормального» вигляду графіків
const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { 
        duration: 500, // Плавний перехід (півсекунди), щоб лінія не стрибала
        easing: 'linear' 
    }, 
    scales: { 
        x: { display: true }, 
        y: { beginAtZero: true } 
    },
    elements: {
        point: { radius: 2 } // Маленькі точки, щоб графік був акуратним
    }
};

// --- ІНІЦІАЛІЗАЦІЯ ГРАФІКІВ ---
const noiseChart = new Chart(document.getElementById('noiseChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Шум (дБ)', borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', data: [], fill: true, tension: 0.4 }] },
    options: commonOptions
});

const vibroChart = new Chart(document.getElementById('vibroChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Вібрація (mm/s)', borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.1)', data: [], fill: true, tension: 0.4 }] },
    options: commonOptions
});

// --- ПІДКЛЮЧЕННЯ ЧЕРЕЗ WEBSOCKET ---
const ws = new WebSocket("wss://diploma-iot-server.onrender.com/ws");

ws.onopen = () => {
    console.log("WebSocket Connected ✅");
    document.getElementById('connectionStatus').classList.replace('text-danger', 'text-success');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const currentTime = new Date().toLocaleTimeString();

    // Перетворюємо дані з сервера
    const noise = parseFloat(data.noise);
    const vibration = parseFloat(data.vibration);

    // Оновлюємо цифри на плашках
    document.getElementById('noiseValue').innerText = noise.toFixed(0);
    document.getElementById('vibroValue').innerText = vibration.toFixed(1); // Один знак після коми для mm/s

    let isAnomaly = false;
    let anomalyMessage = "";
    let anomalyLevel = "";

    // 1. Логіка статусів для ШУМУ
    const noiseStatusEl = document.getElementById('noiseStatus');
    if (noise > THRESHOLD_NOISE) {
        noiseStatusEl.innerHTML = '<span class="badge bg-danger">ШУМНО!</span>';
        anomalyMessage = "Перевищення шуму";
        anomalyLevel = "danger";
        isAnomaly = true;
    } else {
        noiseStatusEl.innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // 2. Логіка статусів для ВІБРАЦІЇ
    const vibroStatusEl = document.getElementById('vibroStatus');
    if (vibration > THRESHOLD_VIBRO_CRIT) {
        vibroStatusEl.innerHTML = '<span class="badge bg-danger">КРИТИЧНО!</span>';
        anomalyMessage = "АВАРІЙНА ВІБРАЦІЯ";
        anomalyLevel = "danger";
        isAnomaly = true;
    } else if (vibration > THRESHOLD_VIBRO_WARN) {
        vibroStatusEl.innerHTML = '<span class="badge bg-warning text-dark">УВАГА</span>';
        if (!isAnomaly) { // Пріоритет небезпеці
            anomalyMessage = "Підвищена вібрація";
            anomalyLevel = "warning";
            isAnomaly = true;
        }
    } else {
        vibroStatusEl.innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // 3. Запис у журнал аномалій
    const now = Date.now();
    if (isAnomaly && (now - lastLogTime > LOG_COOLDOWN)) {
        logAnomaly(currentTime, anomalyMessage, (anomalyMessage.includes("шум") ? noise : vibration.toFixed(1)), anomalyLevel);
        lastLogTime = now;
    }

    // 4. Стан всієї системи
    const sysState = document.getElementById('systemState');
    if (isAnomaly) {
        sysState.innerText = "ВИЯВЛЕНО АНОМАЛІЮ";
        sysState.className = "text-danger fw-bold";
    } else {
        sysState.innerText = "Система стабільна";
        sysState.className = "text-success fw-bold";
    }

    // 5. Оновлення графіків
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
    
    // Показуємо останні 20 точок
    if (chart.data.labels.length > 20) { 
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update('none'); // Оновлюємо без повної перемальовки для швидкості
}
