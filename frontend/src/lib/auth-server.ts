import { betterAuth } from "better-auth";
import { jwt, admin, twoFactor, organization } from "better-auth/plugins";
import { Pool } from "pg";
import nodemailer from "nodemailer";

const port = process.env.FRONTEND_PORT || "3000";

const smtpPort = Number(process.env.SMTP_PORT || 1025);
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
    : undefined,
});

const smtpFrom = process.env.SMTP_FROM || "noreply@platzhalter.local";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    async sendVerificationEmail({ user, token }) {
      const baseURL = process.env.BETTER_AUTH_URL || `http://localhost:${port}`;
      const verifyURL = `${baseURL}/verify-email?token=${token}`;
      await smtpTransport.sendMail({
        from: smtpFrom,
        to: user.email,
        subject: "Verify your email — Platzhalter",
        text: `Hi ${user.name},\n\nPlease verify your email address by clicking the link below:\n\n${verifyURL}\n\nIf you did not create an account, you can ignore this email.`,
        html: `<p>Hi <strong>${user.name}</strong>,</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyURL}">Verify email</a></p><p>If you did not create an account, you can ignore this email.</p>`,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "moderator",
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "moderator",
    }),
    twoFactor({
      issuer: "Platzhalter",
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
        issuer: "platzhalter",
        audience: "platzhalter-api",
      },
      jwks: {
        keyPairConfig: {
          alg: "RS256",
        },
      },
    }),
    organization({
      async sendInvitationEmail({ id, email, organization, inviter }) {
        const baseURL = process.env.BETTER_AUTH_URL || `http://localhost:${port}`;
        const acceptURL = `${baseURL}/accept-invitation?id=${id}`;
        await smtpTransport.sendMail({
          from: smtpFrom,
          to: email,
          subject: `Invitation to join ${organization.name}`,
          text: `${inviter.user.name} invited you to join "${organization.name}" on Platzhalter.\n\nAccept the invitation: ${acceptURL}`,
          html: `<p><strong>${inviter.user.name}</strong> invited you to join <strong>${organization.name}</strong> on Platzhalter.</p><p><a href="${acceptURL}">Accept invitation</a></p>`,
        });
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    `http://localhost:${process.env.FRONTEND_PORT || "3000"}`,
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
});
