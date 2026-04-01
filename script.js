// --- КОНФІГУРАЦІЯ (Налаштовано під промислові норми) ---
const THRESHOLD_NOISE = 75;      // Починаємо логувати шум від 75 дБ
const THRESHOLD_VIBRO_WARN = 2.8; // Жовта зона (Увага)
const THRESHOLD_VIBRO_CRIT = 7.1; // Червона зона (Небезпека)

const MAX_LOG_ROWS = 10; // Скільки останніх аномалій тримати в списку

// Спільні налаштування графіків
const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { duration: 0 }, 
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
            label: 'Рівень шуму (дБ)', 
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
    console.log("Connected to server");
    document.getElementById('connectionStatus').innerText = "Підключено";
    document.getElementById('connectionStatus').className = "text-success fw-bold";
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const currentTime = new Date().toLocaleTimeString();

    // Оновлення числових показників
    document.getElementById('noiseValue').innerText = Math.round(data.noise);
    document.getElementById('vibroValue').innerText = Number(data.vibration).toFixed(2);

    let isAnomaly = false;

    // 1. Аналіз шуму
    if (data.noise > THRESHOLD_NOISE) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger">ШУМНО!</span>';
        logAnomaly(currentTime, 'Перевищення шуму', data.noise + ' дБ', 'danger');
        isAnomaly = true;
    } else {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // 2. Аналіз вібрації (Жовта та Червона зони)
    if (data.vibration > THRESHOLD_VIBRO_CRIT) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-danger">КРИТИЧНО!</span>';
        logAnomaly(currentTime, 'АВАРІЙНА ВІБРАЦІЯ', data.vibration.toFixed(2) + ' mm/s', 'danger');
        isAnomaly = true;
    } else if (data.vibration > THRESHOLD_VIBRO_WARN) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-warning text-dark">УВАГА</span>';
        logAnomaly(currentTime, 'Підвищена вібрація', data.vibration.toFixed(2) + ' mm/s', 'warning');
        isAnomaly = true;
    } else {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-success">Норма</span>';
    }

    // 3. Загальний стан
    const sysState = document.getElementById('systemState');
    if (isAnomaly) {
        sysState.innerText = "УВАГА: ВИЯВЛЕНО АНОМАЛІЮ";
        sysState.className = "text-danger fw-bold";
    } else {
        sysState.innerText = "Система працює стабільно";
        sysState.className = "text-success fw-bold";
    }

    updateChart(noiseChart, currentTime, data.noise);
    updateChart(vibroChart, currentTime, data.vibration);
};

function updateChart(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(data);
    if (chart.data.labels.length > 20) { 
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

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

    // Видаляємо старі записи, щоб журнал не безкінечно ріс
    if (tableBody.rows.length > MAX_LOG_ROWS) {
        tableBody.deleteRow(MAX_LOG_ROWS);
    }
}
