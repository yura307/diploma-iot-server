const THRESHOLD_NOISE = 75;      

const THRESHOLD_VIBRO_WARN = 2.8; 

const THRESHOLD_VIBRO_CRIT = 7.1; 

const MAX_LOG_ROWS = 10; 



// Змінна для запобігання спаму (записуємо аномалію не частіше ніж раз на 2 секунди)

let lastLogTime = 0; 

const LOG_COOLDOWN = 2000; 



const commonOptions = { 

    responsive: true, 

    maintainAspectRatio: false, 

    animation: { duration: 0 }, 

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



// --- ПІДКЛЮЧЕННЯ ---

const ws = new WebSocket("wss://diploma-iot-server.onrender.com/ws");



ws.onopen = () => {

    console.log("WebSocket Connected ✅");

    document.getElementById('connectionStatus').classList.replace('text-danger', 'text-success');

};



ws.onmessage = function(event) {

    const data = JSON.parse(event.data);

    const currentTime = new Date().toLocaleTimeString();



    // ПРИМУСОВО ПЕРЕТВОРЮЄМО В ЧИСЛА

    const noise = parseFloat(data.noise);

    const vibration = parseFloat(data.vibration);



    document.getElementById('noiseValue').innerText = noise.toFixed(0);

    document.getElementById('vibroValue').innerText = vibration.toFixed(2);



    let isAnomaly = false;

    let anomalyMessage = "";

    let anomalyLevel = "";



    // 1. Аналіз шуму

    if (noise > THRESHOLD_NOISE) {

        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-danger">ШУМНО!</span>';

        anomalyMessage = "Перевищення шуму";

        anomalyLevel = "danger";

        isAnomaly = true;

    } else {

        document.getElementById('noiseStatus').innerHTML = '<span class="badge bg-success">Норма</span>';

    }



    // 2. Аналіз вібрації

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



    // 3. Запис у журнал (з перевіркою часу)

    const now = Date.now();

    if (isAnomaly && (now - lastLogTime > LOG_COOLDOWN)) {

        console.log("⚠️ Аномалія зафіксована:", anomalyMessage);

        logAnomaly(currentTime, anomalyMessage, (isAnomaly ? (anomalyMessage.includes("шум") ? noise : vibration.toFixed(2)) : ""), anomalyLevel);

        lastLogTime = now;

    }



    // 4. Стан системи

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
