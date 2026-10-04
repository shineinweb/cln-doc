import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachModule } from '../coach/coach.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule, CoachModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
