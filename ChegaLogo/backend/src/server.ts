
import { app } from "./app";
import { env } from "./config/env";
import { initDatabase } from "./database/initDatabase";

try {
  initDatabase();

  app.listen(env.PORT, "localhost", () => {
    console.log(" ChegaLogo - API");
    console.log(`Servidor: http://localhost:${env.PORT}`);
    console.log("Banco: SQLite");
  });
} catch (error) {
  console.error(
    "Não foi possível inicializar a ChegaLogo:",
    error
  );

  process.exit(1);
}
