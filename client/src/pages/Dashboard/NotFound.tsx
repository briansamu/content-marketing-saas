import { Button } from "../../components/ui/button";
import { Link } from "react-router";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl mb-6">This dashboard page doesn't exist</p>
      <Button asChild>
        <Link to="/app/dashboard/overview">Return to Dashboard</Link>
      </Button>
    </div>
  );
};

export default NotFound; 