import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  signInWithGoogle,
  signInWithApple,
  signOut as oauthSignOut,
  isGoogleSignInCancelledError,
} from "../services/auth.service";
import { apiRequest } from "../services/api.client";
import {
  requestNotificationPermission,
  registerFcmToken,
  onTokenRefresh,
} from "../services/fcm.service";

const TOKEN_KEY = "doe_auth_token";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);

      if (!storedToken) {
        set({ isInitialized: true });
        return;
      }

      const result = await apiRequest<{ user: User }>({
        method: "GET",
        path: "/auth/me",
        token: storedToken,
      });

      if (result.data) {
        set({
          token: storedToken,
          user: result.data.user,
          isInitialized: true,
        });
        await setupFcmRegistration(storedToken);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
        set({ isInitialized: true });
      }
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      set({ isInitialized: true });
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await signInWithGoogle();
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      set({ user: response.user, token: response.token, isLoading: false });
      await setupFcmRegistration(response.token);
    } catch (error) {
      if (isGoogleSignInCancelledError(error)) {
        set({ isLoading: false });
        return;
      }
      const message =
        error instanceof Error ? error.message : "Google sign-in failed";
      set({ error: message, isLoading: false });
    }
  },

  loginWithApple: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await signInWithApple();
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      set({ user: response.user, token: response.token, isLoading: false });
      await setupFcmRegistration(response.token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Apple sign-in failed";
      set({ error: message, isLoading: false });
    }
  },

  logout: async () => {
    await oauthSignOut();
    await AsyncStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));

async function setupFcmRegistration(authToken: string): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    await registerFcmToken(authToken);

    onTokenRefresh(async () => {
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        await registerFcmToken(currentToken);
      }
    });
  } catch {
    // FCM registration is best-effort; don't block auth flow
  }
}
