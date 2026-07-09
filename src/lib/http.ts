import axios, { type AxiosError, type AxiosInstance } from "axios";

// One way to stand up a JSON API client: base URL, bearer auth, and a response
// interceptor that turns an axios error into a readable, service-specific message
// (axios's default message drops the request path and response body). Each caller
// supplies `describeError`; anything that isn't an axios error rethrows untouched.
//
// `attachErrorInterceptor` is exposed separately so a client that receives an
// injected axios instance (e.g. in tests) still gets the same readable errors.

export function createApiClient(options: {
  baseURL: string;
  apiKey: string;
  describeError: (error: AxiosError) => string;
}): AxiosInstance {
  const http = axios.create({
    baseURL: options.baseURL,
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
  });
  return attachErrorInterceptor(http, options.describeError);
}

export function attachErrorInterceptor(
  http: AxiosInstance,
  describeError: (error: AxiosError) => string,
): AxiosInstance {
  http.interceptors.response.use(undefined, (error) => {
    if (axios.isAxiosError(error)) throw new Error(describeError(error));
    throw error;
  });
  return http;
}
