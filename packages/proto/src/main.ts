import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env["PORT"] ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${String(port)}`);
}

void bootstrap();
