import { Injectable } from "@nestjs/common";
import { Storage } from "@simple-proto/storage";
import type { Entity } from "@simple-proto/storage";

export type { Entity };

@Injectable()
export class StorageService extends Storage {}
