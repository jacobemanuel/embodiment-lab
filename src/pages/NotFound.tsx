import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Clear session and redirect
          sessionStorage.clear();
          navigate('/');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleRestart = () => {
    sessionStorage.clear();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Animated warning icon */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
        </div>

        {/* Big 404 */}
        <h1 className="text-8xl font-bold text-muted-foreground/30 mb-4">404</h1>

        {/* Playful message */}
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Oops! Trying to cheat?
        </h2>
        
        <p className="text-muted-foreground mb-2">
          Nice try! But we caught you trying to access a page you shouldn't.
        </p>
        <p className="text-muted-foreground mb-8">
          Don't worry, we'll restart your session and take you back to the beginning.
        </p>

        {/* Countdown */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground">
            <RotateCcw className="w-4 h-4 animate-spin" />
            <span>Redirecting in <span className="font-bold text-foreground">{countdown}</span> seconds...</span>
          </div>
        </div>

        {/* Manual button */}
        <Button 
          onClick={handleRestart}
          className="gap-2"
          size="lg"
        >
          <Home className="w-4 h-4" />
          Take Me Home Now
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
