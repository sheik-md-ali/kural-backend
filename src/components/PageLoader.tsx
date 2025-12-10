import { Loader2 } from 'lucide-react';

export const PageLoader = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span>Loading...</span>
  </div>
);

export default PageLoader;
