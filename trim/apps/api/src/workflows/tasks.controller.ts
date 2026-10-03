import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  taskChecklistSchema,
  taskCommentSchema,
  taskEvidenceSchema,
  type SessionUser,
  type TaskChecklistInput,
  type TaskCommentInput,
  type TaskEvidenceInput,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TasksService } from './tasks.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('workspace/today')
  today(@CurrentUser() user: SessionUser) {
    return this.tasks.workspace(user);
  }

  @Get('tasks/:taskId')
  get(@CurrentUser() user: SessionUser, @Param('taskId') taskId: string) {
    return this.tasks.getTask(user, taskId);
  }

  @Post('tasks/:taskId/comments')
  comment(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(taskCommentSchema)) body: TaskCommentInput,
  ) {
    return this.tasks.comment(user, taskId, body);
  }

  @Post('tasks/:taskId/checklist')
  checklist(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(taskChecklistSchema)) body: TaskChecklistInput,
  ) {
    return this.tasks.checklist(user, taskId, body);
  }

  @Post('tasks/:taskId/evidence')
  evidence(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(taskEvidenceSchema)) body: TaskEvidenceInput,
  ) {
    return this.tasks.evidence(user, taskId, body);
  }

  @Post('tasks/:taskId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    return this.tasks.addAttachment(user, taskId, file);
  }

  @Get('tasks/:taskId/attachments/:attachmentId')
  async download(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<StreamableFile> {
    const file = await this.tasks.readAttachment(user, taskId, attachmentId);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }
}
