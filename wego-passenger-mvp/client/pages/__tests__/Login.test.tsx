/**
 * LOGIN PAGE TESTS
 *
 * Component tests check that UI elements render correctly and
 * respond to user interaction — without needing a real server or Firebase.
 *
 * vi.mock() replaces Firebase with fake functions so tests run instantly
 * and never touch the network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";

// ── Mock the auth context so Firebase is never called ─────────────────────
const mockSignIn  = vi.fn();
const mockSignUp  = vi.fn();
const mockReset   = vi.fn();
const mockClear   = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    signIn:        mockSignIn,
    signUp:        mockSignUp,
    resetPassword: mockReset,
    error:         null,
    clearError:    mockClear,
    loading:       false,
  }),
}));

// Wrap in router because Login uses react-router internally
function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

// ─────────────────────────────────────────────
describe("Login page — initial render", () => {

  it("shows the WeGo brand name", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: /wego/i })).toBeInTheDocument();
  });

  it("shows the tagline", () => {
    renderLogin();
    expect(screen.getByText("The cooperative rideshare")).toBeInTheDocument();
  });

  it("shows email and password fields", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("you@email.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("shows Sign In and Sign Up tab buttons", () => {
    renderLogin();
    // getAllByRole returns all matching elements
    const buttons = screen.getAllByRole("button", { name: /sign in/i });
    expect(buttons.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("shows cooperative badge stats", () => {
    renderLogin();
    expect(screen.getByText("88% to drivers")).toBeInTheDocument();
    expect(screen.getByText("No surge pricing")).toBeInTheDocument();
  });

});

// ─────────────────────────────────────────────
describe("Login page — switching modes", () => {

  beforeEach(() => { mockClear.mockReset(); });

  it("switches to sign-up form when Sign Up tab is clicked", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    // Sign-up adds extra fields
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (415) 555-0100")).toBeInTheDocument();
  });

  it("switches to password reset when Forgot password is clicked", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/forgot password/i));

    // Reset mode: no password field, shows a reset instruction
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    expect(screen.getByText(/send a reset link/i)).toBeInTheDocument();
  });

  it("can return to sign-in from reset mode", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/forgot password/i));
    await userEvent.click(screen.getByText(/back to sign in/i));

    // Password field is back
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

});

// ─────────────────────────────────────────────
describe("Login page — form submission", () => {

  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignUp.mockReset();
  });

  it("calls signIn with the typed email and password", async () => {
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "driver@wego.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "mypassword");

    // Submit the form (click the submit button inside the form)
    const form = document.querySelector("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("driver@wego.com", "mypassword");
    });
  });

  it("calls signUp with all fields when in sign-up mode", async () => {
    renderLogin();

    // Switch to sign-up
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await userEvent.type(screen.getByPlaceholderText("Your name"), "Alex Smith");
    await userEvent.type(screen.getByPlaceholderText("+1 (415) 555-0100"), "4155550100");
    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "alex@wego.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "securepass");

    const form = document.querySelector("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        "alex@wego.com",
        "securepass",
        "Alex Smith",
        "4155550100"
      );
    });
  });

  it("calls resetPassword with the email in reset mode", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/forgot password/i));

    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "forgot@wego.com");

    const form = document.querySelector("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith("forgot@wego.com");
    });
  });

});
