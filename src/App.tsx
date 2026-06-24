
import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashBoard from './assets/DashBoard'
import Expenses from './assets/Expenses'
import LogIn from './assets/LogIn'
import Materials from './assets/Materials'
import Projects from './assets/Projects'
import Reports from './assets/Reports'
import Settings from './assets/Settings'
import { AuthProvider, useAuth } from './context/AuthContext'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/dashboard" element={<RequireAuth><DashBoard /></RequireAuth>} />
        <Route path="/expenses" element={<RequireAuth><Expenses /></RequireAuth>} />
        <Route path="/materials" element={<RequireAuth><Materials /></RequireAuth>} />
        <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
