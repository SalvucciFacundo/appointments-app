import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/auth/AuthContext"
import RequireAuth from "@/auth/RequireAuth"
import { ToastProvider } from "@/components/ui/Toast"
import Home from "@/pages/Home"
import StoreDetail from "@/pages/StoreDetail"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import Dashboard from "@/pages/Dashboard"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:slug" element={<StoreDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}