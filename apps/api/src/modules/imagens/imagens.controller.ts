import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  OrigemImagemEnum,
  ProdutoImagemUpdateSchema,
  type OrigemImagem,
  type ProdutoImagemUpdate,
} from '@mahou-hub/contracts';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ImagensService } from './imagens.service';

@ApiTags('imagens')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('produtos/:produtoId/imagens')
export class ImagensController {
  constructor(private readonly service: ImagensService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('arquivos', 10)) // máximo 10 arquivos por request
  upload(
    @Param('produtoId') produtoId: string,
    @UploadedFiles() arquivos: Express.Multer.File[],
    @Query('origem') origem?: string,
  ) {
    const origemValidada: OrigemImagem = origem
      ? OrigemImagemEnum.parse(origem)
      : 'OUTRA';
    return this.service.upload(produtoId, arquivos ?? [], origemValidada);
  }

  @Patch(':imagemId')
  update(
    @Param('produtoId') produtoId: string,
    @Param('imagemId') imagemId: string,
    @Body(new ZodValidationPipe(ProdutoImagemUpdateSchema)) data: ProdutoImagemUpdate,
  ) {
    return this.service.update(produtoId, imagemId, data);
  }

  @Delete(':imagemId')
  remove(@Param('produtoId') produtoId: string, @Param('imagemId') imagemId: string) {
    return this.service.remove(produtoId, imagemId);
  }
}
