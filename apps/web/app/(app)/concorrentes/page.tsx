import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ConcorrentesPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Concorrentes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de concorrentes e histórico manual de preços.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            CRUD básico em breve. Monitoramento automático fica para a Fase 5.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
