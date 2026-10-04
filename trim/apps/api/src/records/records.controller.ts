import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  alertRuleEditSchema,
  batchInputSchema,
  cycleEditSchema,
  harvestEditSchema,
  packageEditSchema,
  plantCreateSchema,
  plantEditSchema,
  readingEditSchema,
  recordRemovedSchema,
  sopEditSchema,
  submissionEditSchema,
  taskCreateSchema,
  taskEditSchema,
  templateEditSchema,
  weightEditSchema,
  type AlertRuleEdit,
  type BatchInput,
  type CycleEdit,
  type HarvestEdit,
  type PackageEdit,
  type PlantCreate,
  type PlantEdit,
  type ReadingEdit,
  type SessionUser,
  type SopEdit,
  type SubmissionEdit,
  type TaskEdit,
  type TemplateEdit,
  type WeightEdit,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RecordsService } from './records.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Patch('cycles/:cycleId')
  @RequirePermissions('tasks.write')
  async editCycle(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(cycleEditSchema)) body: CycleEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editCycle(user, cycleId, body));
  }

  @Delete('cycles/:cycleId')
  @RequirePermissions('tasks.write')
  async deleteCycle(@CurrentUser() user: SessionUser, @Param('cycleId') cycleId: string) {
    return recordRemovedSchema.parse(await this.records.deleteCycle(user, cycleId));
  }

  @Post('cycles/:cycleId/tasks')
  async addTask(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(taskCreateSchema)) body: TaskEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.addTask(user, cycleId, body));
  }

  @Patch('tasks/:taskId')
  @RequirePermissions('tasks.write')
  async editTask(
    @CurrentUser() user: SessionUser,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(taskEditSchema)) body: TaskEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editTask(user, taskId, body));
  }

  @Delete('tasks/:taskId')
  @RequirePermissions('tasks.write')
  async deleteTask(@CurrentUser() user: SessionUser, @Param('taskId') taskId: string) {
    return recordRemovedSchema.parse(await this.records.deleteTask(user, taskId));
  }

  @Patch('workflows/templates/:templateId')
  @RequirePermissions('workflows.manage')
  async editTemplate(
    @CurrentUser() user: SessionUser,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(templateEditSchema)) body: TemplateEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editTemplate(user, templateId, body));
  }

  @Delete('workflows/templates/:templateId')
  @RequirePermissions('workflows.manage')
  async deleteTemplate(@CurrentUser() user: SessionUser, @Param('templateId') templateId: string) {
    return recordRemovedSchema.parse(await this.records.deleteTemplate(user, templateId));
  }

  @Patch('workflows/sops/:sopId')
  @RequirePermissions('workflows.manage')
  async editSop(
    @CurrentUser() user: SessionUser,
    @Param('sopId') sopId: string,
    @Body(new ZodValidationPipe(sopEditSchema)) body: SopEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editSop(user, sopId, body));
  }

  @Delete('workflows/sops/:sopId')
  @RequirePermissions('workflows.manage')
  async deleteSop(@CurrentUser() user: SessionUser, @Param('sopId') sopId: string) {
    return recordRemovedSchema.parse(await this.records.deleteSop(user, sopId));
  }

  @Patch('readings/:readingId')
  @RequirePermissions('rooms.write')
  async editReading(
    @CurrentUser() user: SessionUser,
    @Param('readingId') readingId: string,
    @Body(new ZodValidationPipe(readingEditSchema)) body: ReadingEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editReading(user, readingId, body));
  }

  @Delete('readings/:readingId')
  @RequirePermissions('rooms.write')
  async deleteReading(@CurrentUser() user: SessionUser, @Param('readingId') readingId: string) {
    return recordRemovedSchema.parse(await this.records.deleteReading(user, readingId));
  }

  @Patch('alert-rules/:ruleId')
  async editRule(
    @CurrentUser() user: SessionUser,
    @Param('ruleId') ruleId: string,
    @Body(new ZodValidationPipe(alertRuleEditSchema)) body: AlertRuleEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editAlertRule(user, ruleId, body));
  }

  @Delete('alert-rules/:ruleId')
  async deleteRule(@CurrentUser() user: SessionUser, @Param('ruleId') ruleId: string) {
    return recordRemovedSchema.parse(await this.records.deleteAlertRule(user, ruleId));
  }

  @Patch('harvests/:harvestId')
  @RequirePermissions('harvests.write')
  async editHarvest(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(harvestEditSchema)) body: HarvestEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editHarvest(user, harvestId, body));
  }

  @Delete('harvests/:harvestId')
  async voidHarvest(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string) {
    return recordRemovedSchema.parse(await this.records.voidHarvest(user, harvestId));
  }

  @Patch('harvest-steps/:stepId')
  async editStep(
    @CurrentUser() user: SessionUser,
    @Param('stepId') stepId: string,
    @Body(new ZodValidationPipe(weightEditSchema)) body: WeightEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editStep(user, stepId, body));
  }

  @Delete('harvest-steps/:stepId')
  async voidStep(@CurrentUser() user: SessionUser, @Param('stepId') stepId: string) {
    return recordRemovedSchema.parse(await this.records.voidStep(user, stepId));
  }

  @Patch('wastes/:wasteId')
  @RequirePermissions('harvests.write')
  async editWaste(
    @CurrentUser() user: SessionUser,
    @Param('wasteId') wasteId: string,
    @Body(new ZodValidationPipe(weightEditSchema)) body: WeightEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editWaste(user, wasteId, body));
  }

  @Delete('wastes/:wasteId')
  async voidWaste(@CurrentUser() user: SessionUser, @Param('wasteId') wasteId: string) {
    return recordRemovedSchema.parse(await this.records.voidWaste(user, wasteId));
  }

  @Patch('packages/:packageId')
  @RequirePermissions('harvests.write')
  async editPackage(
    @CurrentUser() user: SessionUser,
    @Param('packageId') packageId: string,
    @Body(new ZodValidationPipe(packageEditSchema)) body: PackageEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editPackage(user, packageId, body));
  }

  @Delete('packages/:packageId')
  async voidPackage(@CurrentUser() user: SessionUser, @Param('packageId') packageId: string) {
    return recordRemovedSchema.parse(await this.records.voidPackage(user, packageId));
  }

  @Patch('submissions/:submissionId')
  @RequirePermissions('compliance.write')
  async editSubmission(
    @CurrentUser() user: SessionUser,
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(submissionEditSchema)) body: SubmissionEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editSubmission(user, submissionId, body));
  }

  @Delete('submissions/:submissionId')
  async voidSubmission(@CurrentUser() user: SessionUser, @Param('submissionId') submissionId: string) {
    return recordRemovedSchema.parse(await this.records.voidSubmission(user, submissionId));
  }

  @Patch('plants/:plantId')
  @RequirePermissions('inventory.write')
  async editPlant(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(plantEditSchema)) body: PlantEdit,
  ) {
    return recordRemovedSchema.parse(await this.records.editPlant(user, plantId, body));
  }

  @Delete('plants/:plantId')
  async voidPlant(@CurrentUser() user: SessionUser, @Param('plantId') plantId: string) {
    return recordRemovedSchema.parse(await this.records.voidPlant(user, plantId));
  }

  @Post('licenses/:licenseId/batches')
  async addBatch(
    @CurrentUser() user: SessionUser,
    @Param('licenseId') licenseId: string,
    @Body(new ZodValidationPipe(batchInputSchema)) body: BatchInput,
  ) {
    return recordRemovedSchema.parse(await this.records.addBatch(user, licenseId, body));
  }

  @Patch('batches/:batchId')
  @RequirePermissions('inventory.write')
  async editBatch(
    @CurrentUser() user: SessionUser,
    @Param('batchId') batchId: string,
    @Body(new ZodValidationPipe(batchInputSchema)) body: BatchInput,
  ) {
    return recordRemovedSchema.parse(await this.records.editBatch(user, batchId, body));
  }

  @Delete('batches/:batchId')
  @RequirePermissions('inventory.write')
  async deleteBatch(@CurrentUser() user: SessionUser, @Param('batchId') batchId: string) {
    return recordRemovedSchema.parse(await this.records.deleteBatch(user, batchId));
  }

  @Post('licenses/:licenseId/plants')
  async addPlant(
    @CurrentUser() user: SessionUser,
    @Param('licenseId') licenseId: string,
    @Body(new ZodValidationPipe(plantCreateSchema)) body: PlantCreate,
  ) {
    return recordRemovedSchema.parse(await this.records.addPlant(user, licenseId, body));
  }
}
