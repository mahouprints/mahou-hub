import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SimuladorPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
        <p className="text-sm text-muted-foreground">
          Projeta produção de um produto cadastrado em um período.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Endpoint <code className="rounded bg-muted px-1.5 py-0.5">POST /api/pricing/simular</code>{' '}
            já está pronto. UI será adicionada em seguida.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
