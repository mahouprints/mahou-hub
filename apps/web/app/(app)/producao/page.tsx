import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ProducaoPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Produção</h1>
        <p className="text-sm text-muted-foreground">
          Kanban da fila de impressão e consumo mensal agregado.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Kanban (Fila → Imprimindo → Concluído → Embalado → Enviado) + agregação por filamento
            e impressora vem na Fase 3.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
