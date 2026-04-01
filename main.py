from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import logging

# Налаштування логування (щоб бачити помилки в консолі Render)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VibroGuard Backend")

# Дозволяємо підключення з будь-яких адрес
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модель даних від ESP32
class SensorData(BaseModel):
    noise: float
    vibration: float
    status: str

# Менеджер WebSocket з'єднань
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Клієнт підключився. Всього: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Клієнт відключився. Залишилось: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        # Робимо копію списку, щоб уникнути помилок при видаленні під час ітерації
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Помилка відправки: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

# --- ЕНДПОІНТИ ---

# Головна сторінка для перевірки (щоб розбудити сервер)
@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "VibroGuard Server is running",
        "clients_connected": len(manager.active_connections)
    }

# Канал для сайту (WebSocket)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Чекаємо на будь-яке повідомлення (keep-alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

# Прийом даних від ESP32
@app.post("/api/sensor-data")
async def receive_data(data: SensorData):
    # Формуємо JSON для сайту
    payload = {
        "noise": data.noise,
        "vibration": data.vibration,
        "status": data.status
    }
    
    # Конвертуємо в рядок і розсилаємо всім клієнтам
    message = json.dumps(payload)
    await manager.broadcast(message)
    
    # Виводимо в лог (корисно для відладки на Render)
    # logger.info(f"Дані відправлено на сайт: {payload}")
    
    return {"status": "success"}

if __name__ == "__main__":
    # Локальний запуск (для тестів)
    uvicorn.run(app, host="0.0.0.0", port=8000)
