import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GuestRoute } from './components/GuestRoute';
import { StudentPortalShell } from './components/student/StudentPortalLayout';
import { homePathForUser } from './lib/authStorage';
import LandingPage from './pages/LandingPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PaymentCheckoutPage from './pages/PaymentCheckoutPage';
import PaymentResultPage from './pages/PaymentResultPage';
import StudentDashboard from './pages/StudentDashboard';
import StudentMcqPage from './pages/student/StudentMcqPage';
import StudentMcqTermPage from './pages/student/StudentMcqTermPage';
import StudentMcqExamSetupPage from './pages/student/StudentMcqExamSetupPage';
import StudentMcqExamPage from './pages/student/StudentMcqExamPage';
import StudentMcqExamReportPage from './pages/student/StudentMcqExamReportPage';
import StudentMcqSavedPage from './pages/student/StudentMcqSavedPage';
import StudentDiagnosticsPage from './pages/student/StudentDiagnosticsPage';
import StudentUpgradePage from './pages/student/StudentUpgradePage';
import SimulationPage from './pages/SimulationPage';
import ProfilePage from './pages/ProfilePage';
import ResultsPage from './pages/ResultsPage';
import AdminDashboard from './pages/AdminDashboard';
import { PageTransition } from './components/PageTransition';
import { ToastContainer } from './components/ToastContainer';
import { releaseStuckUiLayers } from './lib/uiCleanup';

function RouteUiCleanup() {
  const location = useLocation();
  useEffect(() => {
    releaseStuckUiLayers();
  }, [location.pathname]);
  return null;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForUser(user)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteUiCleanup />
        <PageTransition>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          <Route element={<ProtectedRoute roles={['STUDENT', 'ADMIN']} />}>
            <Route path="/simulation/:sessionId" element={<SimulationPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route element={<StudentPortalShell />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/mcq" element={<StudentMcqPage />} />
              <Route path="/student/mcq/saved" element={<StudentMcqSavedPage />} />
              <Route path="/student/mcq/:termId" element={<StudentMcqTermPage />} />
              <Route path="/student/mcq/:termId/:moduleId/setup" element={<StudentMcqExamSetupPage />} />
              <Route path="/student/mcq/:termId/:moduleId/exam" element={<StudentMcqExamPage />} />
              <Route path="/student/mcq/:termId/:moduleId/report" element={<StudentMcqExamReportPage />} />
              <Route path="/student/diagnostics" element={<StudentDiagnosticsPage />} />
              <Route path="/student/upgrade" element={<StudentUpgradePage />} />
              <Route path="/student/profile" element={<ProfilePage />} />
              <Route path="/student/results" element={<ResultsPage />} />
            </Route>
            <Route path="/student/payment/checkout" element={<PaymentCheckoutPage />} />
            <Route path="/student/payment/success" element={<PaymentResultPage mode="success" />} />
            <Route path="/student/payment/failed" element={<PaymentResultPage mode="failed" />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </PageTransition>
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  );
}
