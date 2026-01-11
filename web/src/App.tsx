import './App.css'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { WebSocketProvider } from './contexts/WebSocketContext'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <WebSocketProvider>
          <RouterProvider router={router} />
        </WebSocketProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
