// --- КОНФІГУРАЦІЯ ---
// Порогові значення для виявлення аномалій
const THRESHOLD_NOISE = 85; 
const THRESHOLD_VIBRO = 5.0;

// Змінні для захисту від спаму в журналі
let lastLogTime = 0;
const LOG_COOLDOWN = 3000; // Пауза 3 секунди між записами в журнал

// Спільні налаштування графіків
const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { duration: 400, easing: 'linear' }, // Плавне малювання лінії
    scales: { 
        x: { display: true }, 
        y: { beginAtZero: true } 
    } 
};

// --- ІНІЦІАЛІЗАЦІЯ ГРАФІКІВ ---
// Графік шуму
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

// Графік вібрації (ВИПРАВЛЕНО НА mm/s)
const ctxVibro = document.getElementById('vibroChart').getContext('2d');
const vibroChart = new Chart(ctxVibro, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [{ 
            label: 'Вібрація (mm/s)', 
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

    // 1. Оновлення числових показників на екрані
    document.getElementById('noiseValue').innerText = data.noise.toFixed(1);
    document.getElementById('vibroValue').innerText = data.vibration.toFixed(1);

    let isAnomaly = false;
    let anomalyMsg = "";
    let anomalyVal = "";
    let anomalyLvl = "";

    // 2. Інтелектуальний аналіз: Перевірка шуму
    if (data.noise > THRESHOLD_NOISE) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger status-badge">Перевищення норми!</span>';
        isAnomaly = true;
        anomalyMsg = 'Критичний рівень шуму';
        anomalyVal = data.noise.toFixed(1) + ' дБ';
        anomalyLvl = 'danger';
    } else {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // 3. Інтелектуальний аналіз: Перевірка вібрації
    if (data.vibration > THRESHOLD_VIBRO) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-danger status-badge">Аномальна вібрація!</span>';
        isAnomaly = true;
        anomalyMsg = 'Пікова вібрація';
        anomalyVal = data.vibration.toFixed(1) + ' mm/s';
        anomalyLvl = 'danger';
    } else {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // Запис у журнал (тільки якщо є аномалія І пройшло достатньо часу)
    const now = Date.now();
    if (isAnomaly && (now - lastLogTime > LOG_COOLDOWN)) {
        logAnomaly(currentTime, anomalyMsg, anomalyVal, anomalyLvl);
        lastLogTime = now;
    }

    // 4. Оновлення загального стану системи
    const sysState = document.getElementById('systemState');
    const sysIcon = document.getElementById('systemIcon');
    
    if (isAnomaly) {
        sysState.innerText = "Виявлено аномалію!";
        sysState.className = "mb-0 text-danger fw-bold";
        if(sysIcon) sysIcon.className = "fa-solid fa-triangle-exclamation stat-icon text-danger";
    } else {
        sysState.innerText = "Стабільний стан";
        sysState.className = "mb-0 text-success fw-bold";
        if(sysIcon) sysIcon.className = "fa-solid fa-shield-check stat-icon text-success";
    }

    // 5. Відмальовування нових точок на графіку
    updateChart(noiseChart, currentTime, data.noise);
    updateChart(vibroChart, currentTime, data.vibration);
};

// --- ДОПОМІЖНІ ФУНКЦІЇ ---
function updateChart(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(data);
    // Зберігаємо лише останні 25 точок
    if (chart.data.labels.length > 25) { 
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update('none'); // 'none' для оптимізації без повного перемальовування кадру
}

function logAnomaly(time, eventText, value, level) {
    const tableBody = document.getElementById('logBody');
    if (!tableBody) return;
    
    const badgeClass = level === 'danger' ? 'bg-danger' : 'bg-warning text-dark';
    const row = `<tr>
                    <td>${time}</td>
                    <td class="fw-bold text-${level}">${eventText}</td>
                    <td>${value}</td>
                    <td><span class="badge ${badgeClass}">Критично</span></td>
                 </tr>`;
    
    tableBody.insertAdjacentHTML('afterbegin', row);
    
    // Обмежуємо журнал до 50 записів, щоб сторінка не зависала
    if (tableBody.children.length > 50) {
        tableBody.lastElementChild.remove();
    }
}
