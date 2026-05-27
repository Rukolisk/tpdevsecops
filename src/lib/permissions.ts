export interface User {
  id: string;
  role: "ADMIN" | "AGENT" | "USER";
}

export interface Ticket {
  id: string;
  authorId: string;
  assigneeId?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
}

/**
 * Determines whether a user can edit a given ticket.
 *
 * Rules:
 * - ADMIN can always edit
 * - AGENT can edit any ticket that is not CLOSED
 * - USER can only edit their own ticket if it is OPEN (not yet taken by an agent)
 */
export function canEditTicket(user: User, ticket: Ticket): boolean {
  if (user.role === "ADMIN") return true;
  if (ticket.status === "CLOSED") return false;
  if (user.role === "AGENT") return true;
  // USER
  return user.id === ticket.authorId && ticket.status === "OPEN";
}

/**
 * Determines whether a user can delete a ticket.
 * Only ADMINs can delete tickets.
 */
export function canDeleteTicket(user: User): boolean {
  return user.role === "ADMIN";
}

/**
 * Determines whether a user can view a ticket.
 * - ADMIN and AGENT can see all tickets
 * - USER can only see their own or tickets assigned to them
 */
export function canViewTicket(user: User, ticket: Ticket): boolean {
  if (user.role === "ADMIN" || user.role === "AGENT") return true;
  return user.id === ticket.authorId || user.id === ticket.assigneeId;
}
