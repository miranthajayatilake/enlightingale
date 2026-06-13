import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/layout/AppShell'
import { Home } from '@/pages/Home'
import { NewMuse } from '@/pages/NewMuse'
import { MuseLayout } from '@/pages/muse/MuseLayout'
import { MuseOverview } from '@/pages/muse/Overview'
import { Resources } from '@/pages/muse/Resources'
import { Chat } from '@/pages/muse/Chat'

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
          { path: 'resources', element: <Resources /> },
          { path: 'chat',              element: <Chat /> },
          { path: 'voice',             element: <Navigate to=".." replace /> },
          // Lessons deprecated in v0.2 — pages kept on disk, routes redirect to Overview
          { path: 'lessons',           element: <Navigate to=".." replace /> },
          { path: 'lessons/:lessonId', element: <Navigate to="../.." replace /> },
        ],
      },
    ],
  },
])
