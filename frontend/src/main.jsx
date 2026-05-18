import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PoliceDashboard from './pages/PoliceDashboard';
import ReportCase from './pages/ReportCase';
import CaseDetails from './pages/CaseDetails';
import SubmitSighting from './pages/SubmitSighting';
import MissingCases from './pages/MissingCases';
import Sightings from './pages/Sightings';
import { initSyncListener } from './utils/syncQueue';

// Start the offline queue sync listener once on app startup
initSyncListener();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <AuthProvider>
        <OfflineQueueProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/cases" element={<MissingCases />} />
              <Route path="/cases/:id" element={<CaseDetails />} />
              <Route path="/sightings" element={<Sightings />} />
              <Route path="/sighting/:id?" element={<SubmitSighting />} />
              <Route path="/report" element={<ReportCase />} />
              {/* Role-based dashboards */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/police" element={
                <ProtectedRoute>
                  <PoliceDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </OfflineQueueProvider>
      </AuthProvider>
    </LangProvider>
  </React.StrictMode>
);
