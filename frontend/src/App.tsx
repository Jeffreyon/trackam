import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import ScanPage from "@/pages/ScanPage";
import WaybillGeneratorPage from "@/pages/WaybillGeneratorPage";
import TrackWaybillPage from "@/pages/TrackWaybillPage";
import DriverHandoverPage from "@/pages/DriverHandoverPage";
import HandoverLandingPage from "@/pages/HandoverLandingPage";
import StaffHandoverPage from "@/pages/StaffHandoverPage";
import JoinLegPage from "@/pages/JoinLegPage";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardHome from "@/pages/user/DashboardHome";
import AccountPage from "@/pages/user/AccountPage";
import NotificationsPage from "@/pages/user/NotificationsPage";
import SecurityPage from "@/pages/user/SecurityPage";
import WalletTransactionsPage from "@/pages/user/WalletTransactionsPage";
import AdminDashboardLayout from "@/pages/admin/AdminDashboardLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminEventsPage from "@/pages/admin/AdminEventsPage";
import AdminRolesPage from "@/pages/admin/AdminRolesPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminIdentityVerificationPage from "@/pages/admin/AdminIdentityVerificationPage";
import AdminRidersPage from "@/pages/admin/AdminRidersPage";
import CarrierDirectoryPage from "@/pages/network/CarrierDirectoryPage";
import NetworkBookingsPage from "@/pages/network/NetworkBookingsPage";
import IncomingBookingsPage from "@/pages/network/IncomingBookingsPage";
import ShipmentsPage from "@/pages/logistics/ShipmentsPage";
import ShipmentDetailPage from "@/pages/logistics/ShipmentDetailPage";
import WaybillsPage from "@/pages/logistics/WaybillsPage";
import DispatchRunsPage from "@/pages/logistics/DispatchRunsPage";
import DispatchRunDetailPage from "@/pages/logistics/DispatchRunDetailPage";
import RidersPage from "@/pages/logistics/RidersPage";
import StaffPage from "@/pages/logistics/StaffPage";
import ErrorPage from "@/components/common/ErrorPage";
import DropoffPage from "@/pages/DropoffPage";
import { adminLoader, requireAuth } from "./scripts/auth.loader";

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/",
    children: [
      { path: "/auth/signup", element: <Signup /> },
      { path: "/auth/login", element: <Login /> },
      { path: "/auth/forgot-password", element: <ForgotPassword /> },
      { path: "/auth/verify-email", element: <VerifyEmail /> },
    ],
  },
  // OLI public pages — no auth
  { path: "/scan", element: <ScanPage /> },
  { path: "/waybill", element: <WaybillGeneratorPage /> },
  { path: "/track/:id", element: <TrackWaybillPage /> },
  { path: "/handover", element: <HandoverLandingPage /> },
  { path: "/handover/driver", element: <DriverHandoverPage /> },
  { path: "/handover/staff", element: <StaffHandoverPage /> },
  { path: "/join", element: <JoinLegPage /> },
  { path: "/dropoff/:token", element: <DropoffPage /> },
  {
    path: "/dashboard",
    loader: requireAuth,
    element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardHome /> },
      { path: "shipments", element: <ShipmentsPage /> },
      { path: "shipments/:id", element: <ShipmentDetailPage /> },
      { path: "waybills", element: <WaybillsPage /> },
      { path: "runs", element: <DispatchRunsPage /> },
      { path: "runs/:id", element: <DispatchRunDetailPage /> },
      { path: "riders", element: <RidersPage /> },
      { path: "staff",  element: <StaffPage /> },
      { path: "network", element: <CarrierDirectoryPage /> },
      { path: "bookings", element: <NetworkBookingsPage /> },
      { path: "incoming-bookings", element: <IncomingBookingsPage /> },
      { path: "account", element: <AccountPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "security", element: <SecurityPage /> },
      { path: "wallet/transactions", element: <WalletTransactionsPage /> },
    ],
  },
  {
    path: "/admin/dashboard",
    loader: adminLoader,
    element: <AdminDashboardLayout />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "events", element: <AdminEventsPage /> },
      { path: "roles", element: <AdminRolesPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
      { path: "oli",    element: <Navigate to="/admin/dashboard/settings?tab=network" replace /> },
      { path: "wallet", element: <Navigate to="/admin/dashboard/settings?tab=wallet"  replace /> },
      { path: "riders", element: <AdminRidersPage /> },
      { path: "identity-verifications", element: <AdminIdentityVerificationPage /> },
    ],
  },
  { path: "*", element: <ErrorPage /> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
