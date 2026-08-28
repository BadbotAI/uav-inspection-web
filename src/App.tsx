import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Connect } from './pages/Connect';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Trends } from './pages/Trends';
import { Downloads } from './pages/Downloads';
import { Archive } from './pages/Archive';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/tasks" replace />} />
        <Route path="connect" element={<Connect />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="trends" element={<Trends />} />
        <Route path="downloads" element={<Downloads />} />
        <Route path="archive" element={<Archive />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  );
}
