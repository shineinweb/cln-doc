import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  applyWorkflowSchema,
  createSopSchema,
  createTeamSchema,
  createWorkflowTemplateSchema,
  rescheduleCycleSchema,
  startCycleSchema,
  workflowVersionInputSchema,
  type ApplyWorkflow,
  type CreateSop,
  type CreateTeam,
  type CreateWorkflowTemplate,
  type RescheduleCycle,
  type SessionUser,
  type StartCycle,
  type WorkflowVersionInput,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkflowService } from './workflow.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get('workflows/directory')
  directory(@CurrentUser() user: SessionUser) {
    return this.workflows.directory(user);
  }

  @Post('workflows/sops')
  async createSop(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createSopSchema)) body: CreateSop) {
    const sop = await this.workflows.createSop(user, body);
    return { id: sop.id, title: sop.title, summary: sop.summary };
  }

  @Post('workflows/teams')
  async createTeam(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeam) {
    const team = await this.workflows.createTeam(user, body);
    return { id: team.id, name: team.name };
  }

  @Post('workflows/templates')
  createTemplate(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createWorkflowTemplateSchema)) body: CreateWorkflowTemplate,
  ) {
    return this.workflows.createTemplate(user, body);
  }

  @Post('workflows/templates/:templateId/versions')
  addVersion(
    @CurrentUser() user: SessionUser,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(workflowVersionInputSchema)) body: WorkflowVersionInput,
  ) {
    return this.workflows.addVersion(user, templateId, body);
  }

  @Post('cycles')
  startCycle(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(startCycleSchema)) body: StartCycle) {
    return this.workflows.startCycle(user, body);
  }

  @Post('cycles/:cycleId/workflow')
  apply(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(applyWorkflowSchema)) body: ApplyWorkflow,
  ) {
    return this.workflows.applyVersion(user, cycleId, body);
  }

  @Post('cycles/:cycleId/reschedule/preview')
  preview(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(rescheduleCycleSchema)) body: RescheduleCycle,
  ) {
    return this.workflows.previewReschedule(user, cycleId, body);
  }

  @Post('cycles/:cycleId/reschedule')
  confirm(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(rescheduleCycleSchema)) body: RescheduleCycle,
  ) {
    return this.workflows.confirmReschedule(user, cycleId, body);
  }
}
