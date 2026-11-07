import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "./app.css";

export function meta() {
  return [
    { title: "links" },
    { name: "description", content: "mural de links" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0a0a0a" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="bg-[#0a0a0a] text-neutral-300 min-h-screen selection:bg-neutral-800 selection:text-white">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "Ocorreu um erro";
  let details = "";

  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
    details = error.data || "";
  } else if (error instanceof Error) {
    message = error.message;
    details = error.stack || "";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-mono text-neutral-100">{message}</h1>
        {details && (
          <pre className="text-xs text-neutral-500 overflow-x-auto text-left p-3 bg-neutral-950 border border-neutral-900 rounded">
            {details}
          </pre>
        )}
        <a
          href="/"
          className="inline-block text-xs text-neutral-400 hover:text-neutral-100 underline underline-offset-4"
        >
          Voltar para o início
        </a>
      </div>
    </main>
  );
}

