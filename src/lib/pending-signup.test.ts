import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeVerificationCode,
  parsePendingSignup,
  readableAuthError,
  resendCodeError,
  resendCooldownSeconds,
  serializePendingSignup,
  verificationCodeError,
} from "./pending-signup.ts";

describe("pending signup cookie", () => {
  test("round-trips the email and stage", () => {
    const value = serializePendingSignup({
      email: "You@Example.com",
      stage: "verify",
    });
    assert.deepEqual(parsePendingSignup(value), {
      email: "You@Example.com",
      stage: "verify",
    });
  });

  test("replaces an empty provider error with a readable fallback", () => {
    assert.equal(
      readableAuthError(
        { message: "{}" },
        "Couldn't send the verification email. Try again.",
      ),
      "Couldn't send the verification email. Try again.",
    );
    assert.equal(
      readableAuthError({ message: "User already registered" }, "fallback"),
      "User already registered",
    );
  });

  test("rejects a password-shaped or malformed value", () => {
    assert.equal(parsePendingSignup(null), null);
    assert.equal(parsePendingSignup("verify"), null);
    assert.equal(parsePendingSignup("secret:hunter2"), null);
    assert.equal(parsePendingSignup("verify:%"), null);
  });
});

describe("verification code", () => {
  test("keeps six digits from typed or pasted text", () => {
    assert.equal(normalizeVerificationCode("12 34-56"), "123456");
    assert.equal(normalizeVerificationCode("code 1234567"), "123456");
    assert.equal(normalizeVerificationCode("abc"), "");
  });

  test("describes incorrect, expired, and rate-limited codes", () => {
    assert.equal(
      verificationCodeError("Token has expired or is invalid", "otp_expired"),
      "That code has expired. Request a new one.",
    );
    assert.equal(
      verificationCodeError("Token has expired or is invalid"),
      "That code is incorrect or has expired.",
    );
    assert.match(
      verificationCodeError(
        "Request rate limit reached",
        "over_request_rate_limit",
      ),
      /Too many attempts/,
    );
  });

  test("reads a resend cooldown from the provider message", () => {
    assert.equal(
      resendCooldownSeconds(
        "For security purposes, you can only request this after 58 seconds.",
      ),
      58,
    );
    assert.match(
      resendCodeError("email rate limit exceeded"),
      /Too many emails/,
    );
    assert.equal(resendCooldownSeconds("something else"), null);
  });
});
