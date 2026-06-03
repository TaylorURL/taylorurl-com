import {
  Calendar,
  CheckSquare,
  FolderGit2,
  HardDrive,
  ListTodo,
  MessageSquare,
  MonitorSmartphone,
} from 'lucide-react'

export const SUNDAY_ROUTES = {
  AUTH: '/sunday/auth',
  TODAY: '/sunday',
  TODO: '/sunday/todo',
  CHAT: '/sunday/chat',
  TASKS: '/sunday/tasks',
  PROJECTS: '/sunday/projects',
  PROJECT_DETAIL: '/sunday/projects/:id',
  FILES: '/sunday/files',
  DEVICES: '/sunday/devices',
  DAY: '/sunday/day/:date',
}

export const SUNDAY_NAV_ITEMS = [
  { label: 'Today', path: SUNDAY_ROUTES.TODAY, end: true, icon: Calendar },
  { label: 'Todo', path: SUNDAY_ROUTES.TODO, icon: ListTodo },
  { label: 'Chat', path: SUNDAY_ROUTES.CHAT, icon: MessageSquare },
  { label: 'Tasks', path: SUNDAY_ROUTES.TASKS, icon: CheckSquare },
  { label: 'Projects', path: SUNDAY_ROUTES.PROJECTS, icon: FolderGit2 },
  { label: 'Files', path: SUNDAY_ROUTES.FILES, icon: HardDrive },
  { label: 'Devices', path: SUNDAY_ROUTES.DEVICES, icon: MonitorSmartphone },
]
