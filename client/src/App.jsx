import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/context.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Dues from './pages/Dues.jsx';
import Members from './pages/Members.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import { Loader } from './components/ui.jsx';

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function PublicOrGuestRoute({ children }) {
  const { user, guest, ready } = useAuth();

  if (!ready) return <Loader />;
  // Kalau belum login dan belum klik masuk sebagai tamu, arahkan ke login
  if (!user && !guest) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        {/* Dashboard bisa diakses oleh Admin, Super Admin, dan Guest */}
        <Route
          path="/"
          element={
            <PublicOrGuestRoute>
              <Dashboard />
            </PublicOrGuestRoute>
          }
        />

        {/* Halaman khusus Admin & Super Admin */}
        <Route
          path="/transaksi"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/iuran"
          element={
            <ProtectedRoute>
              <Dues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/anggota"
          element={
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pengaturan"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
