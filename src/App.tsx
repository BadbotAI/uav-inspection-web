import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Sync } from './pages/Sync';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Trends } from './pages/Trends';

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/tasks" replace />} />
        <Route path="sync" element={<Sync />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="analysis" element={<Trends />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  );
}
