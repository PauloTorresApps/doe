import { OAuth2Client } from "google-auth-library";
import * as jose from "jose";

export interface OAuthUserInfo {
  email: string;
  name: string;
  provider: string;
  providerId: string;
  avatarUrl?: string | null;
}

export class AuthService {
  private googleClient: OAuth2Client;
  private googleClientId: string;
  private appleClientId: string;

  constructor(config: { googleClientId: string; appleClientId: string }) {
    this.googleClientId = config.googleClientId;
    this.appleClientId = config.appleClientId;
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async validateGoogleToken(idToken: string): Promise<OAuthUserInfo> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("Invalid Google token: no payload");
    }

    if (!payload.sub || !payload.email) {
      throw new Error("Invalid Google token: missing required fields");
    }

    return {
      email: payload.email,
      name: payload.name ?? payload.email,
      provider: "google",
      providerId: payload.sub,
      avatarUrl: payload.picture ?? null,
    };
  }

  async validateAppleToken(identityToken: string): Promise<OAuthUserInfo> {
    const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
    const jwks = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));

    const { payload } = await jose.jwtVerify(identityToken, jwks, {
      issuer: "https://appleid.apple.com",
      audience: this.appleClientId,
    });

    if (!payload.sub) {
      throw new Error("Invalid Apple token: missing subject");
    }

    const email = (payload.email as string | undefined) ?? `${payload.sub}@privaterelay.appleid.com`;
    const name = (payload.name as string | undefined) ?? email;

    return {
      email,
      name,
      provider: "apple",
      providerId: payload.sub,
      avatarUrl: null,
    };
  }
}
