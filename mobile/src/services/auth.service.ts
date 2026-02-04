import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import { Platform } from "react-native";
import { apiRequest } from "./api.client";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    provider: string;
  };
}

export function configureGoogleSignIn(webClientId: string) {
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
}

export async function signInWithGoogle(): Promise<AuthResponse> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!response.data?.idToken) {
    throw new Error("Google Sign-In failed: no ID token received");
  }

  const result = await apiRequest<AuthResponse>({
    method: "POST",
    path: "/auth/google",
    body: { idToken: response.data.idToken },
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Authentication failed");
  }

  return result.data;
}

export async function signInWithApple(): Promise<AuthResponse> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign-In is only available on iOS");
  }

  const appleResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const credentialState = await appleAuth.getCredentialStateForUser(
    appleResponse.user,
  );

  if (credentialState !== appleAuth.State.AUTHORIZED) {
    throw new Error("Apple Sign-In not authorized");
  }

  if (!appleResponse.identityToken) {
    throw new Error("Apple Sign-In failed: no identity token received");
  }

  const fullName = appleResponse.fullName
    ? `${appleResponse.fullName.givenName ?? ""} ${appleResponse.fullName.familyName ?? ""}`.trim()
    : undefined;

  const result = await apiRequest<AuthResponse>({
    method: "POST",
    path: "/auth/apple",
    body: {
      identityToken: appleResponse.identityToken,
      fullName: fullName || undefined,
    },
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Authentication failed");
  }

  return result.data;
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google sign out may fail if user signed in with Apple
  }
}

export function isGoogleSignInCancelledError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
  );
}
