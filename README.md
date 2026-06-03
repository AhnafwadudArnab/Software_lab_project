# Missing Diary

## Missing Person Reporting & Community Sighting Platform

Missing Diary is a full-stack web application designed to help families, communities, and authorities collaborate in locating missing persons. The platform allows guardians to report missing cases, enables citizens to submit sightings, tracks movement history through maps, manages evidence securely, and provides administrators and law enforcement officers with tools to review and monitor case progress.

---

## 🚀 Features

### 📝 Missing Person Case Reporting

- Create and manage missing person reports
- Upload photographs and personal information
- Store last-seen location and case details
- Track case status updates

### 👨‍👩‍👧 Guardian Dashboard

- Manage reported missing cases
- View submitted sightings
- Monitor movement history
- Receive case notifications

### 📍 Public Sighting Submission

- Submit sightings with location details
- Upload supporting photos or evidence
- Anonymous reporting option
- Community participation in search efforts

### 🗺️ Movement Tracking

- Interactive map integration
- Timeline-based activity tracking
- Visualize sighting locations
- Monitor possible movement patterns

### 📷 Evidence Management

- Upload and organize evidence
- Associate evidence with specific cases
- Secure cloud storage support
- Evidence review and verification workflow

### 🔔 Notification System

- New sighting alerts
- Case update notifications
- Verification status updates
- Administrative announcements

### 🛡️ Administrative Dashboard

- Review all reported cases
- Manage public submissions
- Verify sightings and evidence
- Monitor platform activities
- Update case statuses

### 👥 Role-Based Access Control

The platform supports multiple user roles:

- Guardian
- Citizen
- Law Enforcement Officer
- Administrator

### 📊 Analytics & Statistics

- Active missing cases
- Resolved cases
- Recent sighting reports
- Platform usage statistics
- Regional case insights

### 📱 Responsive Design

- Desktop support
- Tablet support
- Mobile-friendly interface
- Modern and accessible UI

---

## 👥 Team Trinity-Killers

| ![Ahnaf Wadud Arnab](assets/contributors/ahnaf-thumb.jpg) | ![S.M Shihab Adnan Saad](assets/contributors/saad-thumb.jpg) | ![Mushfiq Labib Maher](assets/contributors/maher-thumb.jpg) |
| --- | --- | --- |
| [**Ahnaf**](https://github.com/AhnafwadudArnab) | [**Saad**](https://github.com/0Boolean0) | [**Maher**](https://github.com/MushfiqLabibMaher) |
| [@AhnafwadudArnab](https://github.com/AhnafwadudArnab) | [@0Boolean0](https://github.com/0Boolean0) | [@MushfiqLabibMaher](https://github.com/MushfiqLabibMaher) |
| Team Lead + Frontend + Backend | Mapping + Backend | Frontend + Backend |

---

## 🏗️ System Architecture

```text
Frontend (React + Vite)
        │
        ▼
Backend API (Node.js + Express)
        │
 ┌──────┴──────┐
 ▼             ▼
PostgreSQL   Cloudinary
Database     Media Storage
```

---

## 🛠️ Tech Stack

### Frontend

- React.js
- Vite
- React Router
- Axios
- Leaflet
- CSS

### Backend

- Node.js
- Express.js
- JWT Authentication
- Multer
- Zod
- Helmet

### Database

- PostgreSQL

### Storage

- Cloudinary

### Mapping

- Leaflet
- OpenStreetMap

### Testing

- Jest
- Supertest
- Vitest
- Testing Library
- fast-check

---

## 📂 Project Structure

```text
Software_lab_project/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── tests/
│   │   └── utils/
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── databases/
│   ├── scripts/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── tests/
│   │   └── utils/
│   └── package.json
│
├── insightface-server/
│   ├── app.py
│   └── requirements.txt
│
├── assets/
│   └── contributors/
│
└── README.md
```

---

## 🚀 Getting Started

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

---

## 🔐 User Roles

### Guardian

- Report missing persons
- Manage cases
- View sightings
- Receive updates

### Citizen

- Browse public cases
- Submit sightings
- Upload evidence
- Participate anonymously

### Law Enforcement

- Review cases
- Verify reports
- Update investigation status

### Administrator

- Manage users
- Verify evidence
- Moderate content
- Generate reports

---

## 📸 Core Workflow

1. Guardian reports a missing person.
2. Case becomes available to the public.
3. Citizens submit sightings and evidence.
4. Administrators review submissions.
5. Verified sightings are added to movement history.
6. Guardians receive notifications.
7. Authorities monitor case progress.
8. Case is marked resolved when the person is found.

---

## 🧪 Tests

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

---

## 🌟 Future Enhancements

- QR Code based case sharing
- Flutter mobile application
- Emergency SMS alerts
- Nearby case notifications
- Police station integration
- Heatmap visualization
- Multi-language support (English & Bangla)
- Advanced search and filtering

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/new-feature
```

3. Commit your changes.

```bash
git commit -m "Add new feature"
```

4. Push to GitHub.

```bash
git push origin feature/new-feature
```

5. Create a Pull Request.

---

## 🔐 Security

The repository should not contain committed secrets. If live credentials were ever committed, rotate them immediately, including database passwords, JWT secrets, Cloudinary keys, and AI service keys.

Use the `.env.example` files as templates and never commit a filled `.env` file. Add local secrets to your deployment environment or secret manager.

---

## 📜 License

Distributed under the MIT License.

---

## ❤️ Mission

Every missing person deserves to be found.

Missing Diary aims to empower families, communities, and authorities by providing a centralized platform for reporting, tracking, and collaborating in missing person investigations.
