import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ToastProvider } from "@/components/ui/Toast"
import Home from "@/pages/Home"
import StoreDetail from "@/pages/StoreDetail"
import Dashboard from "@/pages/Dashboard"

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:slug" element={<StoreDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
