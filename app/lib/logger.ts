import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

export const logger = {
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (isProduction) {
      Sentry.addBreadcrumb({
        message: args.map(arg => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
        level: "info",
      });
    } else {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isProduction) {
      Sentry.addBreadcrumb({
        message: args.map(arg => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
        level: "warning",
      });
    } else {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    if (isProduction) {
      const error = args.find(arg => arg instanceof Error);
      if (error) {
        Sentry.captureException(error);
      }
      Sentry.addBreadcrumb({
        message: args.map(arg => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
        level: "error",
      });
    } else {
      console.error(...args);
    }
  },
};
