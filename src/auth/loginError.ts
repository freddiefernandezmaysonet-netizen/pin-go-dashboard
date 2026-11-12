export class LoginRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("LOGIN_REQUEST_FAILED");
    this.name = "LoginRequestError";
    this.status = status;
  }
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof LoginRequestError) {
    if (error.status === 0) {
      return "Unable to connect. Please try again / No se pudo conectar. Intenta nuevamente";
    }
    if (error.status === 401) {
      return "Sign-in rejected. Check your email and password / Acceso rechazado. Verifica tu correo y contraseña";
    }
    if (error.status === 429) {
      return "Too many attempts. Please try again later / Demasiados intentos. Intenta más tarde";
    }
    if (error.status === 403) {
      return "Access is not permitted / Acceso no permitido";
    }
  }
  return "We could not complete sign-in. Please try again / No pudimos completar el inicio de sesión. Intenta nuevamente";
}
