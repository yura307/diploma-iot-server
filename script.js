// --- КОНФІГУРАЦІЯ (Три рівні) ---
// Пороги для шуму (дБ)
const THRESHOLD_NOISE_WARN = 65; 
const THRESHOLD_NOISE_CRIT = 85; 

// Пороги для вібрації (m/s²)
const THRESHOLD_VIBRO_WARN = 1.5; 
const THRESHOLD_VIBRO_CRIT = 3.5; 

// Змінні для захисту від спаму в журналі
let lastLogTime = 0;
const LOG_COOLDOWN = 3000; // Пауза 3 секунди між записами

// Спільні налаштування графіків
const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { duration: 400, easing: 'linear' }, 
    scales: { 
        x: { display: true }, 
        y: { beginAtZero: true } 
    } 
};

// --- ІНІЦІАЛІЗАЦІЯ ГРАФІКІВ ---
const ctxNoise = document.getElementById('noiseChart').getContext('2d');
const noiseChart = new Chart(ctxNoise, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [{ 
            label: 'Шум (дБ)', 
            borderColor: '#0d6efd', 
            backgroundColor: 'rgba(13, 110, 253, 0.1)', 
            data: [], 
            fill: true, 
            tension: 0.4 
        }] 
    },
    options: commonOptions
});

const ctxVibro = document.getElementById('vibroChart').getContext('2d');
const vibroChart = new Chart(ctxVibro, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [{ 
            label: 'Вібрація (m/s²)', 
            borderColor: '#ffc107', 
            backgroundColor: 'rgba(255, 193, 7, 0.1)', 
            data: [], 
            fill: true, 
            tension: 0.4 
        }] 
    },
    options: commonOptions
});

// --- ПІДКЛЮЧЕННЯ WEBSOCKET ---
const ws = new WebSocket("wss://diploma-iot-server.onrender.com/ws");

ws.onopen = () => {
    document.getElementById('connectionStatus').classList.replace('text-danger', 'text-success');
};

ws.onclose = () => {
    document.getElementById('connectionStatus').classList.replace('text-success', 'text-danger');
};

// --- ОБРОБКА ВХІДНИХ ДАНИХ ТА АНАЛІЗ ---
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const currentTime = new Date().toLocaleTimeString();

    // 1. Оновлення числових показників
    document.getElementById('noiseValue').innerText = data.noise.toFixed(1);
    document.getElementById('vibroValue').innerText = data.vibration.toFixed(1);

    let highestLevel = 'success'; // 'success', 'warning', 'danger'
    let logTriggered = false;
    let anomalyMsg = "";
    let anomalyVal = "";
    let anomalyLvl = "";

    // 2. Аналіз шуму (3 рівні)
    if (data.noise > THRESHOLD_NOISE_CRIT) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger status-badge">КРИТИЧНО!</span>';
        highestLevel = 'danger';
        logTriggered = true;
        anomalyMsg = 'Критичний шум'; 
        anomalyVal = data.noise.toFixed(1) + ' дБ'; 
        anomalyLvl = 'danger';
    } else if (data.noise > THRESHOLD_NOISE_WARN) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-warning text-dark status-badge">УВАГА</span>';
        if (highestLevel !== 'danger') highestLevel = 'warning';
        if (!logTriggered) {
            logTriggered = true;
            anomalyMsg = 'Підвищений шум'; 
            anomalyVal = data.noise.toFixed(1) + ' дБ'; 
            anomalyLvl = 'warning';
        }
    } else {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // 3. Аналіз вібрації (3 рівні)
    if (data.vibration > THRESHOLD_VIBRO_CRIT) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-danger status-badge">КРИТИЧНО!</span>';
        highestLevel = 'danger';
        logTriggered = true;
        anomalyMsg = 'Критична вібрація'; 
        anomalyVal = data.vibration.toFixed(1) + ' m/s²'; 
        anomalyLvl = 'danger';
    } else if (data.vibration > THRESHOLD_VIBRO_WARN) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-warning text-dark status-badge">УВАГА</span>';
        if (highestLevel !== 'danger') highestLevel = 'warning';
        // Записуємо жовтий лог тільки якщо немає червоного
        if (!logTriggered || anomalyLvl !== 'danger') {
            logTriggered = true;
            anomalyMsg = 'Підвищена вібрація'; 
            anomalyVal = data.vibration.toFixed(1) + ' m/s²'; 
            anomalyLvl = 'warning';
        }
    } else {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // 4. Оновлення загального стану системи
    const sysState = document.getElementById('systemState');
    const sysIcon = document.getElementById('systemIcon');
    
    if (highestLevel === 'danger') {
        sysState.innerText = "ВИЯВЛЕНО АНОМАЛІЮ!";
        sysState.className = "mb-0 text-danger fw-bold";
        if(sysIcon) sysIcon.className = "fa-solid fa-triangle-exclamation stat-icon text-danger";
    } else if (highestLevel === 'warning') {
        sysState.innerText = "Увага: Відхилення";
        sysState.className = "mb-0 text-warning fw-bold";
        if(sysIcon) sysIcon.className = "fa-solid fa-circle-exclamation stat-icon text-warning";
    } else {
        sysState.innerText = "Система стабільна";
        sysState.className = "mb-0 text-success fw-bold";
        if(sysIcon) sysIcon.className = "fa-solid fa-shield-check stat-icon text-success";
    }

    // 5. Запис у журнал
    const now = Date.now();
    if (logTriggered && (now - lastLogTime > LOG_COOLDOWN)) {
        logAnomaly(currentTime, anomalyMsg, anomalyVal, anomalyLvl);
        lastLogTime = now;
    }

    updateChart(noiseChart, currentTime, data.noise);
    updateChart(vibroChart, currentTime, data.vibration);
};

// --- ДОПОМІЖНІ ФУНКЦІЇ ---
function updateChart(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(data);
    if (chart.data.labels.length > 25) { 
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update('none'); 
}

function logAnomaly(time, eventText, value, level) {
    const tableBody = document.getElementById('logBody');
    if (!tableBody) return;
    
    // Налаштовуємо кольори для журналу
    let badgeClass = 'bg-success';
    let badgeText = 'Норма';
    let textClass = 'text-success';

    if (level === 'danger') {
        badgeClass = 'bg-danger';
        badgeText = 'Критично';
        textClass = 'text-danger';
    } else if (level === 'warning') {
        badgeClass = 'bg-warning text-dark';
        badgeText = 'Увага';
        textClass = 'text-warning';
    }

    const row = `<tr>
                    <td>${time}</td>
                    <td class="fw-bold ${textClass}">${eventText}</td>
                    <td>${value}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                 </tr>`;
    
    tableBody.insertAdjacentHTML('afterbegin', row);
    
    if (tableBody.children.length > 50) {
        tableBody.lastElementChild.remove();
    }
}
