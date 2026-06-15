import { NavLink } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Clock,
  Hourglass,
  KeyRound,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Stethoscope,
  Sun,
  Users,
} from 'lucide-react'
import type { User } from '../types'
import { Button } from '@/components/ui/button'

export function NavItem({
  to,
  icon: Icon,
  label,
  badge,
  onNavigate,
}: {
  to: string
  icon: typeof Clock
  label: string
  badge?: number
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

interface SidebarProps {
  user: User
  theme: 'light' | 'dark'
  toggleTheme: () => void
  logout: () => void
  pendingCount: number
  isDoctor: boolean
  isAdmin: boolean
  onNavigate?: () => void
  className?: string
}

export function SidebarContent({
  user,
  theme,
  toggleTheme,
  logout,
  pendingCount,
  isDoctor,
  isAdmin,
  onNavigate,
  className = '',
}: SidebarProps) {
  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Stethoscope className="size-4.5" />
        </div>
        <div className="text-base font-bold tracking-tight text-white">
          Turnero<span className="text-sidebar-primary">Neurología</span>
        </div>
      </div>

      <nav className="scrollbar-sidebar flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <NavItem to="/pendientes" icon={Hourglass} label="Pendientes" badge={pendingCount} onNavigate={onNavigate} />
        <NavItem to="/agenda" icon={CalendarDays} label="Agenda" onNavigate={onNavigate} />
        <NavItem to="/disponibilidad" icon={Clock} label="Disponibilidad" onNavigate={onNavigate} />
        <NavItem to="/pacientes" icon={Users} label="Pacientes" onNavigate={onNavigate} />
        <NavItem to="/actividad" icon={Bell} label="Actividad" onNavigate={onNavigate} />
        {isDoctor && (
          <NavItem to="/mi-consultorio" icon={Stethoscope} label="Mi consultorio" onNavigate={onNavigate} />
        )}
        {isAdmin && <NavItem to="/configuracion" icon={Settings} label="Configuración" onNavigate={onNavigate} />}
        {isAdmin && <NavItem to="/usuarios" icon={KeyRound} label="Usuarios" onNavigate={onNavigate} />}
        {isAdmin && <NavItem to="/simulador" icon={MessageSquare} label="Simulador" onNavigate={onNavigate} />}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.fullName}</p>
            <button
              onClick={() => {
                onNavigate?.()
                logout()
              }}
              className="flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-3" />
              Cerrar sesión
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
