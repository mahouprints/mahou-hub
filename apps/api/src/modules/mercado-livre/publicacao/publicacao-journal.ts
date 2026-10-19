import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import type { PublicacaoEntrada } from './publicacao-schema';
import { PublicacaoErro } from './publicacao-erro';

export interface RegistroItem {
  estado: 'INTENCAO' | 'CRIADO';
  itemId?: string;
  descricaoConfirmada?: boolean;
  fiscalConfirmado?: boolean;
  verificado?: boolean;
  variationIds?: Record<string, string>;
  userProductId?: string;
  familyId?: string;
  permalink?: string;
}
export interface JournalPublicacao {
  versao: 1;
  execucaoId: string;
  hash: string;
  itens: Record<string, RegistroItem>;
}

/** Journal privado com lock por vendedor; ex.: abrir antes de validar/publicar o lote. */
export class PublicacaoJournal {
  private readonly diretorio: string;
  private readonly lock: string;
  constructor(storage: string, sellerId: string) {
    if (!/^\d+$/.test(sellerId)) throw new PublicacaoErro('Vendedor configurado inválido.');
    this.diretorio = join(storage, 'ml-publicacoes');
    this.lock = join(this.diretorio, `${sellerId}.lock`);
  }

  /** Garante exclusão entre execuções; lock de processo vivo nunca é removido. */
  async adquirir(): Promise<() => Promise<void>> {
    await mkdir(this.diretorio, { recursive: true, mode: 0o700 });
    await this.removerLockMorto();
    const arquivo = await open(this.lock, 'wx', 0o600);
    await arquivo.writeFile(JSON.stringify({ pid: process.pid, host: hostname() }));
    await arquivo.sync();
    await arquivo.close();
    return async () => {
      await unlink(this.lock);
    };
  }

  /** Retoma somente o mesmo conteúdo, sem depender do modo de execução. */
  async carregar(entrada: PublicacaoEntrada): Promise<JournalPublicacao> {
    const { modo: _modo, ...plano } = entrada;
    const hash = createHash('sha256').update(JSON.stringify(plano)).digest('hex');
    const caminho = this.caminho(entrada.execucaoId);
    try {
      const salvo = JSON.parse(await readFile(caminho, 'utf8')) as JournalPublicacao;
      if (salvo.hash !== hash || salvo.execucaoId !== entrada.execucaoId || salvo.versao !== 1)
        throw new PublicacaoErro('Execução já existe com conteúdo diferente.');
      return salvo;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
      return { versao: 1, execucaoId: entrada.execucaoId, hash, itens: {} };
    }
  }

  /** Persiste intenção e IDs antes do próximo efeito externo. */
  async salvar(journal: JournalPublicacao): Promise<void> {
    const caminho = this.caminho(journal.execucaoId);
    const temporario = `${caminho}.tmp`;
    const arquivo = await open(temporario, 'w', 0o600);
    await arquivo.writeFile(JSON.stringify(journal));
    await arquivo.sync();
    await arquivo.close();
    await rename(temporario, caminho);
    // Linux garante a persistência do rename após fsync do diretório.
    if (process.platform === 'win32') return;
    const diretorio = await open(this.diretorio, 'r');
    await diretorio.sync();
    await diretorio.close();
  }

  private caminho(execucaoId: string): string {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(execucaoId))
      throw new PublicacaoErro('Identificador de execução inválido.');
    return join(this.diretorio, `${execucaoId}.json`);
  }

  private async removerLockMorto(): Promise<void> {
    try {
      const salvo = JSON.parse(await readFile(this.lock, 'utf8')) as { pid: number; host: string };
      if (salvo.host !== hostname() || !Number.isSafeInteger(salvo.pid) || salvo.pid <= 0) return;
      try {
        process.kill(salvo.pid, 0);
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ESRCH') await unlink(this.lock);
      }
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
    }
  }
}
