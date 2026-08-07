import { useState } from 'react'
import { AuthLayout } from '../auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Esta pantalla se dibuja fuera del router, y el <Toaster /> de sonner vive
// en __root.tsx, así que un toast aquí no se vería: los errores van en línea.

interface FirstRunSetupProps {
  /** Se llama cuando la configuración terminó bien y ya se puede iniciar sesión. */
  onCompleted: () => void
}

// Pasos que se muestran mientras el proceso corre en el main. No son
// progreso real (todo ocurre en una sola transacción), solo le dan al
// usuario algo que leer durante la espera del catálogo.
const PASOS = [
  'Creando el usuario administrador...',
  'Asignando permisos...',
  'Cargando el catálogo de productos...',
]

export function FirstRunSetup({ onCompleted }: FirstRunSetupProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validar = (): string | null => {
    if (username.trim().length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errorValidacion = validar()
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }

    setError(null)
    setIsLoading(true)
    setPaso(0)

    // Avanza el texto mientras el main trabaja; se detiene al terminar.
    const avance = setInterval(() => {
      setPaso((p) => (p < PASOS.length - 1 ? p + 1 : p))
    }, 900)

    try {
      const result = await window.api.bootstrapCreateFirstUser({
        username: username.trim(),
        password,
      })

      if (result.success) {
        onCompleted()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error durante la configuración inicial')
    } finally {
      clearInterval(avance)
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <AuthLayout
        title="Preparando el sistema"
        description="Esto puede tardar unos segundos. No cierres la aplicación."
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <svg
            className="animate-spin h-10 w-10 text-gray-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-600">{PASOS[paso]}</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Configuración inicial"
      description="Crea el usuario administrador para empezar a usar el sistema"
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="setup-username">Nombre de usuario</Label>
            <Input
              id="setup-username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="setup-password">Contraseña</Label>
            <Input
              id="setup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="setup-confirm">Confirmar contraseña</Label>
            <Input
              id="setup-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Mostrar contraseñas
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-gray-500">
          Este usuario recibe todos los permisos del sistema. Anota la contraseña:
          no hay forma de recuperarla desde la aplicación.
        </p>

        <Button type="submit" className="w-full">
          Crear usuario y preparar el sistema
        </Button>
      </form>
    </AuthLayout>
  )
}
