// Lets plain Node run the app's TypeScript: resolves "@/..." and extensionless imports.
import { register } from "node:module";

register("./resolve.mjs", import.meta.url);
