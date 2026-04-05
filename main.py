from fastapi import FastAPI, WebSocket

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

import uvicorn

import json



app = FastAPI()



# Дозволяємо підключення до нашого API з будь-яких джерел (CORS)

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)



# Описуємо структуру даних (ДОДАНО ПОЛЕ status)

class SensorData(BaseModel):

    noise: float

    vibration: float

    status: str



# Список для зберігання всіх відкритих веб-сторінок (клієнтів)

active_connections = []



# Головна сторінка (потрібна, щоб швидко перевірити, чи живий сервер на Render)

@app.get("/")

async def root():

    return {"message": "VibroGuard Server is running perfectly!"}



# WebSocket-ендпоінт для зв'язку з веб-сайтом у реальному часі

@app.websocket("/ws")

async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    active_connections.append(websocket)

    try:

        while True:

            # Тримаємо з'єднання відкритим

            await websocket.receive_text()

    except:

        # Якщо сторінку закрили — видаляємо клієнта зі списку

        if websocket in active_connections:

            active_connections.remove(websocket)



# HTTP-ендпоінт для прийому даних від мікроконтролера (ESP32)

@app.post("/api/sensor-data")

async def receive_data(data: SensorData):

    # Пакуємо отримані дані у JSON (ДОДАНО status)

    message = json.dumps({

        "noise": data.noise, 

        "vibration": data.vibration,

        "status": data.status

    })

    

    # Миттєво розсилаємо ці дані на всі відкриті дашборди

    for connection in active_connections:

        try:

            await connection.send_text(message)

        except:

            pass

            

    return {"status": "success", "message": "Data broadcasted"}



if __name__ == "__main__":

    # Запуск сервера на локальному IP, порт 8000

    uvicorn.run(app, host="0.0.0.0", port=8000)
