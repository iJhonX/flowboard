import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import HealthCheck from './pages/HealthCheck'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import TeamDetail from './pages/TeamDetail'
import Board from './pages/Board'

function AppRoutes() {
  const location = useLocation()
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId"
        element={
          <ProtectedRoute>
            {/* key remonta el componente al cambiar de equipo: evita mostrar
                por un instante los datos del equipo anterior */}
            <TeamDetail key={location.pathname} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/boards/:boardId"
        element={
          <ProtectedRoute>
            <Board key={location.pathname} />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/health" element={<HealthCheck />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
