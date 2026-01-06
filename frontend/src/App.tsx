import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsagePage from './pages/UsagePage';
import AuthFilesPage from './pages/AuthFilesPage';
import APIKeysPage from './pages/APIKeysPage';
import ProxyKeysPage from './pages/ProxyKeysPage';
import OAuthPage from './pages/OAuthPage';
import LogsPage from './pages/LogsPage';
import ConfigPage from './pages/ConfigPage';
import RoutingPage from './pages/RoutingPage';
import PlaygroundPage from './pages/PlaygroundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
      />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/usage" element={<UsagePage />} />
        <Route path="/auth-files" element={<AuthFilesPage />} />
        <Route path="/proxy-keys" element={<ProxyKeysPage />} />
        <Route path="/api-keys" element={<APIKeysPage />} />
        <Route path="/oauth" element={<OAuthPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/routing" element={<RoutingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

