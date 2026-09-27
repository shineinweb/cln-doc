import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class AiMessageDto {
  @IsIn(["system", "user", "assistant", "tool"])
  role!: "system" | "user" | "assistant" | "tool";

  @IsString()
  @MaxLength(20_000)
  content!: string;
}

export class CompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AiMessageDto)
  messages!: AiMessageDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;
}
