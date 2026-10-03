import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  queueSubmissionSchema,
  reconcileSubmissionSchema,
  reviewSubmissionSchema,
  type QueueSubmission,
  type ReconcileSubmission,
  type ReviewSubmission,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubmissionsService } from './submissions.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get('submissions/:submissionId')
  getOne(@CurrentUser() user: SessionUser, @Param('submissionId') submissionId: string) {
    return this.submissions.getOne(user, submissionId);
  }

  @Post('submissions')
  queue(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(queueSubmissionSchema)) body: QueueSubmission) {
    return this.submissions.queue(user, body);
  }

  @Post('submissions/:submissionId/review')
  review(
    @CurrentUser() user: SessionUser,
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(reviewSubmissionSchema)) body: ReviewSubmission,
  ) {
    return this.submissions.review(user, submissionId, body);
  }

  @Post('submissions/:submissionId/reconcile')
  reconcile(
    @CurrentUser() user: SessionUser,
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(reconcileSubmissionSchema)) body: ReconcileSubmission,
  ) {
    return this.submissions.reconcile(user, submissionId, body);
  }
}
