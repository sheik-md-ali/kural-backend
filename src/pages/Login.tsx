import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Sparkles, LineChart, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful!');
        // Navigation will be handled by the router based on role
        navigate('/dashboard');
      } else {
        toast.error(result.message ?? 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="absolute right-6 top-6 z-30">
        <ThemeToggle />
      </div>

      <div className="relative z-20 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:px-12">
        <div className="order-2 overflow-hidden rounded-3xl border border-primary/10 bg-primary/10 p-8 shadow-xl backdrop-blur lg:order-1 lg:p-12">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Welcome back to Kuralapp 
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Command your election campaign with clarity and speed.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground lg:text-lg">
            Monitor constituencies, coordinate agents, and unlock predictive insights tailored to your leadership level. Stay ahead of every booth, every survey, every moment.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-background/60 p-4">
              <div className="flex items-center gap-3 text-primary">
                <LineChart className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">Live Analytics</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">+42%</p>
              <p className="text-xs text-muted-foreground">Sentiment uplift in priority constituencies this week.</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-background/60 p-4">
              <div className="flex items-center gap-3 text-primary">
                <Users className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">Agent Network</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">318</p>
              <p className="text-xs text-muted-foreground">Field agents online across 74 high-impact booths.</p>
            </div>
          </div>
          <div className="mt-10 text-xs uppercase tracking-widest text-primary/70">
            Secure. Role-aware. Built for campaign command centers.
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <Card className="relative w-full overflow-hidden rounded-3xl border border-border/60 bg-background/95 p-10 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-secondary" />
            <div className="text-left">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Shield className="h-9 w-9" />
              </div>
              <h2 className="text-3xl font-semibold text-foreground">Sign in to KuralApp</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use your issued credentials to access your command dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email or Mobile Number</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="you@campaign.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" className="h-4 w-4 rounded border border-input bg-background" />
                  Remember me
                </label>
                <button type="button" className="font-semibold text-primary transition-colors hover:text-primary/80">
                  Recover password
                </button>
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  Login with OTP
                </Button>
              </div>
            </form>

            <div className="mt-8 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-sm">
              <p className="font-semibold text-primary">Demo credentials</p>
              <div className="mt-3 grid gap-2 text-muted-foreground">
                <p><span className="font-medium text-foreground">System Admin:</span> 9999999999 / Admin@123</p>
                <p><span className="font-medium text-foreground">L1 Director:</span> acim@ac.com / acim123</p>
                <p><span className="font-medium text-foreground">L2 Supervisor:</span> aci@ac118.com / aci123</p>
                <p><span className="font-medium text-foreground">L9 Command:</span> warroom@system.com / wrm123</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_theme(colors.primary/20),_transparent_55%)]" aria-hidden />
    </div>
  );
};
