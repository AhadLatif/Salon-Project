/*
Responsibility

Describe what valid configuration looks like.

Example:

Server
HOST
PORT

Database
DATABASE_URL

Logging
LOG_LEVEL

This file knows nothing about Express, PostgreSQL, or the rest of the application.

It only knows what is valid.
*/


import { z } from "zod";

export const environmentSchema = z.object({

  
  NODE_ENV: z.enum(["development", "test", "production"]),
  
  APP_NAME : z.string().min(1).default("Salon-Project"),


  HOST: z.string().default("0.0.0.0"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000), // <-- default port is 3000 while validation

   LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

    DATABASE_URL:z.url(),

});

export type Environment = z.infer<typeof environmentSchema>;