const API_URL = __DEV__ ? "http://10.0.2.2:3000" : "https://api.doe-tocantins.com";

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  token?: string | null;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export async function apiRequest<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { method, path, body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: data.message ?? "Request failed",
        status: response.status,
      };
    }

    return { data: data as T, error: null, status: response.status };
  } catch {
    return { data: null, error: "Network error", status: 0 };
  }
}
