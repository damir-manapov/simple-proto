import { Injectable } from "@nestjs/common";
import { MemoryStorage } from "@simple-proto/storage-memory";
import type { Entry } from "@simple-proto/storage-types";

export type { Entry };

@Injectable()
export class StorageService extends MemoryStorage {}
