import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, "127.0.0.1", () => {
  console.log(" ChegaLogo - API");
  console.log(`Servidor: http://127.0.0.1:${env.PORT}`);
});
