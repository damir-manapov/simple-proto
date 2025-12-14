import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import type { AggregateRow, Entry } from "@simple-proto/storage";

interface CreateDto {
  collection: string;
  data: Record<string, unknown>;
}

interface UpdateDto {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

interface AggregateDto {
  collection: string;
  options: {
    filter?: Record<string, unknown>;
    groupBy?: string[];
    select: Record<string, unknown>;
    having?: Record<string, unknown>;
  };
}

// Helper type for API responses
type EntityResponse = Entry & Record<string, unknown>;

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("collections")
  registerCollection(@Body() body: { name: string; schema: Record<string, unknown> }): {
    success: boolean;
  } {
    this.storageService.registerCollection({ name: body.name, schema: body.schema });
    return { success: true };
  }

  @Get("collections")
  getCollections(): { collections: string[] } {
    return { collections: this.storageService.getCollections() };
  }

  @Get("collections/:name")
  hasCollection(@Param("name") name: string): { exists: boolean } {
    return { exists: this.storageService.hasCollection(name) };
  }

  @Post("entities")
  create(@Body() body: CreateDto): EntityResponse {
    this.ensureCollection(body.collection);
    const repo = this.storageService.getRepository<EntityResponse>(body.collection);
    return repo.create(body.data as { id?: string });
  }

  @Get("entities/:collection")
  findAll(@Param("collection") collection: string): EntityResponse[] {
    this.ensureCollection(collection);
    const repo = this.storageService.getRepository<EntityResponse>(collection);
    return repo.findAll();
  }

  @Get("entities/:collection/:id")
  findById(@Param("collection") collection: string, @Param("id") id: string): EntityResponse {
    this.ensureCollection(collection);
    const repo = this.storageService.getRepository<EntityResponse>(collection);
    const entity = repo.findById(id);
    if (!entity) {
      throw new NotFoundException(`Entity ${id} not found in ${collection}`);
    }
    return entity;
  }

  @Put("entities")
  update(@Body() body: UpdateDto): EntityResponse {
    this.ensureCollection(body.collection);
    const repo = this.storageService.getRepository<EntityResponse>(body.collection);
    const updated = repo.update(body.id, body.data as EntityResponse);
    if (!updated) {
      throw new NotFoundException(`Entity ${body.id} not found in ${body.collection}`);
    }
    return updated;
  }

  @Delete("entities/:collection/:id")
  delete(@Param("collection") collection: string, @Param("id") id: string): { success: boolean } {
    this.ensureCollection(collection);
    const repo = this.storageService.getRepository(collection);
    const deleted = repo.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Entity ${id} not found in ${collection}`);
    }
    return { success: true };
  }

  @Delete("entities/:collection")
  clear(@Param("collection") collection: string): { success: boolean } {
    this.ensureCollection(collection);
    const repo = this.storageService.getRepository(collection);
    repo.clear();
    return { success: true };
  }

  @Post("aggregate")
  aggregate(@Body() body: AggregateDto): AggregateRow | AggregateRow[] {
    this.ensureCollection(body.collection);
    const repo = this.storageService.getRepository<EntityResponse>(body.collection);
    // Cast options since the API accepts dynamic field names
    return repo.aggregate(body.options as Parameters<typeof repo.aggregate>[0]);
  }

  private ensureCollection(name: string): void {
    if (!this.storageService.hasCollection(name)) {
      throw new BadRequestException(`Collection ${name} not registered`);
    }
  }
}
