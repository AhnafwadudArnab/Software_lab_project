# Software_lab_project
Missing diary full

Quick start
- Backend: install and run from `backend/`

```bash
cd backend
npm ci
cp .env.example .env    # fill values
npm run dev
```

- Frontend: install and run from `frontend/`

```bash
cd frontend
npm ci
cp .env.example .env   # set VITE_API_URL and VITE_AI_ENDPOINT if used
npm run dev
```

CI
- A basic GitHub Actions workflow is included at `.github/workflows/ci.yml` to run backend and frontend tests on push and PR.

Security
- The repository no longer contains committed secrets. If you previously had live credentials committed, rotate them immediately (database password, JWT secret, Cloudinary keys, AI keys).
- Use the `.env.example` files as templates and never commit a filled `.env` file. Add local secrets to your deployment environment or secret manager.
