import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import admin from "firebase-admin";
import { deleteApp } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import type { Messaging } from "firebase-admin/messaging";

declare module "fastify" {
  interface FastifyInstance {
    firebase: App;
    fcm: Messaging;
  }
}

async function firebasePlugin(fastify: FastifyInstance) {
  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let app: App;

  if (credentialPath) {
    const serviceAccount = await import(credentialPath, { with: { type: "json" } });
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount.default ?? serviceAccount),
    });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Application Default Credentials (e.g., running on GCP)
    app = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    fastify.log.warn(
      "No Firebase credentials configured. FCM notifications will not be available.",
    );
    return;
  }

  const messaging = admin.messaging(app);

  fastify.decorate("firebase", app);
  fastify.decorate("fcm", messaging);

  fastify.log.info("Firebase Admin SDK initialized successfully");

  fastify.addHook("onClose", async () => {
    await deleteApp(app);
  });
}

export default fp(firebasePlugin, { name: "firebase" });
