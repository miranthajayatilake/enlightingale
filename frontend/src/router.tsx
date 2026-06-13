import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/layout/AppShell'
import { Home } from '@/pages/Home'
import { NewMuse } from '@/pages/NewMuse'
import { MuseLayout } from '@/pages/muse/MuseLayout'
import { MuseOverview } from '@/pages/muse/Overview'
import { Research } from '@/pages/muse/Research'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'muse/new', element: <NewMuse /> },
      {
        path: 'muse/:id',
        element: <MuseLayout />,
        children: [
          { index: true, element: <MuseOverview /> },
          { path: 'research', element: <Research /> },
          // Legacy routes redirect to their new homes
          { path: 'resources', element: <Navigate to="../research" replace /> },
          { path: 'chat',      element: <Navigate to="../research" replace /> },
          { path: 'voice',     element: <Navigate to=".." replace /> },
          // Lessons deprecated in v0.2 — routes redirect to Canvas
          { path: 'lessons',           element: <Navigate to=".." replace /> },
          { path: 'lessons/:lessonId', element: <Navigate to="../.." replace /> },
        ],
      },
    ],
  },
])
