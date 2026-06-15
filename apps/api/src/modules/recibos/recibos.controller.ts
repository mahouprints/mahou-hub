import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ReciboCreateSchema,
  ReciboUpdateSchema,
  type ReciboCreate,
  type ReciboUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RecibosService } from './recibos.service';

@ApiTags('recibos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('recibos')
export class RecibosController {
  constructor(private readonly service: RecibosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(ReciboCreateSchema)) data: ReciboCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReciboUpdateSchema)) data: ReciboUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/arquivos')
  @UseInterceptors(FilesInterceptor('arquivos', 10))
  addArquivos(@Param('id') id: string, @UploadedFiles() arquivos: Express.Multer.File[]) {
    return this.service.addArquivos(id, arquivos ?? []);
  }

  @Delete(':id/arquivos/:arquivoId')
  removeArquivo(@Param('id') id: string, @Param('arquivoId') arquivoId: string) {
    return this.service.removeArquivo(id, arquivoId);
  }
}
