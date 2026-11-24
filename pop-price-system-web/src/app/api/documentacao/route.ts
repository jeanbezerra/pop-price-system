import { apiBaseUrl, apiDocumentationEnabled } from "@/lib/api";

export function GET() {
  if (!apiDocumentationEnabled()) return new Response(null, { status: 404 });
  return Response.redirect(new URL("swagger-ui.html", apiBaseUrl()), 307);
}
