// --- КОНФІГУРАЦІЯ ---
// Порогові значення для виявлення аномалій
const THRESHOLD_NOISE = 85; 
const THRESHOLD_VIBRO = 5.0;

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

// Графік вібрації
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
const ws = new WebSocket("ws://localhost:8000/ws"); // Адреса Python-сервера

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
    document.getElementById('vibroValue').innerText = data.vibration.toFixed(2);

    let isAnomaly = false;

    // 2. Інтелектуальний аналіз: Перевірка шуму
    if (data.noise > THRESHOLD_NOISE) {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger status-badge">Перевищення норми!</span>';
        logAnomaly(currentTime, 'Критичний рівень шуму', data.noise + ' дБ', 'danger');
        isAnomaly = true;
    } else {
        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // 3. Інтелектуальний аналіз: Перевірка вібрації
    if (data.vibration > THRESHOLD_VIBRO) {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-danger status-badge">Аномальна вібрація!</span>';
        logAnomaly(currentTime, 'Пікова вібрація', data.vibration + ' m/s²', 'danger');
        isAnomaly = true;
    } else {
        document.getElementById('vibroStatus').innerHTML = '<span class="badge bg-success status-badge">В нормі</span>';
    }

    // 4. Оновлення загального стану системи
    const sysState = document.getElementById('systemState');
    const sysIcon = document.getElementById('systemIcon');
    if (isAnomaly) {
        sysState.innerText = "Виявлено аномалію!";
        sysState.className = "mb-0 text-danger fw-bold";
        sysIcon.className = "fa-solid fa-triangle-exclamation stat-icon text-danger";
    } else {
        sysState.innerText = "Стабільний стан";
        sysState.className = "mb-0 text-success fw-bold";
        sysIcon.className = "fa-solid fa-shield-check stat-icon text-success";
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
    chart.update();
}

function logAnomaly(time, eventText, value, level) {
    const tableBody = document.getElementById('logBody');
    const badgeClass = level === 'danger' ? 'bg-danger' : 'bg-warning';
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
