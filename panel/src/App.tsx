import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Menu, Moon, Stethoscope, Sun } from 'lucide-react'
import { useAuth } from './auth'
import { api } from './api'
import { useTheme } from './theme'
import { SidebarContent } from './components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import Login from './pages/Login'
import Pendientes from './pages/Pendientes'
import Agenda from './pages/Agenda'
import Disponibilidad from './pages/Disponibilidad'
import Pacientes from './pages/Pacientes'
import Configuracion from './pages/Configuracion'
import Simulador from './pages/Simulador'
import MiConsultorio from './pages/MiConsultorio'
import Usuarios from './pages/Usuarios'
import PublicDoctor from './pages/PublicDoctor'
import type { Appointment } from './types'
import { PageLoading } from './components/page'

export default function App() {
  const { user, loading, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    api
      .get<Appointment[]>('/api/appointments/pending')
      .then((list) => setPendingCount(list.length))
      .catch(() => {})
  }, [user, location.pathname])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  if (loading) return <PageLoading label="Verificando sesión…" />

  if (location.pathname.startsWith('/d/')) {
    return (
      <Routes>
        <Route path="/d/:doctorId" element={<PublicDoctor />} />
      </Routes>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const isDoctor = user.role === 'DOCTOR'
  const isAdmin = user.role === 'ADMIN'

  const sidebarProps = {
    user,
    theme,
    toggleTheme: toggle,
    logout,
    pendingCount,
    isDoctor,
    isAdmin,
    onNavigate: () => setMenuOpen(false),
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Barra superior mobile */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Stethoscope className="size-4" />
          </div>
          <span className="truncate text-sm font-bold tracking-tight">
            Turnero<span className="text-primary">Médico</span>
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>

      {/* Drawer mobile */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-3rem,18rem)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent"
          aria-describedby={undefined}
        >
          <SidebarContent {...sidebarProps} />
        </SheetContent>
      </Sheet>

      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent {...sidebarProps} />
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <Routes>
          <Route path="/pendientes" element={<Pendientes />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/disponibilidad" element={<Disponibilidad />} />
          <Route path="/pacientes" element={<Pacientes />} />
          {isDoctor && <Route path="/mi-consultorio" element={<MiConsultorio />} />}
          {isAdmin && <Route path="/configuracion" element={<Configuracion />} />}
          {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
          {isAdmin && <Route path="/simulador" element={<Simulador />} />}
          <Route path="*" element={<Navigate to="/pendientes" replace />} />
        </Routes>
      </main>
    </div>
  )
}
