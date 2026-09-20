import { ExternalLink } from 'lucide-react';
import type { PeriodoRelatorio } from '@mahou-hub/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface EnvioRelatorio {
  id: string;
  titulo?: string;
  periodo: PeriodoRelatorio;
  inicio: string;
  fim: string;
  status: 'PENDENTE' | 'PROCESSANDO' | 'ENVIADO' | 'FALHOU';
  planilhaUrl: string | null;
  erro: string | null;
  criadoEm: string;
  enviadoEm: string | null;
}
const ROTULOS = {
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  ENVIADO: 'Enviado',
  FALHOU: 'Falhou',
};
const PERIODOS = { DIARIO: 'Diário', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' };
function dia(valor: string) {
  return valor.slice(0, 10).split('-').reverse().join('/');
}

/** Consulta os envios e abre a planilha gerada. Ex.: <RelatoriosEnvios envios={lista} />. */
export function RelatoriosEnvios({ envios }: { envios: EnvioRelatorio[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de envios</CardTitle>
        <CardDescription>
          Prévias são guardadas por dia. Fechamentos enviados são preservados: repetir a solicitação
          abre a mesma planilha, sem reenviar o e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {envios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório foi enviado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Relatório</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planilha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envios.map((envio) => (
                <TableRow key={envio.id}>
                  <TableCell>
                    <p className="font-medium">{envio.titulo ?? PERIODOS[envio.periodo]}</p>
                    <p className="text-xs text-muted-foreground">
                      {dia(envio.inicio)} a {dia(envio.fim)}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(envio.criadoEm).toLocaleString('pt-BR', {
                      timeZone: 'America/Bahia',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        envio.status === 'ENVIADO'
                          ? 'success'
                          : envio.status === 'FALHOU'
                            ? 'danger'
                            : 'secondary'
                      }
                    >
                      {ROTULOS[envio.status]}
                    </Badge>
                    {envio.erro && (
                      <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs text-destructive">
                        {envio.erro}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {envio.planilhaUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={envio.planilhaUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" /> Abrir planilha
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
