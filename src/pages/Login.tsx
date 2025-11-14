import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Key, Shield } from "lucide-react";
import { convertWifToIds, storeAuthSession } from "@/utils/wifAuth";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [wifKey, setWifKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate WIF key
      if (!wifKey.trim()) {
        throw new Error("Please enter your WIF key");
      }

      // Convert WIF to identifiers
      const authData = await convertWifToIds(wifKey.trim());

      // Store in session
      storeAuthSession(authData);

      toast({
        title: "Login successful",
        description: "Welcome to Lana Register",
      });

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid WIF key";
      setError(errorMessage);
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="mb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">L</span>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Lana Register</h1>
          <p className="text-muted-foreground">Login with your LANA WIF Key</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              WIF Authentication
            </CardTitle>
            <CardDescription>
              Enter your LANA WIF private key to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wif">WIF Private Key</Label>
                <Input
                  id="wif"
                  type="password"
                  placeholder="Enter your WIF key"
                  value={wifKey}
                  onChange={(e) => setWifKey(e.target.value)}
                  disabled={isLoading}
                  className="font-mono"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Login
                  </>
                )}
              </Button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground mb-1">Secure Authentication</p>
                  <p className="text-muted-foreground">
                    Your WIF key is processed locally and stored only in your browser session.
                    Never share your private key with anyone.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
