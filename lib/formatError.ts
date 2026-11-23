import { FRIENDLY_MESSAGE_MAX_LENGTH, FRIENDLY_MESSAGE_MIN_LENGTH } from "./constants";

export function getFriendlyErrorMessage(
  err: unknown,
  fallback: string = "Something went wrong. Please try again."
): string {
  if (!err) return fallback;

  
  let rawMsg = "";
  let status: number | undefined;

  if (typeof err === "string") {
    rawMsg = err;
  } else if (err instanceof Error) {
    rawMsg = err.message || "";
    const anyErr = err as any;
    status = anyErr?.response?.status || anyErr?.status;
    const backendData = anyErr?.response?.data;
    if (backendData?.message) {
      const bMsg = backendData.message;
      rawMsg = Array.isArray(bMsg) ? bMsg[0] : bMsg;
    }
  } else if (typeof err === "object") {
    const anyErr = err as any;
    status = anyErr?.response?.status || anyErr?.status;
    const backendMsg = anyErr?.response?.data?.message || anyErr?.message;
    rawMsg = Array.isArray(backendMsg) ? backendMsg[0] : backendMsg || "";
  }

  const lower = rawMsg.toLowerCase().trim();

 
  if (status === 401) {
    if (lower.includes("credential") || lower.includes("password") || lower.includes("email") || lower.includes("incorrect")) {
      return "Incorrect email or password. Please try again.";
    }
    return "Session expired. Please sign in again.";
  }

  if (status === 403) {
    if (lower.includes("not verified") || lower.includes("unverified") || lower.includes("otp")) {
      return "Your email address is not verified yet.";
    }
    return "Access restricted. You don't have permission for this action.";
  }

  if (status === 404) {
    return "Requested item was not found.";
  }

  if (status === 409 || lower.includes("already registered") || lower.includes("already exists") || lower.includes("duplicate key")) {
    return "An account with this email already exists.";
  }

  if (status === 413 || lower.includes("too large") || lower.includes("exceeds 1gb") || lower.includes("exceeds the maximum")) {
    return "File exceeds the 1GB limit. Please upload a smaller video.";
  }

  if (status === 429 || lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (status && status >= 500 && status < 600) {
    if (status === 503) {
      return "The service is warming up. Please try again in a moment.";
    }
    return "Server is temporarily unavailable. Please try again shortly.";
  }

 
  if (
    lower.includes("network error") ||
    lower.includes("failed to fetch") ||
    lower.includes("network_or_cors_error") ||
    lower.includes("err_connection") ||
    lower.includes("econnrefused") ||
    lower.includes("internet connection") ||
    lower.includes("cors")
  ) {
    return "Connection issue. Please check your internet and try again.";
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("econnaborted")) {
    return "Request timed out. Please try again.";
  }


  if (lower.includes("user declined") || lower.includes("user rejected") || lower.includes("cancelled") || lower.includes("denied")) {
    return "Transaction was cancelled in your wallet.";
  }

  if (lower.includes("tx_bad_seq") || lower.includes("sequence number mismatch")) {
    return "Transaction out of sync. Please try again.";
  }

  if (lower.includes("op_underfunded") || lower.includes("insufficient xlm") || lower.includes("insufficient balance") || lower.includes("underfunded")) {
    return "Insufficient balance in your wallet to complete this transaction.";
  }

  if (lower.includes("tx_bad_auth")) {
    return "Wallet signature invalid. Please check your wallet network and try again.";
  }

  if (lower.includes("tx_no_account") || lower.includes("account not found") || lower.includes("sender account not found")) {
    return "Wallet not activated. Please fund it with at least 2 XLM to activate.";
  }

  if (lower.includes("op_no_trust") || lower.includes("trustline")) {
    return "USDC trustline missing. Please enable USDC in your Freighter wallet.";
  }

  if (lower.includes("tx_too_late") || lower.includes("expired")) {
    return "Transaction expired before completion. Please try again.";
  }

  if (lower.includes("tx_insufficient_fee")) {
    return "Transaction fee was too low. Please retry.";
  }

  if (lower.includes("stellar transaction failed")) {
    return "Transaction could not be completed. Please try again.";
  }

 
  if (lower.includes("invalid or expired") || lower.includes("invalid otp") || lower.includes("code is invalid")) {
    return "Invalid or expired verification code. Please try again.";
  }

  
  const isCodeOrJson = rawMsg.includes("{") || rawMsg.includes("}") || rawMsg.includes("at ") || rawMsg.includes("SELECT ") || rawMsg.includes("INSERT ") || rawMsg.includes("status code");
  if (rawMsg && rawMsg.length > FRIENDLY_MESSAGE_MIN_LENGTH && rawMsg.length <= FRIENDLY_MESSAGE_MAX_LENGTH && !isCodeOrJson) {
    
    const trimmed = rawMsg.trim();
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return formatted.endsWith(".") ? formatted : `${formatted}.`;
  }

  return fallback;
}

