import { Navigate } from 'react-router';

// This component now just redirects to the new dashboard/overview route
const Dashboard = () => {
  return <Navigate to="/dashboard/overview" replace />;
};

export default Dashboard;