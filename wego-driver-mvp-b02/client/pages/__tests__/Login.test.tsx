import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";

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

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe("Driver Login — initial render", () => {

  it("shows the WeGo Driver brand name", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: /wego driver/i })).toBeInTheDocument();
  });

  it("shows the tagline", () => {
    renderLogin();
    expect(screen.getByText("Driver-owned cooperative")).toBeInTheDocument();
  });

  it("shows email and password fields", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("you@email.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("shows Sign In submit button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows 88% to drivers badge", () => {
    renderLogin();
    expect(screen.getByText(/88% to drivers/i)).toBeInTheDocument();
  });

});

describe("Driver Login — mode switching", () => {

  beforeEach(() => { mockClear.mockReset(); });

  it("switches to sign-up when 'Create account' is clicked", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/create account/i));

    expect(screen.getByPlaceholderText("Your full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (415) 555-0100")).toBeInTheDocument();
  });

  it("switches to reset mode when 'Forgot password?' is clicked", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/forgot password/i));

    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("can return to sign-in from reset mode", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/forgot password/i));
    await userEvent.click(screen.getByText(/back to sign in/i));

    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("can return to sign-in from sign-up mode", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/create account/i));
    await userEvent.click(screen.getByText(/sign in/i));

    expect(screen.queryByPlaceholderText("Your full name")).not.toBeInTheDocument();
  });

});

describe("Driver Login — form submission", () => {

  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignUp.mockReset();
    mockReset.mockReset();
  });

  it("calls signIn with the typed email and password", async () => {
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "driver@wego.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "mypassword");

    document.querySelector("form")!.requestSubmit();

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("driver@wego.com", "mypassword");
    });
  });

  it("calls signUp with all fields in sign-up mode", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/create account/i));

    await userEvent.type(screen.getByPlaceholderText("Your full name"), "Alex Smith");
    await userEvent.type(screen.getByPlaceholderText("+1 (415) 555-0100"), "4155550100");
    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "alex@wego.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "securepass");

    document.querySelector("form")!.requestSubmit();

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

    document.querySelector("form")!.requestSubmit();

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith("forgot@wego.com");
    });
  });

});
