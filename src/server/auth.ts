import "server-only";

import { db } from "@/db";

import { crearAuth } from "./auth-config";

export const auth = crearAuth(db);
