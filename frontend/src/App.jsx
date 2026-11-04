import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";

import Home from "./pages/public/Home";
import Shop from "./pages/public/Shop";
import ProductDetails from "./pages/public/ProductDetails";
import Register from "./pages/public/Register";
import Login from "./pages/public/Login";
import Affiliate from "./pages/public/Affiliate";
import HowItWorks from "./pages/public/HowItWorks";
import Contact from "./pages/public/Contact";
import About from "./pages/public/About";
import FAQ from "./pages/public/FAQ";
import ForgotPassword from "./pages/public/ForgotPassword";
import ResetPassword from "./pages/public/ResetPassword";
import Terms from "./pages/public/Terms";
import Privacy from "./pages/public/Privacy";
import Refunds from "./pages/public/Refunds";
import NotFound from "./pages/public/NotFound";

import MemberLayout from "./pages/member/MemberLayout";
import DashboardHome from "./pages/member/DashboardHome";
import MyReferrals from "./pages/member/MyReferrals";
import MyOrders from "./pages/member/MyOrders";
import MyEarnings from "./pages/member/MyEarnings";
import MyWithdrawals from "./pages/member/MyWithdrawals";
import Profile from "./pages/member/Profile";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminSettings from "./pages/admin/AdminSettings";

function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public site */}
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/shop" element={<PublicLayout><Shop /></PublicLayout>} />
      <Route path="/shop/:id" element={<PublicLayout><ProductDetails /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
      <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
      <Route path="/affiliate" element={<PublicLayout><Affiliate /></PublicLayout>} />
      <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/faq" element={<PublicLayout><FAQ /></PublicLayout>} />
      <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
      <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
      <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
      <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />
      <Route path="/refunds" element={<PublicLayout><Refunds /></PublicLayout>} />

      {/* Member dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PublicLayout>
              <MemberLayout />
            </PublicLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="referrals" element={<MyReferrals />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="earnings" element={<MyEarnings />} />
        <Route path="withdrawals" element={<MyWithdrawals />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="commissions" element={<AdminCommissions />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Any address that does not exist */}
      <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
    </Routes>
  );
}
