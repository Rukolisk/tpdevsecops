import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, signToken } from "@/lib/auth";
import {
  loginSchema,
  ticketUpdateSchema,
  registerSchema,
} from "@/lib/validators";
import {
  canEditTicket,
  canDeleteTicket,
  canViewTicket,
  User,
  Ticket,
} from "@/lib/permissions";

// ---------------------------------------------------------------------------
// auth.ts — token expiration
// ---------------------------------------------------------------------------

describe("auth.ts — expired token", () => {
  it("returns null for a token expired in the past", () => {
    // Sign a token that expired 1 second ago using the same secret the lib uses
    const secret = process.env.JWT_SECRET ?? "fallback-secret-change-me";
    const expiredToken = jwt.sign(
      {
        userId: "u1",
        email: "a@b.com",
        role: "USER",
        exp: Math.floor(Date.now() / 1000) - 1,
      },
      secret,
    );
    expect(verifyToken(expiredToken)).toBeNull();
  });

  it("accepts a token that expires far in the future", () => {
    const token = signToken({
      userId: "u2",
      email: "future@b.com",
      role: "USER",
    });
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.role).toBe("USER");
  });
});

// ---------------------------------------------------------------------------
// validators.ts — loginSchema (cas limites)
// ---------------------------------------------------------------------------

describe("validators.ts — loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "admin@helpdesk.io",
      password: "Password123!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "admin@helpdesk.io",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anypass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects completely missing email field", () => {
    const result = loginSchema.safeParse({ password: "somepass" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validators.ts — registerSchema (cas limites supplémentaires)
// ---------------------------------------------------------------------------

describe("validators.ts — registerSchema edge cases", () => {
  it("rejects a name that is too short (1 char)", () => {
    const result = registerSchema.safeParse({
      email: "x@x.com",
      password: "Valid123",
      name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long (> 80 chars)", () => {
    const result = registerSchema.safeParse({
      email: "x@x.com",
      password: "Valid123",
      name: "A".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "x@x.com",
      password: "Ab1",
      name: "Alice",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validators.ts — ticketUpdateSchema
// ---------------------------------------------------------------------------

describe("validators.ts — ticketUpdateSchema", () => {
  it("accepts a partial update (status only)", () => {
    const result = ticketUpdateSchema.safeParse({ status: "RESOLVED" });
    expect(result.success).toBe(true);
  });

  it("accepts a full update", () => {
    const result = ticketUpdateSchema.safeParse({
      title: "Updated title",
      description: "An updated description that is long enough.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: "user-abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts assigneeId set to null (unassign)", () => {
    const result = ticketUpdateSchema.safeParse({ assigneeId: null });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = ticketUpdateSchema.safeParse({ status: "PENDING" });
    expect(result.success).toBe(false);
  });

  it("rejects a title that is too short when provided", () => {
    const result = ticketUpdateSchema.safeParse({ title: "AB" });
    expect(result.success).toBe(false);
  });

  it("rejects a description that is too short when provided", () => {
    const result = ticketUpdateSchema.safeParse({ description: "Short" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty object (no-op update)", () => {
    // All fields are optional — an empty object is valid
    const result = ticketUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// permissions.ts — canEditTicket
// ---------------------------------------------------------------------------

const adminUser: User = { id: "admin-1", role: "ADMIN" };
const agentUser: User = { id: "agent-1", role: "AGENT" };
const regularUser: User = { id: "user-1", role: "USER" };
const otherUser: User = { id: "user-2", role: "USER" };

const openTicket: Ticket = { id: "t1", authorId: "user-1", status: "OPEN" };
const inProgressTicket: Ticket = {
  id: "t2",
  authorId: "user-1",
  assigneeId: "agent-1",
  status: "IN_PROGRESS",
};
const closedTicket: Ticket = { id: "t3", authorId: "user-1", status: "CLOSED" };
const otherUserTicket: Ticket = {
  id: "t4",
  authorId: "user-2",
  status: "OPEN",
};

describe("permissions.ts — canEditTicket", () => {
  it("ADMIN can always edit any ticket", () => {
    expect(canEditTicket(adminUser, openTicket)).toBe(true);
    expect(canEditTicket(adminUser, closedTicket)).toBe(true);
  });

  it("AGENT can edit an open ticket", () => {
    expect(canEditTicket(agentUser, openTicket)).toBe(true);
  });

  it("AGENT can edit an in-progress ticket", () => {
    expect(canEditTicket(agentUser, inProgressTicket)).toBe(true);
  });

  it("AGENT cannot edit a closed ticket", () => {
    expect(canEditTicket(agentUser, closedTicket)).toBe(false);
  });

  it("USER can edit their own OPEN ticket", () => {
    expect(canEditTicket(regularUser, openTicket)).toBe(true);
  });

  it("USER cannot edit their own ticket if it is IN_PROGRESS", () => {
    expect(canEditTicket(regularUser, inProgressTicket)).toBe(false);
  });

  it("USER cannot edit another user's ticket", () => {
    expect(canEditTicket(regularUser, otherUserTicket)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// permissions.ts — canDeleteTicket
// ---------------------------------------------------------------------------

describe("permissions.ts — canDeleteTicket", () => {
  it("ADMIN can delete", () => {
    expect(canDeleteTicket(adminUser)).toBe(true);
  });

  it("AGENT cannot delete", () => {
    expect(canDeleteTicket(agentUser)).toBe(false);
  });

  it("USER cannot delete", () => {
    expect(canDeleteTicket(regularUser)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// permissions.ts — canViewTicket
// ---------------------------------------------------------------------------

describe("permissions.ts — canViewTicket", () => {
  it("ADMIN can view any ticket", () => {
    expect(canViewTicket(adminUser, otherUserTicket)).toBe(true);
  });

  it("AGENT can view any ticket", () => {
    expect(canViewTicket(agentUser, otherUserTicket)).toBe(true);
  });

  it("USER can view their own ticket", () => {
    expect(canViewTicket(regularUser, openTicket)).toBe(true);
  });

  it("USER can view a ticket assigned to them", () => {
    const assignedTicket: Ticket = {
      id: "t5",
      authorId: "user-2",
      assigneeId: "user-1",
      status: "IN_PROGRESS",
    };
    expect(canViewTicket(regularUser, assignedTicket)).toBe(true);
  });

  it("USER cannot view another user's unrelated ticket", () => {
    expect(canViewTicket(regularUser, otherUserTicket)).toBe(false);
  });
});
