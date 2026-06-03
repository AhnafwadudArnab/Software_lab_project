# Missing Diary Full

Your digital companion for finding missing people and preserving critical sighting evidence.

Missing Diary Full is a modern full-stack missing person reporting and tracking platform. It helps guardians, citizens, and police teams report missing cases, submit sightings, review movement history, upload CCTV evidence, and coordinate follow-up through a secure web dashboard.

**Frontend:** React  
**Backend:** Node.js + Express  
**Database:** PostgreSQL  
**License:** MIT

## About The Project

Missing Diary Full centralizes missing person reports, public sightings, police review tools, and movement mapping into one application. The platform combines a React frontend, an Express API, PostgreSQL storage, Cloudinary uploads, and an optional InsightFace service for face-matching support.

## Features

- Missing Case Reports - Submit and manage missing person cases with photos and details.
- Public Sighting Submission - Let citizens report sightings with location and evidence.
- Movement Mapping - Visualize sightings and movement history with map-based tracking.
- Police Dashboard - Review cases, sightings, evidence, and verification status.
- CCTV Evidence Upload - Upload and connect camera evidence to missing cases.
- Notification System - Notify users when important case or sighting updates happen.
- Role-Based Access Control - Separate guardian, citizen, police, and admin workflows.
- AI-Assisted Verification - Optional face and evidence verification through backend services.
- Offline Queue Support - Frontend utilities help queue actions when connectivity is limited.
- Responsive Interface - Built with React, Vite, and reusable UI components.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Leaflet, Lucide React |
| Backend | Node.js, Express, JWT, Helmet, Multer, Zod |
| Database | PostgreSQL |
| Media | Cloudinary |
| AI / Face Service | Python InsightFace service |
| Testing | Jest, Supertest, Vitest, Testing Library, fast-check |

## Architecture

```text
Software_lab_project/
├── backend/
│   ├── databases/              # SQL schema and migrations
│   ├── scripts/                # Migration helpers
│   └── src/
│       ├── config/             # Database and Cloudinary config
│       ├── controllers/        # API request handlers
│       ├── middleware/         # Auth, error, and police guards
│       ├── routes/             # Express route modules
│       ├── tests/              # Backend unit/property tests
│       └── utils/              # Upload, AI, and face service utilities
├── frontend/
│   ├── src/
│   │   ├── api/                # API client
│   │   ├── assets/             # Images and case assets
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # Auth, language, and offline queue context
│   │   ├── pages/              # Main application pages
│   │   ├── tests/              # Frontend tests
│   │   └── utils/              # Sync, location, and AI helpers
│   └── index.html
├── insightface-server/         # Python face-recognition service
├── Missing_diary/              # Existing project notes
└── LICENSE
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm
- PostgreSQL
- Python 3, if using the InsightFace service
- Cloudinary account, if using image uploads

### Backend Setup

Install and run from `backend/`:

```bash
cd backend
npm ci
cp .env.example .env
# Fill DATABASE_URL, JWT_SECRET, Cloudinary values, and other required settings
npm run dev
```

The backend development script starts both the Express API and the Python face service:

```bash
npm run dev
```

To run only the API server:

```bash
npm start
```

### Frontend Setup

Install and run from `frontend/`:

```bash
cd frontend
npm ci
cp .env.example .env
# Set VITE_API_URL and VITE_AI_ENDPOINT if used
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Tests

Run backend tests:

```bash
cd backend
npm test
```

Run frontend tests:

```bash
cd frontend
npm test
```

## CI

A basic GitHub Actions workflow can be placed at:

```text
.github/workflows/ci.yml
```

The workflow should run backend and frontend tests on push and pull requests.

## Security

The repository should not contain committed secrets. If live credentials were ever committed, rotate them immediately, including database passwords, JWT secrets, Cloudinary keys, and AI service keys.

Use the `.env.example` files as templates and never commit a filled `.env` file. Add local secrets to your deployment environment or secret manager.

---

## 👥 Team

| ![Saad](./assets/contributors/saad.jpg) | ![Maher](./assets/contributors/maher.jpg) | ![Ahnaf](./assets/contributors/ahnaf.jpg) |
| --- | --- | --- |
| [**Saad**](https://github.com/0Boolean0) | [**Maher**](https://github.com/MushfiqLabibMaher) | [**Ahnaf**](https://github.com/AhnafwadudArnab) |
| [@0Boolean0](https://github.com/0Boolean0) | [@MushfiqLabibMaher](https://github.com/MushfiqLabibMaher) | [@AhnafwadudArnab](https://github.com/AhnafwadudArnab) |
| Mapping + Backend | Frontend + Backend | Team Lead + Frontend + Backend |

---

## Contributing

We recommend a branch-based workflow. Avoid direct pushes to `main`.

Quick version:

```bash
git checkout -b feature/your-feature-name
git add .
git commit -m "Add: your feature description"
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

## License

Distributed under the MIT License. See `LICENSE` for more information.

Built with care for safer communities and faster missing person response.
