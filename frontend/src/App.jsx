import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Landing from "./pages/Landing";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import Dashboard from "./pages/dashboard/Dashboard";
import ActiveSOS from "./pages/dashboard/ActiveSOS";
import EmergencyContacts from "./pages/dashboard/EmergencyContacts";
import EvidenceVault from "./pages/dashboard/EvidenceVault";
import SafeRoute from "./pages/dashboard/SafeRoute";
import SOSSettings from "./pages/dashboard/SOSSettings";
import IncidentHistory from "./pages/dashboard/IncidentHistory";

import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Landing />}
      />

      <Route
        path="/auth/login"
        element={<Login />}
      />

      <Route
        path="/auth/register"
        element={<Register />}
      />

      <Route element={<ProtectedRoute />}>

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/dashboard/sos"
          element={<ActiveSOS />}
        />

        <Route
          path="/dashboard/contacts"
          element={<EmergencyContacts />}
        />

        <Route
          path="/dashboard/evidence"
          element={<EvidenceVault />}
        />

        <Route
          path="/dashboard/routes"
          element={<SafeRoute />}
        />

        <Route
          path="/dashboard/settings"
          element={<SOSSettings />}
        />

        <Route
          path="/dashboard/history"
          element={<IncidentHistory />}
        />

      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}