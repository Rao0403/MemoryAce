# Brain Games Lab

A full-stack brain-game platform inspired by Human Benchmark, with a more cinematic UI and persistent player performance tracking.

## Stack

- Frontend: Next.js (App Router, TypeScript)
- Backend: FastAPI (Python)
- Database: MySQL

## Included Games (Phase 1)

1. Number Memory
- Starts at 1 digit
- Each successful round increments difficulty by 1 digit
- On failure, score is saved

2. Sequence Memory
- 3x3 grid glow-chain memory game
- Sequence length grows by 1 per round
- On failure, score is saved

## Data Stored

Each run stores a score attempt in MySQL.

Player stats are computed from attempts:
- High score
- Average score
- Attempt count

## Project Structure

- `frontend/` Next.js app
- `backend/` FastAPI API and SQLAlchemy models

## Run Locally

### 1) Configure and Run Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set your local MySQL credentials in `backend/.env`:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_DRIVER` (default: `mysql+pymysql`)

API base URL: `http://localhost:8000`

### 2) Run Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend URL: `http://localhost:3000`

## Current API Endpoints

- `GET /api/health`
- `POST /api/scores`
- `GET /api/scores/{game}/{player_name}`
- `GET /api/leaderboard/{game}`
- `GET /api/scores/recent`
- `GET /api/dashboard/{player_name}`

Allowed game keys:
- `number_memory`
- `sequence_memory`

## Next Additions

The architecture is ready to keep adding new games while reusing:
- score persistence
- stats components
- leaderboard endpoint
