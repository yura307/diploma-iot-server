from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os

app = FastAPI()

# Дозволяємо всі підключення (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. ОНОВЛЕНА МОДЕЛЬ ДАНИХ (тепер включає статус)
class SensorData(BaseModel):
    noise: float
    vibration: float
    status: str  # Додаємо це поле, щоб отримувати статус від ESP32

# Список активних WebSocket-клієнтів (веб-сторінок)
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Якщо з'єднання "бите" — видаляємо його пізніше
                pass

manager = ConnectionManager()

# WebSocket-ендпоінт
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Просто підтримуємо зв'язок
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

# HTTP-ендпоінт для ESP32
@app.post("/api/sensor-data")
async def receive_data(data: SensorData):
    # 2. ФОРМУЄМО ПОВНИЙ ПАКЕТ ДАНИХ ДЛЯ САЙТУ
    payload = {
        "noise": data.noise,
        "vibration": data.vibration,
        "status": data.status  # Передаємо статус далі на сайт
    }
    
    message = json.dumps(payload)
    
    # Виводимо в консоль сервера для контролю
    print(f"Received from ESP32: {payload}")
    
    # Розсилаємо на всі відкриті вкладки браузера
    await manager.broadcast(message)
    
    return {"status": "success", "message": "Data broadcasted"}

# Головна сторінка для перевірки, чи живий сервер
@app.get("/")
async def root():
    return {"message": "VibroGuard Server is running"}

if __name__ == "__main__":
    # На Render порт береться зі змінних оточення (PORT)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
