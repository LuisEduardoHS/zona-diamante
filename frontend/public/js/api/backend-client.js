import { runtimeConfig } from "../app/runtime-config.js";
import { supabase } from "../services/supabase-client.js";


const { BACKEND_API_URL } = runtimeConfig;


export class BackendApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.data = data;
  }
}


function construirUrl(path) {
  if (!BACKEND_API_URL) {
    throw new BackendApiError(
      "La URL del backend no está configurada."
    );
  }

  const baseUrl = BACKEND_API_URL.replace(/\/+$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${endpoint}`;
}


async function obtenerAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new BackendApiError(
      "No fue posible obtener la sesión actual."
    );
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new BackendApiError(
      "Debes iniciar sesión para realizar esta operación.",
      401
    );
  }

  return accessToken;
}


export async function solicitarBackend(
  path,
  {
    method = "GET",
    body = null,
    headers = {},
    authenticated = true,
  } = {}
) {
  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");

  if (authenticated) {
    const accessToken = await obtenerAccessToken();

    requestHeaders.set(
      "Authorization",
      `Bearer ${accessToken}`
    );
  }

  let requestBody = body;

  if (
    body !== null &&
    !(body instanceof FormData) &&
    typeof body !== "string"
  ) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(construirUrl(path), {
      method,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch {
    throw new BackendApiError(
      "No fue posible conectar con el backend."
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  let data = null;

  if (response.status !== 204) {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      typeof data.detail === "string"
        ? data.detail
        : `El backend respondió con estado ${response.status}.`;

    throw new BackendApiError(
      message,
      response.status,
      data
    );
  }

  return data;
}


export function obtenerUsuarioBackend() {
  return solicitarBackend("/api/v1/me");
}