export default function Home() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent"></div>
          <h1 className="text-4xl font-bold text-text-primary">LEADS</h1>
        </div>
        <p className="text-text-secondary text-lg">
          AI-Powered Real Estate Lead Generation Platform
        </p>
        <p className="text-text-muted text-sm">
          Setting up... check back soon.
        </p>
      </div>
    </main>
  );
}
