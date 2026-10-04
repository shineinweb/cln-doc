import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  SetMetadata,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  accessDirectorySchema,
  accessPermissionInputSchema,
  accessPermissionSchema,
  accessRoleInputSchema,
  accessRoleSchema,
  accessUserInputSchema,
  accessUserSchema,
  recordRemovedSchema,
  type AccessPermissionInput,
  type AccessRoleInput,
  type AccessUserInput,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PERMISSIONS_KEY, RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccessService } from './access.service';

@Controller('access')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('access.manage')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get()
  async directory(@CurrentUser() user: SessionUser) {
    return accessDirectorySchema.parse(await this.access.directory(user));
  }

  @Post('users')
  async createUser(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(accessUserInputSchema)) body: AccessUserInput,
  ) {
    return accessUserSchema.parse(await this.access.createUser(user, body));
  }

  @Patch('users/:userId')
  async updateUser(
    @CurrentUser() user: SessionUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(accessUserInputSchema)) body: AccessUserInput,
  ) {
    return accessUserSchema.parse(await this.access.updateUser(user, userId, body));
  }

  @Delete('users/:userId')
  async deleteUser(@CurrentUser() user: SessionUser, @Param('userId') userId: string) {
    return recordRemovedSchema.parse(await this.access.deleteUser(user, userId));
  }

  @Post('users/:userId/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @CurrentUser() user: SessionUser,
    @Param('userId') userId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    return accessUserSchema.parse(await this.access.setPhoto(user, userId, file));
  }

  @Get('users/:userId/photo')
  @SetMetadata(PERMISSIONS_KEY, [])
  async downloadPhoto(@CurrentUser() user: SessionUser, @Param('userId') userId: string): Promise<StreamableFile> {
    const file = await this.access.readPhoto(user, userId);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `inline; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Delete('users/:userId/photo')
  async deletePhoto(@CurrentUser() user: SessionUser, @Param('userId') userId: string) {
    return accessUserSchema.parse(await this.access.clearPhoto(user, userId));
  }

  @Post('roles')
  async createRole(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(accessRoleInputSchema)) body: AccessRoleInput,
  ) {
    return accessRoleSchema.parse(await this.access.createRole(user, body));
  }

  @Patch('roles/:roleId')
  async updateRole(
    @CurrentUser() user: SessionUser,
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(accessRoleInputSchema)) body: AccessRoleInput,
  ) {
    return accessRoleSchema.parse(await this.access.updateRole(user, roleId, body));
  }

  @Delete('roles/:roleId')
  async deleteRole(@CurrentUser() user: SessionUser, @Param('roleId') roleId: string) {
    return recordRemovedSchema.parse(await this.access.deleteRole(user, roleId));
  }

  @Post('permissions')
  async createPermission(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(accessPermissionInputSchema)) body: AccessPermissionInput,
  ) {
    return accessPermissionSchema.parse(await this.access.createPermission(user, body));
  }

  @Patch('permissions/:permissionId')
  async updatePermission(
    @CurrentUser() user: SessionUser,
    @Param('permissionId') permissionId: string,
    @Body(new ZodValidationPipe(accessPermissionInputSchema)) body: AccessPermissionInput,
  ) {
    return accessPermissionSchema.parse(await this.access.updatePermission(user, permissionId, body));
  }

  @Delete('permissions/:permissionId')
  async deletePermission(@CurrentUser() user: SessionUser, @Param('permissionId') permissionId: string) {
    return recordRemovedSchema.parse(await this.access.deletePermission(user, permissionId));
  }
}
