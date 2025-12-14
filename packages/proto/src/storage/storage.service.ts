import { Injectable } from "@nestjs/common";
import { Storage } from "@simple-proto/storage";
import type { Entry } from "@simple-proto/storage-types";

export type { Entry };

@Injectable()
export class StorageService extends Storage {}
