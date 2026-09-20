'use client';

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ConfiguracaoRelatorios {
  ativo: boolean;
  googleConfigurado: boolean;
  emailGoogle: string | null;
  destinatarios: string[];
  webhookUrl: string | null;
  horario: string;
  timezone: string;
}

interface Props {
  configuracao: ConfiguracaoRelatorios;
  onSalvo: () => Promise<unknown>;
}

/** Conecta a conta Google e define quem recebe os relatórios. Ex.: <RelatoriosConfiguracao configuracao={config} onSalvo={recarregar} />. */
export function RelatoriosConfiguracao({ configuracao, onSalvo }: Props) {
  const [emailGoogle, setEmailGoogle] = useState(configuracao.emailGoogle ?? '');
  const [destinatarios, setDestinatarios] = useState(configuracao.destinatarios.join(', '));
  const [webhookUrl, setWebhookUrl] = useState(configuracao.webhookUrl ?? '');
  const [ativo, setAtivo] = useState(configuracao.ativo);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const emails = destinatarios
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const emailsAlterados =
    emailGoogle.trim() !== (configuracao.emailGoogle ?? '') ||
    emails.join(',') !== configuracao.destinatarios.join(',');
  const conexaoAlterada = webhookUrl.trim() !== (configuracao.webhookUrl ?? '') || emailsAlterados;

  const salvar = useMutation({
    mutationFn: () =>
      apiFetch<ConfiguracaoRelatorios>('/relatorios/configuracao', {
        method: 'PUT',
        json: {
          emailGoogle: emailGoogle.trim(),
          destinatarios: emails,
          webhookUrl: webhookUrl.trim() || null,
          ativo: ativo && !conexaoAlterada,
        },
      }),
    onSuccess: async () => {
      await onSalvo();
      toast.success('Configuração salva');
    },
  });
  const preparar = useMutation({
    mutationFn: () =>
      apiFetch<{ codigo: string }>('/relatorios/integracao', { method: 'POST', json: {} }),
    onSuccess: (resultado) => {
      setCodigo(resultado.codigo);
      setCopiado(false);
    },
  });

  function salvarConfiguracao(evento: FormEvent) {
    evento.preventDefault();
    salvar.mutate();
  }
  async function copiarCodigo() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      toast.error('Não foi possível copiar. Selecione o código abaixo e copie manualmente.');
    }
  }

  return (
    <Card id="configurar-relatorios">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4" /> Envios automáticos
          </CardTitle>
          <Badge variant={configuracao.googleConfigurado ? 'success' : 'warning'}>
            {configuracao.googleConfigurado ? 'Google configurado' : 'Conexão Google pendente'}
          </Badge>
        </div>
        <CardDescription>
          Planilhas na sua conta Google, com o link enviado aos destinatários escolhidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Sempre às 08h · horário da Bahia</p>
          <p className="mt-1 text-muted-foreground">
            Semanal: segunda-feira. Mensal: dia 1. Anual: 1º de janeiro. Cada envio considera o
            período anterior completo.
          </p>
        </div>
        <form onSubmit={salvarConfiguracao} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="relatorios-google">Conta Google que cria e envia</Label>
              <Input
                id="relatorios-google"
                type="email"
                required
                value={emailGoogle}
                onChange={(evento) => setEmailGoogle(evento.target.value)}
                placeholder="seuemail@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relatorios-destinatarios">Destinatários dos relatórios</Label>
              <Input
                id="relatorios-destinatarios"
                type="email"
                multiple
                required
                value={destinatarios}
                onChange={(evento) => setDestinatarios(evento.target.value)}
                placeholder="Separe os e-mails por vírgula"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="relatorios-conexao">URL de conexão do Google</Label>
            <Input
              id="relatorios-conexao"
              type="url"
              value={webhookUrl}
              onChange={(evento) => setWebhookUrl(evento.target.value)}
              placeholder="Cole aqui a URL fornecida na implantação"
            />
            <p className="text-xs text-muted-foreground">
              Primeiro salve os e-mails e prepare a integração. Depois cole a URL de conexão e salve
              novamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="relatorios-agenda"
              checked={ativo && !conexaoAlterada}
              disabled={!configuracao.googleConfigurado || conexaoAlterada}
              onCheckedChange={(marcado) => setAtivo(marcado === true)}
            />
            <Label htmlFor="relatorios-agenda">Ativar os envios automáticos</Label>
          </div>
          {!configuracao.googleConfigurado && (
            <p className="text-xs text-muted-foreground">
              Conclua e salve a conexão Google para ativar a agenda.
            </p>
          )}
          {emailsAlterados && configuracao.emailGoogle && (
            <p className="text-xs text-amber-500">
              Ao mudar a conta ou os destinatários, a agenda será pausada. Prepare e implante
              novamente o código para aplicar os novos e-mails.
            </p>
          )}
          {salvar.error && (
            <p role="alert" className="text-sm text-destructive">
              {salvar.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar configuração'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !configuracao.emailGoogle ||
                emailsAlterados ||
                preparar.isPending ||
                salvar.isPending
              }
              onClick={() => preparar.mutate()}
            >
              {preparar.isPending ? 'Preparando…' : 'Preparar integração Google'}
            </Button>
          </div>
          {preparar.error && (
            <p role="alert" className="text-sm text-destructive">
              {preparar.error.message}
            </p>
          )}
        </form>
      </CardContent>
      <Dialog
        open={codigo !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCodigo(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conectar sua conta Google</DialogTitle>
            <DialogDescription>
              Autorize a criação de planilhas e o envio de e-mails na conta informada.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Abra o Google Apps Script com <strong>{configuracao.emailGoogle}</strong>, crie um
              projeto e cole o código abaixo.
            </li>
            <li>
              Selecione a função <code>autorizarIntegracao</code>, clique em Executar e conceda as
              permissões solicitadas.
            </li>
            <li>
              Em Implantar → Nova implantação, escolha App da Web. Selecione Executar como eu e
              acesso para Qualquer pessoa.
            </li>
            <li>
              Copie a URL terminada em <code>/exec</code>. Cole no campo URL de conexão desta página
              e salve.
            </li>
            <li>Ative os envios automáticos e salve a configuração.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void copiarCodigo()}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? 'Código copiado' : 'Copiar código'}
            </Button>
            <Button asChild variant="outline">
              <a href="https://script.google.com" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Abrir Google Apps Script
              </a>
            </Button>
          </div>
          <Textarea
            aria-label="Código da integração Google"
            readOnly
            value={codigo ?? ''}
            className="h-52 font-mono text-xs"
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
