import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/layout/AppShell'
import { Home } from '@/pages/Home'
import { NewMuse } from '@/pages/NewMuse'
import { MuseLayout } from '@/pages/muse/MuseLayout'
import { MuseOverview } from '@/pages/muse/Overview'
import { Resources } from '@/pages/muse/Resources'
import { Lessons } from '@/pages/muse/Lessons'
import { LessonReader } from '@/pages/muse/LessonReader'
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
          { path: 'lessons',           element: <Lessons /> },
          { path: 'lessons/:lessonId', element: <LessonReader /> },
          { path: 'chat',              element: <Chat /> },
          { path: 'voice',             element: <Navigate to=".." replace /> },
        ],
      },
    ],
  },
])
