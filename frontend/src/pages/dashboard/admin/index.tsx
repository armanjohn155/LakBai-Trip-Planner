import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Admin</h1>
        <p className="mt-1 text-sm text-ink-600">Manage the destination library.</p>
      </div>
      <Card className="p-6">
        <p className="text-sm text-ink-600">
          The backend exposes <code className="rounded bg-sand-100 px-1.5 py-0.5 font-mono text-xs">GET /api/destinations</code> with
          category, region, search, and price filters. A management UI for creating and editing destinations is planned next.
        </p>
      </Card>
    </div>
  );
}