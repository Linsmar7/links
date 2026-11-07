import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("entrar", "routes/entrar.tsx"),
  route("sair", "routes/sair.tsx"),
  route("gerenciar", "routes/gerenciar.tsx"),
  route("importar", "routes/importar.tsx"),
  route("img/:id", "routes/img.$id.ts"),
  route("api/preview", "routes/api.preview.ts"),
  route("api/import-status", "routes/api.import-status.ts"),
] satisfies RouteConfig;

