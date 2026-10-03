import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachModule } from '../coach/coach.module';
import { StorageModule } from '../storage/storage.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [AuthModule, StorageModule, CoachModule],
  controllers: [WorkflowController, TasksController],
  providers: [WorkflowService, TasksService],
})
export class WorkflowsModule {}
