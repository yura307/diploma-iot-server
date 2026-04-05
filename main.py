from fastapi import FastAPI, WebSocket, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
from typing import Optional

app = FastAPI()

# ================= НАЛАШТУВАННЯ БЕЗПЕКИ =================
# Секретний ключ для захисту сервера від сторонніх даних
SECRET_API_KEY = "SecretDiplomaKey2026"

# Дозволяємо підключення до нашого API з будь-яких джерел (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Описуємо структуру даних від датчиків
class SensorData(BaseModel):
    noise: float
    vibration: float
    status: str

# Список для зберігання всіх відкритих веб-сторінок (дашбордів)
active_connections = []

# Головна сторінка для перевірки статусу сервера
@app.get("/")
async def root():
    return {"message": "VibroGuard Server is SECURED and running perfectly!"}

# WebSocket-ендпоінт для зв'язку з веб-сайтом у реальному часі
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text() # Тримаємо з'єднання відкритим
    except:
        if websocket in active_connections:
            active_connections.remove(websocket)

# HTTP-ендпоінт для прийому даних від ESP32
@app.post("/api/sensor-data")
async def receive_data(data: SensorData, authorization: Optional[str] = Header(None)):
    
    # ПЕРЕВІРКА КЛЮЧА БЕЗПЕКИ
    expected_token = f"Bearer {SECRET_API_KEY}"
    if authorization != expected_token:
        # Якщо ключа немає або він неправильний — відхиляємо запит
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")

    # Формуємо JSON для відправки на сайт
    message = json.dumps({
        "noise": data.noise, 
        "vibration": data.vibration,
        "status": data.status
    })
    
    # Миттєво розсилаємо дані на всі відкриті вкладки браузера
    for connection in active_connections:
        try:
            await connection.send_text(message)
        except:
            pass
            
    return {"status": "success", "message": "Data broadcasted securely"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
